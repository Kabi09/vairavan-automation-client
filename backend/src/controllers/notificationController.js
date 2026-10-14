import User from '../models/User.js';
import Notification from '../models/Notification.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import notificationService from '../services/notificationService.js';

/**
 * @desc    Get user notifications (Admins see admin/broadcast notices, Employees see their own)
 * @route   GET /api/notifications
 * @access  Private
 */
export const getNotifications = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
  const skip = (page - 1) * limit;

  let query = {};

  if (req.user.role === 'admin') {
    query = {
      $or: [
        { recipient: req.user._id },
        { recipientRole: 'admin' },
        { recipientRole: 'all' },
        { sender: req.user._id, type: 'message' },
      ],
    };
  } else {
    query = {
      $or: [
        { recipient: req.user._id },
        { recipientRole: 'employee' },
        { recipientRole: 'all' },
      ],
    };
  }

  if (req.query.type) {
    if (req.query.type === 'message' && req.user.role === 'admin') {
      query = { type: 'message', sender: req.user._id };
    } else {
      query.type = req.query.type;
    }
  }

  const [notifications, total] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('sender', 'employeeName employeeId role email')
      .populate('data.leaveId'),
    Notification.countDocuments(query),
  ]);

  // Calculate unread count specifically for this user
  const unreadCount = await Notification.countDocuments({
    ...query,
    $and: [
      { isRead: false },
      { readBy: { $ne: req.user._id } },
    ],
  });

  // Map notifications to indicate user-specific read status
  const formattedNotifications = notifications.map((n) => {
    const isUserRead = n.isRead || (n.readBy && n.readBy.some((id) => id.toString() === req.user._id.toString()));
    return {
      ...n.toObject(),
      isRead: !!isUserRead,
    };
  });

  return ApiResponse.success(res, 200, 'Notifications retrieved successfully', {
    notifications: formattedNotifications,
    unreadCount,
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
 * @desc    Mark a notification as read
 * @route   PATCH /api/notifications/:id/read
 * @access  Private
 */
export const markAsRead = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const notification = await Notification.findById(id);
  if (!notification) {
    throw ApiError.notFound('Notification not found');
  }

  notification.isRead = true;
  if (!notification.readBy.some((uid) => uid.toString() === req.user._id.toString())) {
    notification.readBy.push(req.user._id);
  }

  await notification.save();

  return ApiResponse.success(res, 200, 'Notification marked as read', {
    notification,
  });
});

/**
 * @desc    Mark all user notifications as read
 * @route   PATCH /api/notifications/mark-all-read
 * @access  Private
 */
export const markAllAsRead = asyncHandler(async (req, res) => {
  let query = {};
  if (req.user.role === 'admin') {
    query = {
      $or: [
        { recipient: req.user._id },
        { recipientRole: 'admin' },
        { recipientRole: 'all' },
      ],
    };
  } else {
    query = {
      $or: [
        { recipient: req.user._id },
        { recipientRole: 'employee' },
        { recipientRole: 'all' },
      ],
    };
  }

  await Notification.updateMany(query, {
    $set: { isRead: true },
    $addToSet: { readBy: req.user._id },
  });

  return ApiResponse.success(res, 200, 'All notifications marked as read');
});

/**
 * @desc    Delete a notification
 * @route   DELETE /api/notifications/:id
 * @access  Private
 */
export const deleteNotification = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const notification = await Notification.findById(id);
  if (!notification) {
    throw ApiError.notFound('Notification not found');
  }

  // Security: only sender, direct recipient, or admin can delete
  if (
    notification.recipient?.toString() !== req.user._id.toString() &&
    req.user.role !== 'admin'
  ) {
    throw ApiError.forbidden('You do not have permission to delete this notification');
  }

  await Notification.findByIdAndDelete(id);

  return ApiResponse.success(res, 200, 'Notification deleted successfully');
});

/**
 * @desc    Register a device token for push notifications
 * @route   POST /api/notifications/register-token
 * @access  Private
 */
export const registerDeviceToken = asyncHandler(async (req, res) => {
  const { deviceToken } = req.body;

  if (!deviceToken || typeof deviceToken !== 'string') {
    throw ApiError.badRequest('Valid deviceToken string is required');
  }

  const trimmed = deviceToken.trim();

  await User.findByIdAndUpdate(req.user._id, {
    $addToSet: { deviceTokens: trimmed },
  });

  return ApiResponse.success(res, 200, 'Device token registered successfully');
});

