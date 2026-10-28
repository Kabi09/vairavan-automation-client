import Leave from '../models/Leave.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import LeaveConfig from '../models/LeaveConfig.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import notificationService from '../services/notificationService.js';
import {
  calculateLeaveWorkingDays,
  getEmployeeLeaveBalances,
  getActiveLeaveConfig,
} from '../services/leaveService.js';

/**
 * @desc    Submit a leave request
 * @route   POST /api/leaves
 * @access  Private/Employee
 */
export const createLeave = asyncHandler(async (req, res) => {
  const { reason, startDate, endDate, leaveType = 'casual_leave' } = req.body;

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end < start) {
    throw ApiError.badRequest('End date cannot be earlier than start date');
  }

  // Prevent overlapping pending or approved leave requests for this employee
  const overlappingLeave = await Leave.findOne({
    employee: req.user._id,
    status: { $in: ['pending', 'approved'] },
    startDate: { $lte: end },
    endDate: { $gte: start },
  });

  if (overlappingLeave) {
    throw ApiError.conflict(
      `You already have a ${overlappingLeave.status} leave request between ${overlappingLeave.startDate.toISOString().split('T')[0]} and ${overlappingLeave.endDate.toISOString().split('T')[0]}`
    );
  }

  // Calculate eligible working days (Mon-Sat, excluding Sundays and company holidays)
  const { totalWorkingDays } = await calculateLeaveWorkingDays(start, end);
  if (totalWorkingDays <= 0) {
    throw ApiError.badRequest(
      'Selected date range contains no scheduled working days. Sundays and company holidays are not counted as leave days.'
    );
  }

  const reqYear = start.getFullYear();

  // Validate balance
  const balances = await getEmployeeLeaveBalances(req.user._id, reqYear);
  const selectedType = leaveType === 'comp_off' ? 'comp_off' : 'casual_leave';

  if (selectedType === 'casual_leave') {
    if (totalWorkingDays > balances.casualLeave.available) {
      throw ApiError.badRequest(
        `Insufficient Casual Leave balance. Available: ${balances.casualLeave.available} day(s), Requested: ${totalWorkingDays} working day(s).`
      );
    }
  } else if (selectedType === 'comp_off') {
    if (totalWorkingDays > balances.compOff.available) {
      throw ApiError.badRequest(
        `Insufficient Comp-Off credits. Available: ${balances.compOff.available} credit(s), Requested: ${totalWorkingDays} working day(s).`
      );
    }
  }

  const leave = await Leave.create({
    employee: req.user._id,
    leaveType: selectedType,
    reason: reason.trim(),
    startDate: start,
    endDate: end,
    daysCount: totalWorkingDays,
    leaveYear: reqYear,
    status: 'pending',
  });

  const populatedLeave = await Leave.findById(leave._id).populate(
    'employee',
    'employeeName employeeId email'
  );

  const typeLabel = selectedType === 'comp_off' ? 'Comp-Off Leave' : 'Casual Leave';

  // Create in-app notification for Admins
  try {
    await Notification.create({
      recipientRole: 'admin',
      sender: req.user._id,
      type: 'leave_request',
      title: `New ${typeLabel} Request Submitted`,
      message: `${req.user.employeeName} (${req.user.employeeId}) requested ${totalWorkingDays} day(s) ${typeLabel}: ${reason.trim()}`,
      data: {
        leaveId: leave._id,
        leaveType: selectedType,
        daysCount: totalWorkingDays,
        employeeId: req.user.employeeId,
        employeeName: req.user.employeeName,
        employeeAvatar: typeof req.user.avatar === 'string' ? req.user.avatar : (req.user.avatar?.url || ''),
        reason: reason.trim(),
        startDate: start,
        endDate: end,
        status: 'pending',
      },
    });
  } catch (notifErr) {
    console.error('[Notification] Failed to create in-app notification:', notifErr.message);
  }

  // Notify Admins only via FCM
  const notificationPayload = {
    title: `New ${typeLabel} Request Submitted`,
    body: `${req.user.employeeName} (${req.user.employeeId}) requested ${totalWorkingDays} day(s) ${typeLabel} from ${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`,
  };

  try {
    await notificationService.notifyAdmins(notificationPayload, {
      leaveId: leave._id.toString(),
      employeeId: req.user._id.toString(),
      type: 'leave_request',
    });
  } catch (pushErr) {
    console.error('[FCM] Error dispatching leave creation push notifications to admin:', pushErr.message);
  }

  return ApiResponse.created(res, 'Leave request submitted successfully', {
    leave: populatedLeave,
  });
});

