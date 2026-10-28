import { isDeveloperAdmin } from '../utils/userFilter.js';
import ExcelJS from 'exceljs';
import Duty from '../models/Duty.js';
import Company from '../models/Company.js';
import Client from '../models/Client.js';
import User from '../models/User.js';
import Leave from '../models/Leave.js';
import CompOffCredit from '../models/CompOffCredit.js';
import Expense from '../models/Expense.js';
import Holiday from '../models/Holiday.js';
import { toISTDateString, isSundayInIST } from './leaveService.js';

/**
 * Format a Date or date string to readable IST date: "DD MMM YYYY"
 */
export const formatReadableISTDate = (date) => {
  if (!date) return 'N/A';
  const d = new Date(date);
  if (isNaN(d.getTime())) return String(date);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
};

/**
 * Format a Date to "HH:mm AM/PM" in IST
 */
export const formatTimeIST = (timeOrDate) => {
  if (!timeOrDate) return 'N/A';
  if (typeof timeOrDate === 'string' && timeOrDate.includes(':') && !timeOrDate.includes('T')) {
    const parts = timeOrDate.split(':');
    const h = parseInt(parts[0], 10);
    const m = parts[1] || '00';
    if (!isNaN(h)) {
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayH = h % 12 || 12;
      return `${displayH}:${m} ${ampm}`;
    }
  }
  const d = new Date(timeOrDate);
  if (!isNaN(d.getTime())) {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  }
  return String(timeOrDate);
};

/**
 * Resolve date range boundaries in IST
 */
export const resolveDateRange = (rangeType = 'this_month', customStart, customEnd) => {
  const now = new Date();
  const todayStr = toISTDateString(now);

  if (rangeType === 'today') {
    return { startDateStr: todayStr, endDateStr: todayStr, label: 'Today' };
  }

  if (rangeType === 'yesterday') {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const yStr = toISTDateString(y);
    return { startDateStr: yStr, endDateStr: yStr, label: 'Yesterday' };
  }

  if (rangeType === 'this_week') {
    const d = new Date(now);
    const day = d.getDay(); // 0 is Sunday
    const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diffToMonday));
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    return {
      startDateStr: toISTDateString(monday),
      endDateStr: toISTDateString(sunday),
      label: 'This Week',
    };
  }

  if (rangeType === 'this_month') {
    const parts = todayStr.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const daysInMonth = new Date(year, month, 0).getDate();
    return {
      startDateStr: `${year}-${String(month).padStart(2, '0')}-01`,
      endDateStr: `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`,
      label: 'This Month',
    };
  }

  if (rangeType === 'previous_month') {
    const parts = todayStr.split('-');
    let year = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10) - 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
    const daysInMonth = new Date(year, month, 0).getDate();
    return {
      startDateStr: `${year}-${String(month).padStart(2, '0')}-01`,
      endDateStr: `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`,
      label: 'Previous Month',
    };
  }

  if (rangeType === 'custom' || customStart || customEnd) {
    const startStr = customStart ? toISTDateString(customStart) : '2020-01-01';
    const endStr = customEnd ? toISTDateString(customEnd) : todayStr;
    return {
      startDateStr: startStr,
      endDateStr: endStr,
      label: `Custom (${startStr} to ${endStr})`,
    };
  }

  // Default to this_month
  return resolveDateRange('this_month');
};

/**
 * Fetch and aggregate complete All-in-One report data
 */
