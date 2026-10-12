import Leave from '../models/Leave.js';
import Notification from '../models/Notification.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import notificationService from '../services/notificationService.js';

/**
 * @desc    Submit a leave request
 * @route   POST /api/leaves
 * @access  Private/Employee
 */
export const createLeave = asyncHandler(async (req, res) => {
  const { reason, startDate, endDate } = req.body;

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

  const leave = await Leave.create({
    employee: req.user._id,
    reason: reason.trim(),
    startDate: start,
    endDate: end,
    status: 'pending',
  });

  const populatedLeave = await Leave.findById(leave._id).populate(
    'employee',
    'employeeName employeeId email'
  );

  // Create in-app notification for Admins
  try {
    await Notification.create({
      recipientRole: 'admin',
      sender: req.user._id,
      type: 'leave_request',
      title: 'New Leave Request Submitted',
      message: `${req.user.employeeName} (${req.user.employeeId}) requested leave: ${reason.trim()}`,
      data: {
        leaveId: leave._id,
        employeeId: req.user.employeeId,
        employeeName: req.user.employeeName,
        reason: reason.trim(),
        startDate: start,
        endDate: end,
        status: 'pending',
      },
    });
  } catch (notifErr) {
    console.error('[Notification] Failed to create in-app notification:', notifErr.message);
  }

  // Notify Admins and submitting Employee via FCM (await dispatch to ensure delivery before serverless runtime terminates)
  const notificationPayload = {
    title: 'New Leave Request Submitted',
    body: `${req.user.employeeName} (${req.user.employeeId}) requested leave from ${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`,
  };
  const employeePayload = {
    title: 'Leave Request Submitted',
    body: `Your leave request from ${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]} was submitted successfully.`,
  };

  try {
    await Promise.allSettled([
      notificationService.notifyAdmins(notificationPayload, {
        leaveId: leave._id.toString(),
        employeeId: req.user._id.toString(),
        type: 'leave_request',
      }),
      notificationService.sendNotificationToUser(req.user._id, employeePayload, {
        leaveId: leave._id.toString(),
        status: 'pending',
        type: 'leave_confirmation',
      }),
    ]);
  } catch (pushErr) {
    console.error('[FCM] Error dispatching leave creation push notifications:', pushErr.message);
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

  const { status, year } = req.query;

  const filter = { employee: req.user._id };

  if (status) {
    filter.status = status;
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
 * @desc    Get single leave request by ID
 * @route   GET /api/leaves/:id
 * @access  Private (Admin or request owner)
 */
export const getLeaveById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const leave = await Leave.findById(id)
    .populate('employee', 'employeeName employeeId email designation')
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

  const { status, employeeId, startDate, endDate } = req.query;

  const filter = {};

  if (status) filter.status = status;
  if (employeeId) filter.employee = employeeId;

  if (startDate || endDate) {
    filter.startDate = {};
    if (startDate) filter.startDate.$gte = new Date(startDate);
    if (endDate) filter.startDate.$lte = new Date(endDate);
  }

  const [leaves, total] = await Promise.all([
    Leave.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('employee', 'employeeName employeeId email designation')
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
 * @desc    Review leave request (Approve or Reject)
 * @route   PATCH /api/leaves/:id/review
 * @access  Private/Admin
 */
export const reviewLeave = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, adminRemarks } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    throw ApiError.badRequest("Decision status must be either 'approved' or 'rejected'");
  }

  const leave = await Leave.findById(id).populate('employee', 'employeeName employeeId');
  if (!leave) {
    throw ApiError.notFound('Leave request not found');
  }

  if (leave.status === 'cancelled') {
    throw ApiError.badRequest('Cannot review a leave request that has already been cancelled');
  }

  leave.status = status;
  leave.adminReviewer = req.user._id;
  leave.adminRemarks = adminRemarks || '';
  leave.reviewedAt = new Date();

  await leave.save();

  // Update existing admin in-app notification state
  try {
    await Notification.updateMany(
      { 'data.leaveId': leave._id },
      {
        $set: {
          'data.status': status,
          'data.adminRemarks': adminRemarks || '',
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
        message: `Your leave request from ${leave.startDate.toISOString().split('T')[0]} to ${leave.endDate.toISOString().split('T')[0]} has been ${status}.${adminRemarks ? ` Remarks: ${adminRemarks}` : ''}`,
        data: {
          leaveId: leave._id,
          employeeId: leave.employee.employeeId,
          employeeName: leave.employee.employeeName,
          reason: leave.reason,
          startDate: leave.startDate,
          endDate: leave.endDate,
          status,
          adminRemarks: adminRemarks || '',
        },
      });
    }
  } catch (notifErr) {
    console.error('[Notification] Error updating in-app notifications on leave review:', notifErr.message);
  }

  // Send push notification to the employee (await dispatch to ensure delivery before serverless runtime terminates)
  if (leave.employee) {
    const notificationPayload = {
      title: `Leave Request ${status === 'approved' ? 'Approved' : 'Rejected'}`,
      body: `Your leave request from ${leave.startDate.toISOString().split('T')[0]} to ${leave.endDate.toISOString().split('T')[0]} has been ${status}.${adminRemarks ? ` Remarks: ${adminRemarks}` : ''}`,
    };
    try {
      await notificationService.sendNotificationToUser(leave.employee._id, notificationPayload, {
        leaveId: leave._id.toString(),
        status,
        type: 'leave_reviewed',
      });
    } catch (pushErr) {
      console.error('[FCM] Error notifying employee on leave decision:', pushErr.message);
    }
  }

  return ApiResponse.success(res, 200, `Leave request has been ${status} successfully`, {
    leave,
  });
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

export default {
  createLeave,
  getMyLeaves,
  getLeaveById,
  getAllLeaves,
  reviewLeave,
  cancelLeave,
};
