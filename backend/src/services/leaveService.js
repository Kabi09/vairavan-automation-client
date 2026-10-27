import Leave from '../models/Leave.js';
import CompOffCredit from '../models/CompOffCredit.js';
import LeaveConfig from '../models/LeaveConfig.js';
import Holiday from '../models/Holiday.js';
import Duty from '../models/Duty.js';
import User from '../models/User.js';

/**
 * Convert a Date or date string to YYYY-MM-DD in Asia/Kolkata timezone
 * @param {Date|string} date 
 * @returns {string}
 */
export const toISTDateString = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
};

/**
 * Check if a date falls on Sunday in Asia/Kolkata timezone
 * @param {Date|string} date 
 * @returns {boolean}
 */
export const isSundayInIST = (date) => {
  if (!date) return false;
  const d = new Date(date);
  if (isNaN(d.getTime())) return false;
  const dayName = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
  }).format(d);
  return dayName.toLowerCase() === 'sunday';
};

/**
 * Get active leave configuration or default
 */
export const getActiveLeaveConfig = async () => {
  let config = await LeaveConfig.findOne({ key: 'global' });
  if (!config) {
    config = await LeaveConfig.create({
      key: 'global',
      defaultCasualLeaveAllowance: 12,
      leaveYear: new Date().getFullYear(),
      weeklyHoliday: 'Sunday',
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    });
  }
  return config;
};

/**
 * Calculate eligible working leave days between two dates
 * Working days: Monday - Saturday
 * Weekly holiday: Sunday (NOT counted as leave)
 * Company holidays: Inactive/Active holidays in Holiday model (NOT counted as leave)
 * 
 * @param {Date|string} startDate 
 * @param {Date|string} endDate 
 * @returns {Promise<{ totalWorkingDays: number, workingDateStrings: string[], holidayDateStrings: string[], sundayDateStrings: string[] }>}
 */
export const calculateLeaveWorkingDays = async (startDate, endDate) => {
  const startStr = toISTDateString(startDate);
  const endStr = toISTDateString(endDate);

  if (!startStr || !endStr) {
    return { totalWorkingDays: 0, workingDateStrings: [], holidayDateStrings: [], sundayDateStrings: [] };
  }

  // Fetch company holidays overlapping this window
  const startQuery = new Date(`${startStr}T00:00:00.000Z`);
  const endQuery = new Date(`${endStr}T23:59:59.999Z`);

  const holidays = await Holiday.find({
    isDeleted: false,
    status: 'active',
    startDate: { $lte: endQuery },
    endDate: { $gte: startQuery },
  });

  const holidayDateSet = new Set();
  holidays.forEach((h) => {
    let curr = new Date(h.startDate);
    const end = new Date(h.endDate);
    while (curr <= end) {
      holidayDateSet.add(toISTDateString(curr));
      curr.setDate(curr.getDate() + 1);
    }
  });

  const workingDateStrings = [];
  const sundayDateStrings = [];
  const holidayDateStrings = [];

  let current = new Date(`${startStr}T12:00:00.000Z`);
  const endLimit = new Date(`${endStr}T12:00:00.000Z`);

  while (current <= endLimit) {
    const dateStr = toISTDateString(current);
    const isSun = isSundayInIST(current);
    const isCompanyHoliday = holidayDateSet.has(dateStr);

    if (isSun) {
      sundayDateStrings.push(dateStr);
    } else if (isCompanyHoliday) {
      holidayDateStrings.push(dateStr);
    } else {
      workingDateStrings.push(dateStr);
    }

    current.setDate(current.getDate() + 1);
  }

  return {
    totalWorkingDays: workingDateStrings.length,
    workingDateStrings,
    holidayDateStrings,
    sundayDateStrings,
  };
};

/**
 * Award one Comp-Off credit if an employee completed valid check-in and checkout on Sunday.
 * Enforces maximum of ONE credit per employee per Sunday.
 * 
 * @param {Object} params
 * @param {string|ObjectId} params.employeeId
 * @param {Object} params.duty
 * @returns {Promise<Object|null>}
 */