export const generateAllInOneReportData = async (filters = {}) => {
  const {
    dateRange = 'this_month',
    startDate,
    endDate,
    companyId,
    clientId,
    employeeId,
    workType,
    workStatus,
    leaveType,
    leaveStatus,
    expenseCategory,
  } = filters;

  const resolvedRange = resolveDateRange(dateRange, startDate, endDate);
  const { startDateStr, endDateStr, label: dateRangeLabel } = resolvedRange;

  const startQuery = new Date(`${startDateStr}T00:00:00.000+05:30`);
  const endQuery = new Date(`${endDateStr}T23:59:59.999+05:30`);

  // Build Queries
  const dutyQuery = {
    dutyDate: { $gte: startQuery, $lte: endQuery },
  };
  if (companyId) dutyQuery.company = companyId;
  if (clientId) dutyQuery.client = clientId;
  if (employeeId) dutyQuery.employee = employeeId;
  if (workType) dutyQuery.workType = workType;
  if (workStatus) dutyQuery.status = workStatus;

  const leaveQuery = {
    startDate: { $lte: endQuery },
    endDate: { $gte: startQuery },
  };
  if (employeeId) leaveQuery.employee = employeeId;
  if (leaveType) leaveQuery.leaveType = leaveType;
  if (leaveStatus) leaveQuery.status = leaveStatus;

  const compOffQuery = {
    sundayDate: { $gte: startQuery, $lte: endQuery },
  };
  if (employeeId) compOffQuery.employee = employeeId;

  const expenseQuery = {
    expenseDate: { $gte: startQuery, $lte: endQuery },
  };
  if (employeeId) expenseQuery.employee = employeeId;
  if (companyId) expenseQuery.company = companyId;
  if (clientId) expenseQuery.client = clientId;

  const companyQuery = { isDeleted: false };
  if (companyId) companyQuery._id = companyId;

  const clientQuery = { isDeleted: false };
  if (companyId) clientQuery.company = companyId;
  if (clientId) clientQuery._id = clientId;

  const userQuery = {
    role: { $in: ['employee', 'staff'] },
    employeeId: { $ne: 'DEV001', $not: /^DEV/i },
    email: { $nin: ['admin@gmail.com', 'mailtokabilan056@gmail.com'] },
  };
  if (employeeId) userQuery._id = employeeId;

  // Execute Parallel Fetch
  const [
    duties,
    companies,
    clients,
    employees,
    leaves,
    compOffCredits,
    expenses,
    holidays,
  ] = await Promise.all([
    Duty.find(dutyQuery)
      .populate('employee', 'employeeName employeeId designation phoneNumber email avatar')
      .populate('company', 'companyName companyType location companyPhoneNumber')
      .populate('client', 'clientName clientPhoneNumber')
      .populate('adminReview.reviewedBy', 'employeeName employeeId')
      .sort({ dutyDate: -1, createdAt: -1 }),

    Company.find(companyQuery).sort({ companyName: 1 }),

    Client.find(clientQuery).populate('company', 'companyName').sort({ clientName: 1 }),

    User.find(userQuery).select(
      'employeeName employeeId designation phoneNumber email avatar location address casualLeaveAllowance role accountStatus'
    ).sort({ employeeName: 1 }),

    Leave.find(leaveQuery)
      .populate('employee', 'employeeName employeeId designation')
      .populate('adminReviewer', 'employeeName employeeId')
      .sort({ startDate: -1 }),

    CompOffCredit.find(compOffQuery)
      .populate('employee', 'employeeName employeeId designation')
      .sort({ sundayDate: -1 }),

    Expense.find(expenseQuery)
      .populate('employee', 'employeeName employeeId designation')
      .populate('company', 'companyName location')
      .populate('client', 'clientName')
      .populate('duty', 'dutyId workType machineName')
      .sort({ expenseDate: -1 }),

    Holiday.find({
      isDeleted: false,
      status: 'active',
      startDate: { $lte: endQuery },
      endDate: { $gte: startQuery },
    }).sort({ startDate: 1 }),
  ]);

  // Exclude Developer Admin and Admin accounts from employee/staff summaries
  const validEmployees = employees.filter(
    (emp) => !isDeveloperAdmin(emp) && emp.role !== 'admin'
  );

  // Index Expenses by Duty ID to link them
  const expensesByDutyId = {};
  expenses.forEach((exp) => {
    if (exp.duty?._id) {
      const dIdStr = exp.duty._id.toString();
      if (!expensesByDutyId[dIdStr]) expensesByDutyId[dIdStr] = [];
      expensesByDutyId[dIdStr].push(exp);
    }
  });

  // Filter expenses by category if filter applied
  let filteredExpenses = expenses;
  if (expenseCategory) {
    filteredExpenses = expenses.filter((exp) =>
      (exp.items || []).some(
        (it) =>
          it.categoryName?.toLowerCase() === expenseCategory.toLowerCase() ||
          it.category?.toString() === expenseCategory
      )
    );
  }

  // Work records enhanced with OT calculation and linked expenses
  const enhancedDuties = duties.map((duty) => {
    let durationMinutes = duty.totalDurationMinutes || 0;
    // Calculate duration on the fly if not explicitly recorded
    if (!durationMinutes) {
      const inT = duty.inTime || (duty.checkInTime ? formatTimeIST(duty.checkInTime) : '');
      const outT = duty.outTime || (duty.checkOutTime ? formatTimeIST(duty.checkOutTime) : '');
      if (inT && outT && inT.includes(':') && outT.includes(':')) {
        const [inH, inM] = inT.replace(/[^\d:]/g, '').split(':').map(Number);
        const [outH, outM] = outT.replace(/[^\d:]/g, '').split(':').map(Number);
        let diff = (outH * 60 + (outM || 0)) - (inH * 60 + (inM || 0));
        if (diff < 0) diff += 24 * 60;
        durationMinutes = Math.max(0, diff);
      } else if (duty.checkInTime && duty.checkOutTime) {
        const ms = new Date(duty.checkOutTime).getTime() - new Date(duty.checkInTime).getTime();
        if (ms > 0) durationMinutes = Math.round(ms / (1000 * 60));
      }
    }

    // User Rule: Overtime (OT) is strictly added ONLY for Sunday work.
    // Weekday duties (> 8 hours) do NOT add OT hours.
    const isSunday = isSundayInIST(duty.dutyDate);
    const otMinutes = isSunday ? durationMinutes : 0;
    const otHours = parseFloat((otMinutes / 60).toFixed(2));
    const standardHours = isSunday ? 0 : parseFloat((durationMinutes / 60).toFixed(2));
    const dutyExpList = expensesByDutyId[duty._id.toString()] || [];
    const dutyExpTotal = dutyExpList.reduce((sum, e) => sum + (e.grandTotal || 0), 0);

    return {
      _id: duty._id,
      dutyId: duty.dutyId || `WORK-${duty._id.toString().slice(-4).toUpperCase()}`,
      dutyDate: duty.dutyDate,
      dutyDateStr: toISTDateString(duty.dutyDate),
      dutyDateReadable: formatReadableISTDate(duty.dutyDate),
      dutyType: duty.dutyType,
      employee: duty.employee,
      company: duty.company,
      client: duty.client,
      inTime: duty.inTime || (duty.checkInTime ? formatTimeIST(duty.checkInTime) : 'N/A'),
      outTime: duty.outTime || (duty.checkOutTime ? formatTimeIST(duty.checkOutTime) : 'N/A'),
      checkInTime: duty.checkInTime,
      checkOutTime: duty.checkOutTime,
      totalDurationMinutes: durationMinutes,
      workingHours: parseFloat((durationMinutes / 60).toFixed(2)),
      standardHours,
      otMinutes,
      otHours,
      customerName: duty.customerName || (duty.client ? duty.client.clientName : (duty.company ? duty.company.companyName : 'N/A')),
      customerPhoneNumber: duty.customerPhoneNumber || (duty.client ? duty.client.clientPhoneNumber : ''),
      machineName: duty.machineName || 'N/A',
      workType: duty.workType || 'Maintenance',
      customWorkType: duty.customWorkType || '',
      workDescription: duty.workDescription || '',
      features: duty.features || [],
      manpowerMembers: duty.manpowerMembers || [],
      checkInLocation: duty.checkInLocation || duty.location,
      checkOutLocation: duty.checkOutLocation,
      customerSignature: duty.customerSignature,
      customerProofPhotos: duty.customerProofPhotos || [],
      status: duty.status,
      adminReview: duty.adminReview,
      linkedExpenses: dutyExpList,
      totalExpenseAmount: dutyExpTotal,
    };
  });

  // Calculate Overtime (OT) Specific List
  const overtimeRecords = enhancedDuties
    .filter((d) => d.otHours > 0)
    .map((d) => ({
      dutyId: d.dutyId,
      dutyDate: d.dutyDate,
      dutyDateStr: d.dutyDateStr,
      employee: d.employee,
      company: d.company,
      client: d.client,
      inTime: d.inTime,
      outTime: d.outTime,
      totalDurationMinutes: d.totalDurationMinutes,
      workingHours: d.workingHours,
      otHours: d.otHours,
      workType: d.workType,
      status: d.status,
    }));

  // Employee-wise aggregation
  const employeeMap = {};
  validEmployees.forEach((emp) => {
    const eId = emp._id.toString();
    employeeMap[eId] = {
      _id: emp._id,
      employeeName: emp.employeeName,
      employeeId: emp.employeeId,
      designation: emp.designation,
      phoneNumber: emp.phoneNumber,
      email: emp.email,
      avatar: emp.avatar,
      casualLeaveAllowance: emp.casualLeaveAllowance || 12,
      joiningDate: emp.joiningDate || emp.createdAt,
      assignedCompanies: new Set(),
      assignedClients: new Set(),
      totalDuties: 0,
      workedDatesSet: new Set(),
      totalDurationMinutes: 0,
      totalWorkingHours: 0,
      totalOtHours: 0,
      casualLeaveDays: 0,
      compOffLeaveDays: 0,
      compOffCreditsEarned: 0,
      totalExpensesClaimed: 0,
      workHistory: [],
    };
  });

  // Accumulate duties into employee summary
  enhancedDuties.forEach((d) => {
    if (d.employee?._id && !isDeveloperAdmin(d.employee) && d.employee.role !== 'admin') {
      const eId = d.employee._id.toString();
      if (!employeeMap[eId]) {
        employeeMap[eId] = {
          _id: d.employee._id,
          employeeName: d.employee.employeeName,
          employeeId: d.employee.employeeId,
          designation: d.employee.designation,
          phoneNumber: d.employee.phoneNumber,
          email: d.employee.email,
          avatar: d.employee.avatar,
          assignedCompanies: new Set(),
          assignedClients: new Set(),
          totalDuties: 0,
          workedDatesSet: new Set(),
          totalDurationMinutes: 0,
          totalWorkingHours: 0,
          totalOtHours: 0,
          casualLeaveDays: 0,
          compOffLeaveDays: 0,
          compOffCreditsEarned: 0,
          totalExpensesClaimed: 0,
          workHistory: [],
        };
      }
      const entry = employeeMap[eId];
      entry.totalDuties += 1;
      entry.workedDatesSet.add(d.dutyDateStr);
      entry.totalDurationMinutes += d.totalDurationMinutes;
      entry.totalOtHours += d.otHours;
      if (d.company?.companyName) entry.assignedCompanies.add(d.company.companyName);
      if (d.client?.clientName) entry.assignedClients.add(d.client.clientName);
      entry.workHistory.push({
        dutyId: d.dutyId,
        dutyDateStr: d.dutyDateStr,
        companyName: d.company?.companyName || 'N/A',
        workType: d.workType,
        workingHours: d.workingHours,
        status: d.status,
      });
    }
  });

  // Accumulate leaves into employee summary
  leaves.forEach((l) => {
    if (l.employee?._id) {
      const eId = l.employee._id.toString();
      if (employeeMap[eId] && l.status === 'approved') {
        const days = l.daysCount || 1;
        if (l.leaveType === 'comp_off') {
          employeeMap[eId].compOffLeaveDays += days;
        } else {
          employeeMap[eId].casualLeaveDays += days;
        }
      }
    }
  });

  // Accumulate Comp-Off earned into employee summary
  compOffCredits.forEach((c) => {
    if (c.employee?._id) {
      const eId = c.employee._id.toString();
      if (employeeMap[eId]) {
        employeeMap[eId].compOffCreditsEarned += 1;
      }
    }
  });

  // Accumulate expenses into employee summary
  filteredExpenses.forEach((exp) => {
    if (exp.employee?._id) {
      const eId = exp.employee._id.toString();
      if (employeeMap[eId]) {
        employeeMap[eId].totalExpensesClaimed += exp.grandTotal || 0;
      }
    }
  });

  // Convert employee Map to finalized array
  const employeeSummaries = Object.values(employeeMap).map((e) => ({
    ...e,
    assignedCompanies: Array.from(e.assignedCompanies),
    assignedClients: Array.from(e.assignedClients),
    totalWorkingDays: e.workedDatesSet.size,
    totalWorkingHours: parseFloat((e.totalDurationMinutes / 60).toFixed(2)),
    totalOtHours: parseFloat(e.totalOtHours.toFixed(2)),
    workedDatesSet: undefined, // remove Set for clean JSON serialization
  }));

  // Company-wise mapping with related clients and duties count
  const companyMap = {};
  companies.forEach((comp) => {
    const cId = comp._id.toString();
    companyMap[cId] = {
      _id: comp._id,
      companyName: comp.companyName,
      companyType: comp.companyType,
      location: comp.location,
      companyPhoneNumber: comp.companyPhoneNumber || 'N/A',
      clients: [],
      totalDuties: 0,
      totalExpenses: 0,
    };
  });

  clients.forEach((client) => {
    if (client.company?._id) {
      const cId = client.company._id.toString();
      if (companyMap[cId]) {
        companyMap[cId].clients.push({
          _id: client._id,
          clientName: client.clientName,
          clientPhoneNumber: client.clientPhoneNumber || 'N/A',
          status: client.status,
        });
      }
    }
  });

  enhancedDuties.forEach((d) => {
    if (d.company?._id) {
      const cId = d.company._id.toString();
      if (companyMap[cId]) {
        companyMap[cId].totalDuties += 1;
        companyMap[cId].totalExpenses += d.totalExpenseAmount || 0;
      }
    }
  });

  const companySummaries = Object.values(companyMap);

  // 9 Summary KPI Cards Metrics
  const distinctCompanyIds = new Set();
  const distinctClientIds = new Set();
  const distinctEmployeeIds = new Set();
  const distinctWorkingDates = new Set();

  enhancedDuties.forEach((d) => {
    if (d.company?._id) distinctCompanyIds.add(d.company._id.toString());
    if (d.client?._id) distinctClientIds.add(d.client._id.toString());
    if (d.employee?._id && !isDeveloperAdmin(d.employee) && d.employee.role !== 'admin') {
      distinctEmployeeIds.add(d.employee._id.toString());
    }
    if (d.dutyDateStr) distinctWorkingDates.add(d.dutyDateStr);
  });

  // If user filtered by company, include filtered company count
  if (companyId) distinctCompanyIds.add(companyId.toString());
  if (clientId) distinctClientIds.add(clientId.toString());
  if (employeeId) distinctEmployeeIds.add(employeeId.toString());

  const totalLeaveDays = leaves.reduce((sum, l) => sum + (l.daysCount || 0), 0);
  const totalCompOffRecords = compOffCredits.length;
  const totalOtHours = parseFloat(
    enhancedDuties.reduce((sum, d) => sum + d.otHours, 0).toFixed(2)
  );
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (e.grandTotal || 0), 0);
  // Approved expenses: linked to approved duties or submitted by active users
  const totalApprovedExpenses = filteredExpenses
    .filter((e) => !e.duty || e.duty.status === 'approved' || e.duty.status === 'submitted')
    .reduce((sum, e) => sum + (e.grandTotal || 0), 0);

  const summary = {
    totalCompanies: distinctCompanyIds.size || companies.length,
    totalClients: distinctClientIds.size || clients.length,
    totalEmployees: distinctEmployeeIds.size || validEmployees.length,
    totalWorkRecords: enhancedDuties.length,
    totalWorkingDays: distinctWorkingDates.size,
    totalLeaveDays,
    totalCompOffRecords,
    totalOtHours,
    totalExpenses,
    totalApprovedExpenses,
  };

  // Build Optional Employee Calendar if an employee is filtered or requested
  let employeeCalendar = null;
  if (employeeId) {
    const targetEmployee = validEmployees.find((e) => e._id.toString() === employeeId.toString()) || null;
    const dutyByDate = {};
    enhancedDuties.forEach((d) => {
      if (d.dutyDateStr) dutyByDate[d.dutyDateStr] = d;
    });

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

    const leaveByDate = {};
    leaves.forEach((l) => {
      let curr = new Date(l.startDate);
      const end = new Date(l.endDate);
      while (curr <= end) {
        const dStr = toISTDateString(curr);
        if (dStr && dStr >= startDateStr && dStr <= endDateStr) {
          leaveByDate[dStr] = {
            leaveType: l.leaveType,
            status: l.status,
            reason: l.reason,
          };
        }
        curr.setDate(curr.getDate() + 1);
      }
    });

    const compOffByDate = {};
    compOffCredits.forEach((c) => {
      if (c.sundayDateString) compOffByDate[c.sundayDateString] = c;
    });

    // Iterate through date range
    const calendarDays = [];
    let curDate = new Date(`${startDateStr}T12:00:00.000+05:30`);
    const stopDate = new Date(`${endDateStr}T12:00:00.000+05:30`);

    while (curDate <= stopDate) {
      const dStr = toISTDateString(curDate);
      const dayName = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        weekday: 'long',
      }).format(curDate);

      const isSunday = dayName.toLowerCase() === 'sunday';
      const holidayName = holidayByDate[dStr] || null;
      const duty = dutyByDate[dStr] || null;
      const leave = leaveByDate[dStr] || null;
      const hasWorked = Boolean(duty);
      const isSundayWork = isSunday && hasWorked;
      const hasCompOffCredit = Boolean(compOffByDate[dStr] || isSundayWork);

      let status = 'No Record';
      let statusColor = '#94A3B8';

      if (isSundayWork) {
        status = 'Sunday Work (Comp-Off Earned)';
        statusColor = '#EA580C';
      } else if (hasWorked) {
        status = 'Present / Worked';
        statusColor = '#059669';
      } else if (leave && leave.status === 'approved') {
        if (leave.leaveType === 'comp_off') {
          status = 'Comp-Off Leave';
          statusColor = '#2563EB';
        } else {
          status = 'Approved Casual Leave';
          statusColor = '#DC2626';
        }
      } else if (leave && leave.status === 'pending') {
        status = 'Pending Leave Request';
        statusColor = '#9333EA';
      } else if (holidayName) {
        status = `Holiday (${holidayName})`;
        statusColor = '#EAB308';
      } else if (isSunday) {
        status = 'Weekly Holiday (Sunday)';
        statusColor = '#EAB308';
      }

      calendarDays.push({
        dateStr: dStr,
        dayName,
        isSunday,
        isHoliday: Boolean(holidayName),
        holidayName,
        status,
        statusColor,
        duty: duty
          ? {
              dutyId: duty.dutyId,
              companyName: duty.company?.companyName || 'N/A',
              clientName: duty.client?.clientName || 'N/A',
              inTime: duty.inTime,
              outTime: duty.outTime,
              durationMinutes: duty.totalDurationMinutes,
              otHours: duty.otHours,
              workType: duty.workType,
            }
          : null,
        leave,
        compOffEarned: hasCompOffCredit,
      });

      curDate.setDate(curDate.getDate() + 1);
    }

    employeeCalendar = {
      employee: targetEmployee,
      calendarDays,
    };
  }

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      generatedAtReadable: new Date().toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
      dateRangeType: dateRange,
      dateRangeLabel,
      startDate: startDateStr,
      endDate: endDateStr,
      filtersApplied: {
        companyId: companyId || 'All',
        clientId: clientId || 'All',
        employeeId: employeeId || 'All',
        workType: workType || 'All',
        workStatus: workStatus || 'All',
        leaveType: leaveType || 'All',
        leaveStatus: leaveStatus || 'All',
        expenseCategory: expenseCategory || 'All',
      },
    },
    summary,
    companies: companySummaries,
    clients,
    duties: enhancedDuties,
    employees: employeeSummaries,
    leaves,
    compOffCredits,
    overtimeRecords,
    expenses: filteredExpenses,
    employeeCalendar,
  };
};

