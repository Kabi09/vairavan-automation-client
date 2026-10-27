import Duty from '../models/Duty.js';
import Leave from '../models/Leave.js';
import Holiday from '../models/Holiday.js';
import CompOffCredit from '../models/CompOffCredit.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import {
  toISTDateString,
  isSundayInIST,
  getEmployeeLeaveBalances,
  syncSundayCompOffCredits,
} from '../services/leaveService.js';

/**
 * Format a Date object to "HH:mm" in IST
 */
const formatTimeIST = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(d);
};

/**
 * @desc    Get monthly calendar data and summary for an employee
 * @route   GET /api/calendar/monthly
 * @access  Private (Employee views own, Admin views any)
 */
export const getMonthlyCalendar = asyncHandler(async (req, res) => {
  let targetEmployeeId = req.user._id;

  if (req.query.employeeId && req.user.role === 'admin') {
    targetEmployeeId = req.query.employeeId;
  }

  const employee = await User.findById(targetEmployeeId).select(
    'employeeName employeeId designation email casualLeaveAllowance avatar'
  );

  if (!employee) {
    throw ApiError.notFound('Employee not found');
  }

  // Sync Sunday Comp-Off credits
  await syncSundayCompOffCredits(targetEmployeeId);

  const now = new Date();
  const year = parseInt(req.query.year || now.getFullYear(), 10);
  const month = parseInt(req.query.month || (now.getMonth() + 1), 10); // 1-12

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    throw ApiError.badRequest('Invalid year or month parameter');
  }

  // Calculate month boundaries in IST
  const monthStr = String(month).padStart(2, '0');
  const daysInMonth = new Date(year, month, 0).getDate();

  const startDateStr = `${year}-${monthStr}-01`;
  const endDateStr = `${year}-${monthStr}-${String(daysInMonth).padStart(2, '0')}`;

  const startQuery = new Date(`${startDateStr}T00:00:00.000Z`);
  const endQuery = new Date(`${endDateStr}T23:59:59.999Z`);

  // Parallel fetch: duties, holidays, leaves, comp-off credits
  const [duties, holidays, leaves, compOffCredits, balances] = await Promise.all([
    Duty.find({
      employee: targetEmployeeId,
      dutyDate: { $gte: startQuery, $lte: endQuery },
    })
      .populate('company', 'companyName companyType location')
      .populate('client', 'clientName')
      .sort({ dutyDate: 1 }),

    Holiday.find({
      isDeleted: false,
      status: 'active',
      startDate: { $lte: endQuery },
      endDate: { $gte: startQuery },
    }),

    Leave.find({
      employee: targetEmployeeId,
      status: { $in: ['approved', 'pending'] },
      startDate: { $lte: endQuery },
      endDate: { $gte: startQuery },
    }).sort({ startDate: 1 }),

    CompOffCredit.find({
      employee: targetEmployeeId,
      sundayDate: { $gte: startQuery, $lte: endQuery },
    }),

    getEmployeeLeaveBalances(targetEmployeeId, year),
  ]);

  // Index duties by IST date string
  const dutyByDate = {};
  duties.forEach((d) => {
    const dStr = toISTDateString(d.dutyDate);
    if (dStr) {
      dutyByDate[dStr] = d;
    }
  });

  // Index holidays by date string
  const holidayByDate = {};
  holidays.forEach((h) => {
    let curr = new Date(h.startDate);
    const end = new Date(h.endDate);
    while (curr <= end) {
      const dStr = toISTDateString(curr);
      if (dStr && dStr >= startDateStr && dStr <= endDateStr) {
        holidayByDate[dStr] = h.holidayName || 'Official Holiday';
      }
      curr.setDate(curr.getDate() + 1);
    }
  });

  // Index leaves by date string
  const leaveByDate = {};
  leaves.forEach((l) => {
    let curr = new Date(l.startDate);
    const end = new Date(l.endDate);
    while (curr <= end) {
      const dStr = toISTDateString(curr);
      if (dStr && dStr >= startDateStr && dStr <= endDateStr) {
        // If an approved leave already exists for this day, don't overwrite with pending
        if (!leaveByDate[dStr] || leaveByDate[dStr].status !== 'approved') {
          leaveByDate[dStr] = {
            _id: l._id,
            status: l.status,
            leaveType: l.leaveType || 'casual_leave',
            reason: l.reason,
            adminRemarks: l.adminRemarks,
          };
        }
      }
      curr.setDate(curr.getDate() + 1);
    }
  });

  // Index Sunday Comp-Off credits
  const compOffByDate = {};
  compOffCredits.forEach((c) => {
    if (c.sundayDateString) {
      compOffByDate[c.sundayDateString] = c;
    }
  });

  const todayStr = toISTDateString(now);

  // Build daily calendar items and accumulate summary counters
  let totalScheduledWorkingDays = 0;
  let daysWorked = 0;
  let totalHolidays = 0;
  let casualLeaveTaken = 0;
  let compOffLeaveTaken = 0;
  let sundayWorkDays = 0;
  let compOffCreditsEarned = 0;

  const calendarDays = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = String(d).padStart(2, '0');
    const dateStr = `${year}-${monthStr}-${dayStr}`;
    const dateObj = new Date(`${dateStr}T12:00:00.000Z`);

    const dayName = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      weekday: 'long',
    }).format(dateObj);

    const isSunday = dayName.toLowerCase() === 'sunday';
    const holidayName = holidayByDate[dateStr] || null;
    const isHoliday = Boolean(holidayName);
    const isScheduledWorkingDay = !isSunday && !isHoliday;
    const isFuture = dateStr > todayStr;

    if (isScheduledWorkingDay) {
      totalScheduledWorkingDays++;
    }
    if (isSunday || isHoliday) {
      totalHolidays++;
    }

    const duty = dutyByDate[dateStr] || null;
    const hasWorked = Boolean(
      duty &&
      (duty.status === 'submitted' ||
       duty.status === 'approved' ||
       (duty.checkInTime && duty.checkOutTime) ||
       (duty.inTime && duty.outTime))
    );

    if (hasWorked) {
      daysWorked++;
    }

    const isSundayWork = isSunday && hasWorked;
    if (isSundayWork) {
      sundayWorkDays++;
    }

    const hasCompOffCredit = Boolean(compOffByDate[dateStr] || isSundayWork);
    if (hasCompOffCredit && (isSundayWork || compOffByDate[dateStr])) {
      compOffCreditsEarned++;
    }

    const leave = leaveByDate[dateStr] || null;

    if (leave && leave.status === 'approved') {
      if (leave.leaveType === 'comp_off') {
        compOffLeaveTaken++;
      } else {
        casualLeaveTaken++;
      }
    }

    // Determine primary calendar colour based on exact legend:
    // Green: Present / Worked
    // Red: Approved Leave (Casual Leave)
    // Blue: Comp-Off Leave
    // Orange: Sunday Work / Comp-Off Earned
    // Purple: Pending Leave Request
    // Yellow: Sunday / Weekly Holiday
    // Grey: Future Date or No Attendance Record
    let statusColor = '#94A3B8'; // Grey default
    let statusLabel = 'No Record';

    if (isSundayWork) {
      statusColor = '#EA580C'; // Orange
      statusLabel = 'Sunday Work (Comp-Off Earned)';
    } else if (hasWorked) {
      statusColor = '#059669'; // Green
      statusLabel = 'Present / Worked';
    } else if (leave && leave.status === 'approved') {
      if (leave.leaveType === 'comp_off') {
        statusColor = '#2563EB'; // Blue
        statusLabel = 'Comp-Off Leave';
      } else {
        statusColor = '#DC2626'; // Red
        statusLabel = 'Casual Leave';
      }
    } else if (leave && leave.status === 'pending') {
      statusColor = '#9333EA'; // Purple
      statusLabel = 'Leave Request Pending';
    } else if (isSunday) {
      statusColor = '#EAB308'; // Yellow
      statusLabel = 'Weekly Holiday (Sunday)';
    } else if (isHoliday) {
      statusColor = '#F59E0B'; // Amber / Holiday Yellow
      statusLabel = holidayName || 'Public Holiday';
    } else if (isFuture) {
      statusColor = '#CBD5E1'; // Light Grey
      statusLabel = 'Upcoming';
    }

    calendarDays.push({
      date: dateStr,
      dayOfMonth: d,
      dayOfWeek: dayName,
      isSunday,
      isHoliday,
      holidayName,
      isScheduledWorkingDay,
      isFuture,
      hasWorked,
      isSundayWork,
      compOffEarned: hasCompOffCredit,
      statusColor,
      statusLabel,
      attendance: duty
        ? {
            dutyId: duty.dutyId,
            dutyType: duty.dutyType,
            companyName: duty.company?.companyName || 'Office',
            clientName: duty.client?.clientName || duty.customerName || '',
            inTime: duty.inTime || formatTimeIST(duty.checkInTime),
            outTime: duty.outTime || formatTimeIST(duty.checkOutTime),
            durationMinutes: duty.totalDurationMinutes || 0,
            status: duty.status,
            workDescription: duty.workDescription || '',
            machineName: duty.machineName || '',
          }
        : null,
      leave: leave
        ? {
            leaveId: leave._id,
            leaveType: leave.leaveType,
            status: leave.status,
            reason: leave.reason,
            adminRemarks: leave.adminRemarks,
          }
        : null,
    });
  }

  const summary = {
    totalScheduledWorkingDays,
    daysWorked,
    totalHolidays,
    casualLeaveTaken,
    compOffLeaveTaken,
    sundayWorkDays,
    compOffCreditsEarned,
  };

  return ApiResponse.success(res, 200, 'Monthly calendar retrieved successfully', {
    year,
    month,
    daysInMonth,
    employee: {
      _id: employee._id,
      employeeName: employee.employeeName,
      employeeId: employee.employeeId,
      designation: employee.designation,
      avatar: employee.avatar,
    },
    summary,
    balances,
    days: calendarDays,
  });
});

export default {
  getMonthlyCalendar,
};