export const awardSundayCompOffCredit = async ({ employeeId, duty }) => {
  try {
    if (!employeeId || !duty) return null;

    const dutyDate = duty.dutyDate || duty.checkInTime || duty.createdAt;
    if (!dutyDate || !isSundayInIST(dutyDate)) {
      return null;
    }

    // Must have valid check-in and checkout records
    const hasCheckIn = Boolean(duty.checkInTime || duty.inTime);
    const hasCheckOut = Boolean(duty.checkOutTime || duty.outTime);

    // If duty is still actively checked in without checkout, do not award yet
    if (!hasCheckIn || !hasCheckOut) {
      return null;
    }

    const sundayStr = toISTDateString(dutyDate);
    const sundayDateObj = new Date(`${sundayStr}T12:00:00.000Z`);

    // Idempotent upsert: Guarantees strictly 1 credit per employee per Sunday
    const credit = await CompOffCredit.findOneAndUpdate(
      { employee: employeeId, sundayDateString: sundayStr },
      {
        $setOnInsert: {
          employee: employeeId,
          sundayDate: sundayDateObj,
          sundayDateString: sundayStr,
          duty: duty._id,
          status: 'earned',
          earnedDate: new Date(),
          notes: `Sunday duty #${duty.dutyId || String(duty._id).slice(-6)} check-in & checkout`,
        },
      },
      { upsert: true, new: true }
    );

    return credit;
  } catch (err) {
    console.warn('[LeaveService] Error awarding Sunday Comp-Off credit:', err.message);
    return null;
  }
};

/**
 * Scan past Sunday duties for an employee to ensure Comp-Off credits are credited
 * @param {string|ObjectId} employeeId 
 */
export const syncSundayCompOffCredits = async (employeeId) => {
  try {
    const duties = await Duty.find({
      employee: employeeId,
      status: { $in: ['submitted', 'approved', 'correction_requested'] },
    }).select('_id dutyId dutyDate checkInTime inTime checkOutTime outTime createdAt');

    for (const duty of duties) {
      const dDate = duty.dutyDate || duty.checkInTime || duty.createdAt;
      if (dDate && isSundayInIST(dDate)) {
        await awardSundayCompOffCredit({ employeeId, duty });
      }
    }
  } catch (err) {
    console.warn('[LeaveService] Sync Sunday credits error:', err.message);
  }
};

/**
 * Get accurate leave balances for an employee in a given year
 * 
 * @param {string|ObjectId} employeeId 
 * @param {number} [year] 
 * @returns {Promise<Object>}
 */
export const getEmployeeLeaveBalances = async (employeeId, year = new Date().getFullYear()) => {
  // Sync Sunday credits first
  await syncSundayCompOffCredits(employeeId);

  const [employee, config] = await Promise.all([
    User.findById(employeeId).select('employeeName employeeId casualLeaveAllowance'),
    getActiveLeaveConfig(),
  ]);

  const targetYear = parseInt(year || config.leaveYear || new Date().getFullYear(), 10);
  const clAllowance = employee?.casualLeaveAllowance ?? config.defaultCasualLeaveAllowance ?? 12;

  const yearStart = new Date(`${targetYear}-01-01T00:00:00.000Z`);
  const yearEnd = new Date(`${targetYear}-12-31T23:59:59.999Z`);

  // Query all leaves for this employee in this year
  const leaves = await Leave.find({
    employee: employeeId,
    startDate: { $lte: yearEnd },
    endDate: { $gte: yearStart },
    status: { $in: ['pending', 'approved'] },
  });

  // Calculate Casual Leave
  let clUsed = 0;
  let clPending = 0;

  // Calculate Comp-Off Leave
  let compOffUsed = 0;
  let compOffPending = 0;

  leaves.forEach((l) => {
    const days = Number(l.daysCount || 1);
    const type = l.leaveType || 'casual_leave';

    if (l.status === 'approved') {
      if (type === 'comp_off') {
        compOffUsed += days;
      } else {
        clUsed += days;
      }
    } else if (l.status === 'pending') {
      if (type === 'comp_off') {
        compOffPending += days;
      } else {
        clPending += days;
      }
    }
  });

  // Count earned Comp-Off credits
  const earnedCredits = await CompOffCredit.find({
    employee: employeeId,
    status: { $in: ['earned', 'used'] },
  }).sort({ sundayDate: -1 });

  const compOffEarned = earnedCredits.length;

  const clAvailable = Math.max(0, clAllowance - clUsed);
  const compOffAvailable = Math.max(0, compOffEarned - compOffUsed);

  return {
    year: targetYear,
    employee: {
      _id: employee?._id,
      name: employee?.employeeName,
      employeeId: employee?.employeeId,
    },
    casualLeave: {
      allowance: clAllowance,
      used: clUsed,
      pending: clPending,
      available: clAvailable,
    },
    compOff: {
      earned: compOffEarned,
      used: compOffUsed,
      pending: compOffPending,
      available: compOffAvailable,
      credits: earnedCredits,
    },
    config: {
      defaultCasualLeaveAllowance: config.defaultCasualLeaveAllowance,
      leaveYear: config.leaveYear,
      weeklyHoliday: config.weeklyHoliday,
      workingDays: config.workingDays,
    },
  };
};

export default {
  toISTDateString,
  isSundayInIST,
  getActiveLeaveConfig,
  calculateLeaveWorkingDays,
  awardSundayCompOffCredit,
  syncSundayCompOffCredits,
  getEmployeeLeaveBalances,
};
