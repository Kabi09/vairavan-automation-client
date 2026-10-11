import User from '../models/User.js';
import Company from '../models/Company.js';
import Duty from '../models/Duty.js';
import Leave from '../models/Leave.js';
import Holiday from '../models/Holiday.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * @desc    Get aggregated metrics for Admin Dashboard
 * @route   GET /api/dashboard/admin
 * @access  Private/Admin
 */
export const getAdminDashboard = asyncHandler(async (req, res) => {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const todayEnd = new Date();
  todayEnd.setUTCHours(23, 59, 59, 999);

  const now = new Date();
  const next30Days = new Date();
  next30Days.setDate(next30Days.getDate() + 30);

  const [
    activeEmployeesCount,
    activeCompaniesCount,
    todayDutiesCount,
    pendingDutyReviewsCount,
    leaveMetrics,
    upcomingHolidays,
    recentDuties,
  ] = await Promise.all([
    // Total active employees
    User.countDocuments({ role: 'employee', accountStatus: 'active' }),

    // Total active companies
    Company.countDocuments({ status: 'active', isDeleted: false }),

    // Today's submitted duties
    Duty.countDocuments({
      dutyDate: { $gte: todayStart, $lte: todayEnd },
    }),

    // Duties awaiting review
    Duty.countDocuments({ status: 'submitted' }),

    // Aggregated leave counts
    Leave.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]),

    // Upcoming active holidays in next 30 days
    Holiday.find({
      status: 'active',
      isDeleted: false,
      endDate: { $gte: now },
      startDate: { $lte: next30Days },
    })
      .sort({ startDate: 1 })
      .limit(5),

    // Recent duty activity
    Duty.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('employee', 'employeeName employeeId')
      .populate('company', 'companyName')
      .select('customerName machineName workType status dutyDate createdAt'),
  ]);

  const leaveCounts = {
    pending: 0,
    approved: 0,
    rejected: 0,
    cancelled: 0,
  };

  leaveMetrics.forEach((item) => {
    if (leaveCounts[item._id] !== undefined) {
      leaveCounts[item._id] = item.count;
    }
  });

  return ApiResponse.success(res, 200, 'Admin dashboard metrics retrieved successfully', {
    metrics: {
      totalActiveEmployees: activeEmployeesCount,
      totalActiveCompanies: activeCompaniesCount,
      todaySubmittedDuties: todayDutiesCount,
      pendingDutyReviews: pendingDutyReviewsCount,
      leaves: {
        pending: leaveCounts.pending,
        approved: leaveCounts.approved,
        rejected: leaveCounts.rejected,
        cancelled: leaveCounts.cancelled,
      },
    },
    upcomingHolidays,
    recentDuties,
  });
});

/**
 * @desc    Get aggregated metrics for Employee Dashboard
 * @route   GET /api/dashboard/employee
 * @access  Private/Employee
 */
export const getEmployeeDashboard = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const todayEnd = new Date();
  todayEnd.setUTCHours(23, 59, 59, 999);

  const now = new Date();
  const next30Days = new Date();
  next30Days.setDate(next30Days.getDate() + 30);

  const [
    todayDuties,
    recentDuties,
    leaveMetrics,
    upcomingHolidays,
  ] = await Promise.all([
    // Today's duty reports submitted by this employee
    Duty.find({
      employee: userId,
      dutyDate: { $gte: todayStart, $lte: todayEnd },
    })
      .populate('company', 'companyName location')
      .sort({ inTime: 1 }),

    // Recent 5 duties by this employee
    Duty.find({ employee: userId })
      .sort({ dutyDate: -1, createdAt: -1 })
      .limit(5)
      .populate('company', 'companyName location')
      .select('customerName machineName workType status dutyDate inTime outTime'),

    // Leave counts for this employee
    Leave.aggregate([
      { $match: { employee: userId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]),

    // Upcoming active holidays
    Holiday.find({
      status: 'active',
      isDeleted: false,
      endDate: { $gte: now },
      startDate: { $lte: next30Days },
    })
      .sort({ startDate: 1 })
      .limit(5),
  ]);

  const leaveSummary = {
    pending: 0,
    approved: 0,
    rejected: 0,
    cancelled: 0,
  };

  leaveMetrics.forEach((item) => {
    if (leaveSummary[item._id] !== undefined) {
      leaveSummary[item._id] = item.count;
    }
  });

  return ApiResponse.success(res, 200, 'Employee dashboard retrieved successfully', {
    profile: {
      employeeName: req.user.employeeName,
      employeeId: req.user.employeeId,
      email: req.user.email,
      designation: req.user.designation,
      joiningDate: req.user.joiningDate,
    },
    todayDuties: {
      count: todayDuties.length,
      reports: todayDuties,
    },
    recentDuties,
    leaves: leaveSummary,
    upcomingHolidays,
  });
});

export default {
  getAdminDashboard,
  getEmployeeDashboard,
};