/**
 * @desc    Get authenticated employee's own leave requests
 * @route   GET /api/leaves/my
 * @access  Private/Employee
 */
export const getMyLeaves = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '10', 10)));
  const skip = (page - 1) * limit;

  const { status, year, leaveType } = req.query;

  const filter = { employee: req.user._id };

  if (status) {
    filter.status = status;
  }

  if (leaveType) {
    filter.leaveType = leaveType;
  }

  if (year) {
    const yr = parseInt(year, 10);
    filter.startDate = {
      $gte: new Date(`${yr}-01-01T00:00:00.000Z`),
      $lte: new Date(`${yr}-12-31T23:59:59.999Z`),
    };
  }

  const [leaves, total] = await Promise.all([
    Leave.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('adminReviewer', 'employeeName employeeId'),
    Leave.countDocuments(filter),
  ]);

  return ApiResponse.success(res, 200, 'Leave requests retrieved successfully', {
    leaves,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  });
});

/**
 * @desc    Get leave balances (CL & Comp-Off)
 * @route   GET /api/leaves/balances
 * @access  Private (Employee or Admin)
 */
export const getLeaveBalances = asyncHandler(async (req, res) => {
  let employeeId = req.user._id;

  if (req.query.employeeId && req.user.role === 'admin') {
    employeeId = req.query.employeeId;
  }

  const year = parseInt(req.query.year || new Date().getFullYear(), 10);
  const balances = await getEmployeeLeaveBalances(employeeId, year);

  return ApiResponse.success(res, 200, 'Leave balances retrieved successfully', balances);
});

/**
 * @desc    Get single leave request by ID
 * @route   GET /api/leaves/:id
 * @access  Private (Admin or request owner)
 */
export const getLeaveById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const leave = await Leave.findById(id)
    .populate('employee', 'employeeName employeeId email designation casualLeaveAllowance')
    .populate('adminReviewer', 'employeeName employeeId');

  if (!leave) {
    throw ApiError.notFound('Leave request not found');
  }

  // Security check: Employee can only view their own leave
  if (req.user.role !== 'admin' && leave.employee._id.toString() !== req.user._id.toString()) {
    throw ApiError.forbidden('You are not authorized to view this leave request');
  }

  return ApiResponse.success(res, 200, 'Leave request retrieved successfully', { leave });
});

/**
 * @desc    Get all leave requests (Admin only)
 * @route   GET /api/leaves
 * @access  Private/Admin
 */
export const getAllLeaves = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit || '20', 10)));
  const skip = (page - 1) * limit;

  const { status, employeeId, startDate, endDate, leaveType, year } = req.query;

  const filter = {};

  if (status) filter.status = status;
  if (employeeId) filter.employee = employeeId;
  if (leaveType) filter.leaveType = leaveType;

  if (year) {
    const yr = parseInt(year, 10);
    filter.startDate = {
      $gte: new Date(`${yr}-01-01T00:00:00.000Z`),
      $lte: new Date(`${yr}-12-31T23:59:59.999Z`),
    };
  }

  if (startDate || endDate) {
    filter.startDate = filter.startDate || {};
    if (startDate) filter.startDate.$gte = new Date(startDate);
    if (endDate) {
      const endD = new Date(endDate);
      endD.setHours(23, 59, 59, 999);
      filter.startDate.$lte = endD;
    }
  }

  const [leaves, total] = await Promise.all([
    Leave.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('employee', 'employeeName employeeId email designation casualLeaveAllowance')
      .populate('adminReviewer', 'employeeName employeeId'),
    Leave.countDocuments(filter),
  ]);

  return ApiResponse.success(res, 200, 'Leave requests retrieved successfully', {
    leaves,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  });
});

