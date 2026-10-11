import { getMessaging } from '../config/firebase.js';
import User from '../models/User.js';

/**
 * Send push notification to a list of device registration tokens.
 * Handles invalid/expired tokens by automatically pruning them from the user model.
 * Never throws an uncaught error to prevent failing the primary business operation.
 */
export const sendMulticastNotification = async (tokens, notificationPayload, dataPayload = {}) => {
  if (!tokens || tokens.length === 0) {
    return { success: true, deliveredCount: 0, failedCount: 0 };
  }

  const messaging = getMessaging();
  if (!messaging) {
    console.log(`[FCM Mock] Push notification simulated to ${tokens.length} tokens: "${notificationPayload.title}"`);
    return { success: true, deliveredCount: tokens.length, failedCount: 0, mock: true };
  }

  try {
    const stringifiedData = {};
    for (const [key, value] of Object.entries(dataPayload)) {
      stringifiedData[key] = typeof value === 'string' ? value : JSON.stringify(value);
    }

    const message = {
      tokens,
      notification: {
        title: notificationPayload.title,
        body: notificationPayload.body,
      },
      data: stringifiedData,
    };

    const response = await messaging.sendEachForMulticast(message);
    const tokensToRemove = [];

    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const error = resp.error;
        if (
          error &&
          (error.code === 'messaging/invalid-registration-token' ||
            error.code === 'messaging/registration-token-not-registered')
        ) {
          tokensToRemove.push(tokens[idx]);
        }
      }
    });

    if (tokensToRemove.length > 0) {
      // Clean up stale tokens asynchronously
      User.updateMany(
        { deviceTokens: { $in: tokensToRemove } },
        { $pull: { deviceTokens: { $in: tokensToRemove } } }
      ).catch((err) => console.error('[FCM] Error pruning invalid tokens:', err.message));
    }

    return {
      success: true,
      deliveredCount: response.successCount,
      failedCount: response.failureCount,
    };
  } catch (error) {
    console.error(`[FCM] Notification delivery failed: ${error.message}`);
    return { success: false, deliveredCount: 0, failedCount: tokens.length, error: error.message };
  }
};

/**
 * Send notification to a specific user by userId
 */
export const sendNotificationToUser = async (userId, notificationPayload, dataPayload = {}) => {
  try {
    const user = await User.findById(userId).select('deviceTokens');
    if (!user || !user.deviceTokens || user.deviceTokens.length === 0) {
      return { success: true, message: 'No registered devices found for user' };
    }
    return await sendMulticastNotification(user.deviceTokens, notificationPayload, dataPayload);
  } catch (error) {
    console.error(`[FCM] Failed to send notification to user ${userId}:`, error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send notification to all active Admin users
 */
export const notifyAdmins = async (notificationPayload, dataPayload = {}) => {
  try {
    const admins = await User.find({ role: 'admin', accountStatus: 'active' }).select('deviceTokens');
    const allAdminTokens = admins.flatMap((admin) => admin.deviceTokens || []);
    const uniqueTokens = [...new Set(allAdminTokens)];
    return await sendMulticastNotification(uniqueTokens, notificationPayload, dataPayload);
  } catch (error) {
    console.error('[FCM] Failed to notify admins:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send notification to all active Employees
 */
export const notifyAllEmployees = async (notificationPayload, dataPayload = {}) => {
  try {
    const employees = await User.find({ role: 'employee', accountStatus: 'active' }).select('deviceTokens');
    const allEmployeeTokens = employees.flatMap((emp) => emp.deviceTokens || []);
    const uniqueTokens = [...new Set(allEmployeeTokens)];
    return await sendMulticastNotification(uniqueTokens, notificationPayload, dataPayload);
  } catch (error) {
    console.error('[FCM] Failed to notify employees:', error.message);
    return { success: false, error: error.message };
  }
};

export default {
  sendMulticastNotification,
  sendNotificationToUser,
  notifyAdmins,
  notifyAllEmployees,
};