/**
 * @desc    Remove/unregister a device token (e.g. on device logout)
 * @route   POST /api/notifications/remove-token
 * @access  Private
 */
export const removeDeviceToken = asyncHandler(async (req, res) => {
  const { deviceToken } = req.body;

  if (!deviceToken) {
    throw ApiError.badRequest('deviceToken is required');
  }

  await User.findByIdAndUpdate(req.user._id, {
    $pull: { deviceTokens: deviceToken.trim() },
  });

  return ApiResponse.success(res, 200, 'Device token removed successfully');
});

/**
 * @desc    Admin send message/announcement to employees (all or selected)
 * @route   POST /api/notifications/send-message
 * @access  Private (Admin only)
 */
export const sendMessageNotification = asyncHandler(async (req, res) => {
  const { message, sendToAll, recipientIds } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    throw ApiError.badRequest('Message text is required');
  }

  const trimmedMessage = message.trim();
  const isAll =
    sendToAll === true ||
    sendToAll === 'true' ||
    !recipientIds ||
    recipientIds.length === 0 ||
    recipientIds === 'all';

  let recipientsNotifiedCount = 0;

  if (isAll) {
    // 1. Broadcast notification to all employees
    const broadcastNotif = await Notification.create({
      recipientRole: 'employee',
      sender: req.user._id,
      type: 'message',
      title: 'Message from Admin',
      message: trimmedMessage,
      data: {
        messageText: trimmedMessage,
        senderName: req.user.employeeName || 'Management',
        senderId: req.user._id,
        isBroadcast: true,
      },
    });

    // 2. Dispatch push notification to all employees
    const allEmployees = await User.find({
      role: { $in: ['employee', 'staff'] },
      accountStatus: 'active',
    }).select('_id');
    recipientsNotifiedCount = allEmployees.length;

    try {
      await notificationService.notifyAllEmployees(
        {
          title: 'Message from Admin',
          body: trimmedMessage,
        },
        {
          type: 'message',
          notificationId: broadcastNotif._id.toString(),
          messageText: trimmedMessage,
          senderName: req.user.employeeName || 'Management',
        }
      );
    } catch (pushErr) {
      console.warn('[Push] Error broadcasting message to employees:', pushErr.message);
    }

    return ApiResponse.success(res, 201, 'Message broadcasted to all employees successfully', {
      notification: broadcastNotif,
      recipientsCount: recipientsNotifiedCount,
      target: 'all',
    });
  } else {
    // Target specific employees
    const ids = Array.isArray(recipientIds) ? recipientIds : [recipientIds];
    const targetEmployees = await User.find({
      _id: { $in: ids },
      accountStatus: 'active',
    }).select('_id employeeName deviceTokens');

    if (targetEmployees.length === 0) {
      throw ApiError.badRequest('No valid active recipient employees found');
    }

    const createdNotifications = [];
    for (const emp of targetEmployees) {
      const notif = await Notification.create({
        recipient: emp._id,
        sender: req.user._id,
        type: 'message',
        title: 'Message from Admin',
        message: trimmedMessage,
        data: {
          messageText: trimmedMessage,
          senderName: req.user.employeeName || 'Management',
          senderId: req.user._id,
          recipientName: emp.employeeName,
          isBroadcast: false,
        },
      });
      createdNotifications.push(notif);

      try {
        await notificationService.sendNotificationToUser(
          emp._id,
          {
            title: 'Message from Admin',
            body: trimmedMessage,
          },
          {
            type: 'message',
            notificationId: notif._id.toString(),
            messageText: trimmedMessage,
            senderName: req.user.employeeName || 'Management',
          }
        );
      } catch (pushErr) {
        console.warn(`[Push] Error sending message to user ${emp._id}:`, pushErr.message);
      }
    }

    recipientsNotifiedCount = targetEmployees.length;

    return ApiResponse.success(res, 201, `Message sent to ${recipientsNotifiedCount} employee(s) successfully`, {
      notifications: createdNotifications,
      recipientsCount: recipientsNotifiedCount,
      target: 'selected',
    });
  }
});

export default {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  registerDeviceToken,
  removeDeviceToken,
  sendMessageNotification,
};