/**
 * @desc    Review leave request (Approve or Reject with optional rejection reason)
 * @route   PATCH /api/leaves/:id/review
 * @access  Private/Admin
 */
export const reviewLeave = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, adminRemarks, rejectionReason } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    throw ApiError.badRequest("Decision status must be either 'approved' or 'rejected'");
  }

  const leave = await Leave.findById(id).populate('employee', 'employeeName employeeId email avatar');
  if (!leave) {
    throw ApiError.notFound('Leave request not found');
  }

  if (leave.status === 'cancelled') {
    throw ApiError.badRequest('Cannot review a leave request that has already been cancelled');
  }

  const finalRemarks = adminRemarks || rejectionReason || '';

  // If approving, re-verify available balance
  if (status === 'approved') {
    const balances = await getEmployeeLeaveBalances(leave.employee._id, leave.leaveYear);
    const neededDays = leave.daysCount || 1;
    const type = leave.leaveType || 'casual_leave';

    if (type === 'casual_leave' && balances.casualLeave.available < neededDays) {
      throw ApiError.badRequest(
        `Cannot approve: Employee has only ${balances.casualLeave.available} available Casual Leave day(s), but this request requires ${neededDays} day(s).`
      );
    }

    if (type === 'comp_off' && balances.compOff.available < neededDays) {
      throw ApiError.badRequest(
        `Cannot approve: Employee has only ${balances.compOff.available} available Comp-Off credit(s), but this request requires ${neededDays} credit(s).`
      );
    }
  }

  leave.status = status;
  leave.adminReviewer = req.user._id;
  leave.adminRemarks = finalRemarks;
  leave.rejectionReason = status === 'rejected' ? finalRemarks : '';
  leave.reviewedAt = new Date();

  await leave.save();

  // Update existing admin in-app notification state
  try {
    await Notification.updateMany(
      { 'data.leaveId': leave._id },
      {
        $set: {
          'data.status': status,
          'data.adminRemarks': finalRemarks,
          isRead: true,
        },
      }
    );

    // Create in-app notification for the employee
    if (leave.employee) {
      await Notification.create({
        recipient: leave.employee._id,
        sender: req.user._id,
        type: 'leave_reviewed',
        title: `Leave Request ${status === 'approved' ? 'Approved' : 'Rejected'}`,
        message: `Your leave request from ${leave.startDate.toISOString().split('T')[0]} to ${leave.endDate.toISOString().split('T')[0]} has been ${status}.${finalRemarks ? ` Remarks: ${finalRemarks}` : ''}`,
        data: {
          leaveId: leave._id,
          employeeId: leave.employee.employeeId,
          employeeName: leave.employee.employeeName,
          employeeAvatar: typeof leave.employee.avatar === 'string' ? leave.employee.avatar : (leave.employee.avatar?.url || ''),
          reason: leave.reason,
          startDate: leave.startDate,
          endDate: leave.endDate,
          status,
          adminRemarks: finalRemarks,
        },
      });
    }
  } catch (notifErr) {
    console.error('[Notification] Error updating in-app notifications on leave review:', notifErr.message);
  }

  // Notify Employee via FCM
  if (leave.employee) {
    const pushPayload = {
      title: `Leave Request ${status === 'approved' ? 'Approved' : 'Rejected'}`,
      body: `Your leave request has been ${status}.${finalRemarks ? ` Remarks: ${finalRemarks}` : ''}`,
    };

    try {
      await notificationService.sendNotificationToUser(leave.employee._id, pushPayload, {
        leaveId: leave._id.toString(),
        type: 'leave_reviewed',
        status,
      });
    } catch (pushErr) {
      console.error('[FCM] Error dispatching leave review push notification to employee:', pushErr.message);
    }
  }

  return ApiResponse.success(res, 200, `Leave request ${status} successfully`, { leave });
});

/**
 * @desc    Cancel a pending leave request (Employee only)
 * @route   PATCH /api/leaves/:id/cancel
 * @access  Private/Employee
 */