/**
 * Generate a professional multi-worksheet Excel workbook with ExcelJS
 */
export const generateAllInOneExcelBuffer = async (reportData) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Vairavan Automation Duty Management System';
  workbook.lastModifiedBy = 'Administrator';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Helper styles
  const headerFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E40AF' }, // Primary Indigo
  };
  const headerFont = {
    name: 'Segoe UI',
    size: 11,
    bold: true,
    color: { argb: 'FFFFFFFF' },
  };
  const thinBorder = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  };
  const evenRowFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF8FAFC' },
  };

  const applyTableStyling = (worksheet, headerRowIndex = 4) => {
    const headerRow = worksheet.getRow(headerRowIndex);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = thinBorder;
    });

    // Style data rows
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > headerRowIndex) {
        row.height = 22;
        const isEven = rowNumber % 2 === 0;
        row.eachCell((cell) => {
          if (isEven && !cell.fill) {
            cell.fill = evenRowFill;
          }
          cell.border = thinBorder;
          cell.alignment = { vertical: 'middle', ...cell.alignment };
        });
      }
    });

    // Auto-fit column widths
    worksheet.columns.forEach((column) => {
      let maxLen = 12;
      column.eachCell({ includeEmpty: true }, (cell) => {
        const val = cell.value ? String(cell.value) : '';
        if (val.length > maxLen) {
          maxLen = Math.min(val.length + 4, 45);
        }
      });
      column.width = maxLen;
    });
  };

  const addReportHeader = (worksheet, sheetTitle) => {
    worksheet.mergeCells('A1:H1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'VAIRAVAN AUTOMATION - ALL-IN-ONE SYSTEM REPORT';
    titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FF1E40AF' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(1).height = 30;

    worksheet.mergeCells('A2:H2');
    const subCell = worksheet.getCell('A2');
    subCell.value = `${sheetTitle} • Period: ${reportData.meta.dateRangeLabel} (${reportData.meta.startDate} to ${reportData.meta.endDate}) • Generated: ${reportData.meta.generatedAtReadable}`;
    subCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF64748B' } };
    subCell.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(2).height = 20;
    worksheet.addRow([]); // Blank spacer row 3
  };

  // ==========================================
  // Sheet 1: Summary
  // ==========================================
  const wsSummary = workbook.addWorksheet('Summary');
  addReportHeader(wsSummary, 'Executive Summary & Operational KPI Metrics');

  wsSummary.addRow(['KEY OPERATIONAL KPI METRIC', 'TOTAL VALUE', 'UNIT / NOTES']);
  const s = reportData.summary;
  const summaryRows = [
    ['Total Registered / Filtered Companies', s.totalCompanies, 'Companies'],
    ['Total Registered / Filtered Clients', s.totalClients, 'Client Contacts'],
    ['Total Active Staff & Field Technicians', s.totalEmployees, 'Employees'],
    ['Total Field Work & Duty Records', s.totalWorkRecords, 'Service Logs'],
    ['Total Working Days Recorded', s.totalWorkingDays, 'Days Worked'],
    ['Total Leave Days (Approved & Pending)', s.totalLeaveDays, 'Leave Days'],
    ['Total Sunday Comp-Off Credits Earned', s.totalCompOffRecords, 'Credits'],
    ['Total Overtime (OT) Hours Recorded', s.totalOtHours, 'Hours (> 8h shift)'],
    ['Total Expense Claims Submitted', s.totalExpenses, 'INR (₹)'],
    ['Total Approved / Active Expenses', s.totalApprovedExpenses, 'INR (₹)'],
  ];

  summaryRows.forEach((r) => {
    wsSummary.addRow(r);
  });
  applyTableStyling(wsSummary, 4);

  // Format currency cells in Summary
  wsSummary.getCell('B13').numFmt = '₹#,##0.00';
  wsSummary.getCell('B14').numFmt = '₹#,##0.00';

  // ==========================================
  // Sheet 2: Companies & Clients
  // ==========================================
  const wsCompanies = workbook.addWorksheet('Companies & Clients');
  addReportHeader(wsCompanies, 'Company Directory & Client Contacts');
  wsCompanies.addRow([
    'Sl No',
    'Company Name',
    'Company Type',
    'Location',
    'Phone Number',
    'Total Duties',
    'Total Expenses (₹)',
    'Client Names & Contacts',
  ]);

  reportData.companies.forEach((comp, idx) => {
    const clientsStr = (comp.clients || [])
      .map((c) => `${c.clientName} (${c.clientPhoneNumber})`)
      .join('; ');
    wsCompanies.addRow([
      idx + 1,
      comp.companyName,
      comp.companyType === 'office' ? 'Office' : 'Client Company',
      comp.location,
      comp.companyPhoneNumber,
      comp.totalDuties,
      comp.totalExpenses,
      clientsStr || 'No direct clients',
    ]);
  });
  applyTableStyling(wsCompanies, 4);

  // ==========================================
  // Sheet 3: Work Details
  // ==========================================
  const wsDuties = workbook.addWorksheet('Work Details');
  addReportHeader(wsDuties, 'Field Work, Visits & Machine Service Logs');
  wsDuties.addRow([
    'Sl No',
    'Work ID',
    'Date',
    'Employee ID',
    'Employee Name',
    'Company Name',
    'Client / Customer',
    'Duty Type',
    'Check-In (IST)',
    'Check-Out (IST)',
    'Total Duration (Hrs)',
    'Sunday OT Hours',
    'Machine Name',
    'Work Type',
    'Features',
    'Manpower Team',
    'Work Description',
    'Check-In Address',
    'Check-In Maps Link',
    'Check-Out Address',
    'Check-Out Maps Link',
    'Customer Signature Link',
    'Proof Photos Links',
    'Expense Claims (₹)',
    'Expense Item Breakdown',
    'Expense Receipt Links',
    'Status',
  ]);

  reportData.duties.forEach((d, idx) => {
    const sigUrl = d.customerSignature?.url || (typeof d.customerSignature === 'string' ? d.customerSignature : '') || 'None';
    const photoUrls = (d.customerProofPhotos || [])
      .map((p) => (typeof p === 'string' ? p : p?.url || p?.uri || ''))
      .filter(Boolean)
      .join('\n') || 'None';

    const inLat = d.checkInLocation?.latitude || d.location?.latitude;
    const inLng = d.checkInLocation?.longitude || d.location?.longitude;
    const inMapsLink = inLat && inLng ? `https://maps.google.com/?q=${inLat},${inLng}` : 'N/A';
    const inAddr = d.checkInLocation?.address || d.location?.address || (inLat && inLng ? `${inLat}, ${inLng}` : 'N/A');

    const outLat = d.checkOutLocation?.latitude;
    const outLng = d.checkOutLocation?.longitude;
    const outMapsLink = outLat && outLng ? `https://maps.google.com/?q=${outLat},${outLng}` : 'N/A';
    const outAddr = d.checkOutLocation?.address || (outLat && outLng ? `${outLat}, ${outLng}` : 'N/A');

    const featuresStr = (d.features || []).filter(Boolean).join(', ') || 'None';
    const manpowerStr = (d.manpowerMembers || [])
      .filter((m) => m && m.name)
      .map((m) => `${m.name}${m.phoneNumber || m.phone ? ` (${m.phoneNumber || m.phone})` : ''}`)
      .join('; ') || 'None';

    const expClaims = d.linkedExpenses || [];
    const expBreakdown = expClaims
      .map((exp) => {
        const items = (exp.items || [])
          .map((it) => `${it.categoryName}: ₹${it.amount}${it.calculationMode === 'automatic' ? ` (${it.totalDistance || ((it.outboundDistance||0)+(it.returnDistance||0))} km @ ₹${it.ratePerUnit}/km)` : ''}`)
          .join(', ');
        return `Claim #${exp.expenseId || 'EXP'}: ₹${exp.grandTotal || 0} [${items}]`;
      })
      .join('\n') || 'None';

    const receiptUrls = expClaims
      .flatMap((exp) =>
        (exp.items || []).flatMap((it) =>
          (it.attachments || []).map((a) => (typeof a === 'string' ? a : a?.url || a?.uri || ''))
        )
      )
      .filter(Boolean)
      .join('\n') || 'None';

    wsDuties.addRow([
      idx + 1,
      d.dutyId,
      d.dutyDateStr,
      d.employee?.employeeId || 'N/A',
      d.employee?.employeeName || 'N/A',
      d.company?.companyName || 'N/A',
      d.customerName || 'N/A',
      d.dutyType === 'office' ? 'Office' : 'Client Site',
      d.inTime,
      d.outTime,
      d.workingHours,
      d.otHours,
      d.machineName,
      d.workType,
      featuresStr,
      manpowerStr,
      d.workDescription,
      inAddr,
      inMapsLink,
      outAddr,
      outMapsLink,
      sigUrl,
      photoUrls,
      d.totalExpenseAmount || 0,
      expBreakdown,
      receiptUrls,
      (d.status || '').toUpperCase(),
    ]);
  });
  applyTableStyling(wsDuties, 4);

  // ==========================================
  // Sheet 4: Employee Details
  // ==========================================
  const wsEmployees = workbook.addWorksheet('Employee Details');
  addReportHeader(wsEmployees, 'Employee Directory, Performance & Attendance Metrics');
  wsEmployees.addRow([
    'Sl No',
    'Employee ID',
    'Employee Name',
    'Designation',
    'Phone Number',
    'Email Address',
    'Date of Joining',
    'Assigned Companies',
    'Total Duties',
    'Days Worked',
    'Total Hours Worked',
    'Total OT Hours',
    'Casual Leaves Taken',
    'Comp-Off Leaves Taken',
    'Comp-Off Credits Earned',
    'Total Expenses Claimed (₹)',
  ]);

  reportData.employees.forEach((emp, idx) => {
    wsEmployees.addRow([
      idx + 1,
      emp.employeeId,
      emp.employeeName,
      emp.designation,
      emp.phoneNumber || 'N/A',
      emp.email,
      emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString('en-GB') : 'N/A',
      (emp.assignedCompanies || []).join(', ') || 'None',
      emp.totalDuties,
      emp.totalWorkingDays,
      emp.totalWorkingHours,
      emp.totalOtHours,
      emp.casualLeaveDays,
      emp.compOffLeaveDays,
      emp.compOffCreditsEarned,
      emp.totalExpensesClaimed,
    ]);
  });
  applyTableStyling(wsEmployees, 4);

  // ==========================================
  // Sheet 5: Attendance & Working Days
  // ==========================================
  const wsAttendance = workbook.addWorksheet('Attendance & Working Days');
  addReportHeader(wsAttendance, 'Daily Staff Attendance & Working Log');
  wsAttendance.addRow([
    'Sl No',
    'Date',
    'Work ID',
    'Employee ID',
    'Employee Name',
    'Company / Office',
    'Check-In (IST)',
    'Check-Out (IST)',
    'Duration (Minutes)',
    'Working Hours',
    'Sunday OT Hours',
    'Check-In Address',
    'Check-In Maps Link',
    'Check-Out Address',
    'Check-Out Maps Link',
    'Duty Status',
  ]);

  reportData.duties.forEach((d, idx) => {
    const inLat = d.checkInLocation?.latitude || d.location?.latitude;
    const inLng = d.checkInLocation?.longitude || d.location?.longitude;
    const inMapsLink = inLat && inLng ? `https://maps.google.com/?q=${inLat},${inLng}` : 'N/A';
    const inAddr = d.checkInLocation?.address || d.location?.address || (inLat && inLng ? `${inLat}, ${inLng}` : 'N/A');

    const outLat = d.checkOutLocation?.latitude;
    const outLng = d.checkOutLocation?.longitude;
    const outMapsLink = outLat && outLng ? `https://maps.google.com/?q=${outLat},${outLng}` : 'N/A';
    const outAddr = d.checkOutLocation?.address || (outLat && outLng ? `${outLat}, ${outLng}` : 'N/A');

    wsAttendance.addRow([
      idx + 1,
      d.dutyDateStr,
      d.dutyId,
      d.employee?.employeeId || 'N/A',
      d.employee?.employeeName || 'N/A',
      d.company?.companyName || 'N/A',
      d.inTime,
      d.outTime,
      d.totalDurationMinutes,
      d.workingHours,
      d.otHours,
      inAddr,
      inMapsLink,
      outAddr,
      outMapsLink,
      (d.status || '').toUpperCase(),
    ]);
  });
  applyTableStyling(wsAttendance, 4);

  // ==========================================
  // Sheet 6: Leave & Comp-Off
  // ==========================================
  const wsLeaves = workbook.addWorksheet('Leave & Comp-Off');
  addReportHeader(wsLeaves, 'Employee Leave Applications & Sunday Comp-Off Credits');
  wsLeaves.addRow([
    'Sl No',
    'Employee ID',
    'Employee Name',
    'Leave / Credit Type',
    'Start Date / Sunday',
    'End Date',
    'Days / Units',
    'Reason / Notes',
    'Status',
    'Admin Remarks / Reviewer',
  ]);

  let leaveRowIdx = 1;
  reportData.leaves.forEach((l) => {
    wsLeaves.addRow([
      leaveRowIdx++,
      l.employee?.employeeId || 'N/A',
      l.employee?.employeeName || 'N/A',
      l.leaveType === 'comp_off' ? 'Comp-Off Leave' : 'Casual Leave',
      toISTDateString(l.startDate),
      toISTDateString(l.endDate),
      l.daysCount || 1,
      l.reason || 'N/A',
      (l.status || '').toUpperCase(),
      l.adminRemarks || (l.adminReviewer?.employeeName ? `Reviewed by ${l.adminReviewer.employeeName}` : 'N/A'),
    ]);
  });

  reportData.compOffCredits.forEach((c) => {
    wsLeaves.addRow([
      leaveRowIdx++,
      c.employee?.employeeId || 'N/A',
      c.employee?.employeeName || 'N/A',
      'Sunday Comp-Off Earned',
      c.sundayDateString || toISTDateString(c.sundayDate),
      c.sundayDateString || toISTDateString(c.sundayDate),
      1,
      c.notes || 'Earned from Sunday duty attendance',
      (c.status || 'earned').toUpperCase(),
      'Auto-awarded by system',
    ]);
  });
  applyTableStyling(wsLeaves, 4);

  // ==========================================
  // Sheet 7: Overtime (OT)
  // ==========================================
  const wsOt = workbook.addWorksheet('Overtime (OT)');
  addReportHeader(wsOt, 'Overtime (OT) Log (Duration Exceeding Standard 8-Hour Shift)');
  wsOt.addRow([
    'Sl No',
    'Date',
    'Work ID',
    'Employee ID',
    'Employee Name',
    'Company Name',
    'In Time (IST)',
    'Out Time (IST)',
    'Total Working Hours',
    'Standard Shift Hours',
    'OT Hours Recorded',
    'Work Type',
    'Duty Status',
  ]);

  reportData.overtimeRecords.forEach((ot, idx) => {
    wsOt.addRow([
      idx + 1,
      ot.dutyDateStr,
      ot.dutyId,
      ot.employee?.employeeId || 'N/A',
      ot.employee?.employeeName || 'N/A',
      ot.company?.companyName || 'N/A',
      ot.inTime,
      ot.outTime,
      ot.workingHours,
      8.0,
      ot.otHours,
      ot.workType,
      (ot.status || '').toUpperCase(),
    ]);
  });
  applyTableStyling(wsOt, 4);

  // ==========================================
  // Sheet 8: Expenses
  // ==========================================
  const wsExpenses = workbook.addWorksheet('Expenses');
  addReportHeader(wsExpenses, 'Employee Travel & Duty Expense Claims');
  wsExpenses.addRow([
    'Sl No',
    'Claim #',
    'Claim Date',
    'Employee ID',
    'Employee Name',
    'Company Name',
    'Related Duty ID',
    'Grand Total (₹)',
    'Item Categories & Breakdown',
    'Receipts Count',
    'Receipt Proof Links',
    'General Description',
    'Status',
  ]);

  reportData.expenses.forEach((exp, idx) => {
    const itemsStr = (exp.items || [])
      .map((it) => {
        const dist = it.calculationMode === 'automatic'
          ? ` (${it.totalDistance || ((it.outboundDistance || 0) + (it.returnDistance || 0))} km @ ₹${it.ratePerUnit}/km)`
          : '';
        return `${it.categoryName}: ₹${it.amount}${dist}`;
      })
      .join(' | ');

    const proofCount = (exp.items || []).reduce(
      (sum, it) => sum + (it.attachments || []).length,
      0
    );

    const receiptUrls = (exp.items || [])
      .flatMap((it) =>
        (it.attachments || []).map((a) => (typeof a === 'string' ? a : a?.url || a?.uri || ''))
      )
      .filter(Boolean)
      .join('\n') || 'None';

    wsExpenses.addRow([
      idx + 1,
      exp.expenseId || `EXP-${exp._id.toString().slice(-4).toUpperCase()}`,
      toISTDateString(exp.expenseDate),
      exp.employee?.employeeId || 'N/A',
      exp.employee?.employeeName || 'N/A',
      exp.company?.companyName || 'N/A',
      exp.duty?.dutyId || exp.relatedDuty || 'N/A',
      exp.grandTotal || 0,
      itemsStr,
      proofCount,
      receiptUrls,
      exp.generalDescription || '',
      (exp.status || 'APPROVED').toUpperCase(),
    ]);
  });
  applyTableStyling(wsExpenses, 4);

  // ==========================================
  // Sheet 9: Employee Calendar (if available)
  // ==========================================
  if (reportData.employeeCalendar && reportData.employeeCalendar.calendarDays) {
    const wsCalendar = workbook.addWorksheet('Employee Calendar');
    const emp = reportData.employeeCalendar.employee;
    addReportHeader(
      wsCalendar,
      `Individual Calendar Log for ${emp?.employeeName || 'Staff'} (${emp?.employeeId || ''})`
    );
    wsCalendar.addRow([
      'Sl No',
      'Date',
      'Day of Week',
      'Attendance & Day Status',
      'Working / Holiday',
      'Work ID / Company',
      'Timings (IST)',
      'Duration (Minutes)',
      'OT Hours',
      'Leave Type / Reason',
      'Comp-Off Credit Earned',
    ]);

    reportData.employeeCalendar.calendarDays.forEach((day, idx) => {
      wsCalendar.addRow([
        idx + 1,
        day.dateStr,
        day.dayName,
        day.status,
        day.isSunday ? 'Sunday Holiday' : day.isHoliday ? `Holiday (${day.holidayName})` : 'Working Day',
        day.duty ? `${day.duty.dutyId} • ${day.duty.companyName}` : 'N/A',
        day.duty ? `${day.duty.inTime} - ${day.duty.outTime}` : 'N/A',
        day.duty ? day.duty.durationMinutes : 0,
        day.duty ? day.duty.otHours : 0,
        day.leave ? `${day.leave.leaveType} (${day.leave.status})` : 'N/A',
        day.compOffEarned ? 'YES' : 'NO',
      ]);
    });
    applyTableStyling(wsCalendar, 4);
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};