export const cancelLeave = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const leave = await Leave.findById(id);
  if (!leave) {
    throw ApiError.notFound('Leave request not found');
  }

  // Security: only the owner can cancel
  if (leave.employee.toString() !== req.user._id.toString()) {
    throw ApiError.forbidden('You can only cancel your own leave requests');
  }

  if (leave.status !== 'pending') {
    throw ApiError.badRequest(
      `Cannot cancel leave request that is already ${leave.status}. Please contact an administrator.`
    );
  }

  leave.status = 'cancelled';
  await leave.save();

  return ApiResponse.success(res, 200, 'Leave request has been cancelled successfully', {
    leave,
  });
});

/**
 * @desc    Get leave rules configuration
 * @route   GET /api/leaves/config
 * @access  Private/Admin
 */
export const getLeaveConfig = asyncHandler(async (req, res) => {
  const config = await getActiveLeaveConfig();
  return ApiResponse.success(res, 200, 'Leave configuration retrieved', { config });
});

/**
 * @desc    Update annual CL allowance and leave rules configuration
 * @route   PATCH /api/leaves/config
 * @access  Private/Admin
 */
export const updateLeaveConfig = asyncHandler(async (req, res) => {
  const { defaultCasualLeaveAllowance, leaveYear, weeklyHoliday, workingDays } = req.body;
  const config = await getActiveLeaveConfig();

  if (defaultCasualLeaveAllowance !== undefined) {
    config.defaultCasualLeaveAllowance = Math.max(1, Number(defaultCasualLeaveAllowance));
  }
  if (leaveYear !== undefined) {
    config.leaveYear = Number(leaveYear);
  }
  if (weeklyHoliday) {
    config.weeklyHoliday = weeklyHoliday;
  }
  if (Array.isArray(workingDays) && workingDays.length > 0) {
    config.workingDays = workingDays;
  }

  await config.save();
  return ApiResponse.success(res, 200, 'Leave configuration updated successfully', { config });
});

/**
 * @desc    Update specific employee's casual leave allowance
 * @route   PATCH /api/leaves/employee-allowance/:id
 * @access  Private/Admin
 */
export const updateEmployeeAllowance = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { casualLeaveAllowance } = req.body;

  const employee = await User.findById(id);
  if (!employee) {
    throw ApiError.notFound('Employee not found');
  }

  if (casualLeaveAllowance !== undefined) {
    employee.casualLeaveAllowance = Math.max(0, Number(casualLeaveAllowance));
    await employee.save();
  }

  return ApiResponse.success(res, 200, 'Employee CL allowance updated successfully', {
    employee: {
      _id: employee._id,
      employeeName: employee.employeeName,
      employeeId: employee.employeeId,
      casualLeaveAllowance: employee.casualLeaveAllowance,
    },
  });
});

/**
 * @desc    Admin directly grants/assigns leave to an employee without prior request
 * @route   POST /api/leaves/admin-grant
 * @access  Private/Admin
 */
export const adminGrantLeave = asyncHandler(async (req, res) => {
  const {
    employeeId,
    startDate,
    endDate,
    leaveType = 'casual_leave',
    reason = 'Directly granted by Administrator',
    adminRemarks,
  } = req.body;

  const targetEmployee = await User.findById(employeeId);
  if (!targetEmployee) {
    throw ApiError.notFound('Employee not found');
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end < start) {
    throw ApiError.badRequest('End date cannot be earlier than start date');
  }

  // Prevent overlapping approved or pending leave requests
  const overlappingLeave = await Leave.findOne({
    employee: targetEmployee._id,
    status: { $in: ['pending', 'approved'] },
    startDate: { $lte: end },
    endDate: { $gte: start },
  });

  if (overlappingLeave) {
    const sStr = overlappingLeave.startDate.toISOString().split('T')[0];
    const eStr = overlappingLeave.endDate.toISOString().split('T')[0];
    throw ApiError.conflict(
      `Employee already has a ${overlappingLeave.status} leave record from ${sStr} to ${eStr}`
    );
  }

  // Calculate eligible working days (Mon-Sat, excluding Sundays and company holidays)
  const { totalWorkingDays } = await calculateLeaveWorkingDays(start, end);
  if (totalWorkingDays <= 0) {
    throw ApiError.badRequest(
      'Selected date range contains no scheduled working days. Sundays and company holidays are not counted as leave days.'
    );
  }

  const reqYear = start.getFullYear();
  const balances = await getEmployeeLeaveBalances(targetEmployee._id, reqYear);
  const selectedType = leaveType === 'comp_off' ? 'comp_off' : 'casual_leave';

  if (selectedType === 'casual_leave') {
    if (totalWorkingDays > balances.casualLeave.available) {
      throw ApiError.badRequest(
        `Insufficient Casual Leave balance. Employee has only ${balances.casualLeave.available} available day(s), but this grant requires ${totalWorkingDays} working day(s).`
      );
    }
  } else if (selectedType === 'comp_off') {
    if (totalWorkingDays > balances.compOff.available) {
      throw ApiError.badRequest(
        `Insufficient Comp-Off credits. Employee has only ${balances.compOff.available} available credit(s), but this grant requires ${totalWorkingDays} working day(s).`
      );
    }
  }

  const finalReason = (reason && reason.trim()) ? reason.trim() : 'Assigned by Administrator';
  const finalRemarks = (adminRemarks && adminRemarks.trim()) ? adminRemarks.trim() : 'Granted directly by Admin';

  const leave = await Leave.create({
    employee: targetEmployee._id,
    leaveType: selectedType,
    reason: finalReason,
    startDate: start,
    endDate: end,
    daysCount: totalWorkingDays,
    leaveYear: reqYear,
    status: 'approved',
    adminReviewer: req.user._id,
    adminRemarks: finalRemarks,
    reviewedAt: new Date(),
  });

  const populatedLeave = await Leave.findById(leave._id)
    .populate('employee', 'employeeName employeeId email designation casualLeaveAllowance')
    .populate('adminReviewer', 'employeeName employeeId');

  const typeLabel = selectedType === 'comp_off' ? 'Comp-Off Leave' : 'Casual Leave';
  const startStr = start.toISOString().split('T')[0];
  const endStr = end.toISOString().split('T')[0];

  // Notify the employee in-app
  try {
    await Notification.create({
      recipient: targetEmployee._id,
      sender: req.user._id,
      type: 'leave_reviewed',
      title: `${typeLabel} Granted by Management`,
      message: `Management has assigned you ${totalWorkingDays} day(s) of ${typeLabel} from ${startStr} to ${endStr}. Remarks: ${finalRemarks}`,
      data: {
        leaveId: leave._id,
        leaveType: selectedType,
        daysCount: totalWorkingDays,
        employeeId: targetEmployee.employeeId,
        employeeName: targetEmployee.employeeName,
        employeeAvatar: typeof targetEmployee.avatar === 'string' ? targetEmployee.avatar : (targetEmployee.avatar?.url || ''),
        reason: finalReason,
        startDate: start,
        endDate: end,
        status: 'approved',
        adminRemarks: finalRemarks,
      },
    });
  } catch (notifErr) {
    console.error('[Notification] Error creating in-app notification for admin grant:', notifErr.message);
  }

  // Push notification via FCM
  try {
    await notificationService.sendNotificationToUser(
      targetEmployee._id,
      {
        title: `${typeLabel} Granted by Management`,
        body: `You have been granted ${totalWorkingDays} day(s) of ${typeLabel} from ${startStr} to ${endStr}`,
      },
      {
        leaveId: leave._id.toString(),
        type: 'leave_reviewed',
        status: 'approved',
      }
    );
  } catch (pushErr) {
    console.error('[FCM] Error dispatching push notification for admin grant:', pushErr.message);
  }

  return ApiResponse.created(res, `${typeLabel} granted successfully to ${targetEmployee.employeeName}`, {
    leave: populatedLeave,
  });
});

export default {
  createLeave,
  adminGrantLeave,
  getMyLeaves,
  getLeaveBalances,
  getLeaveById,
  getAllLeaves,
  reviewLeave,
  cancelLeave,
  getLeaveConfig,
  updateLeaveConfig,
  updateEmployeeAllowance,
};

