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

  const stringifiedData = {};
  for (const [key, value] of Object.entries(dataPayload)) {
    stringifiedData[key] = typeof value === 'string' ? value : JSON.stringify(value);
  }

  // Separate tokens into Expo Push tokens and Firebase FCM tokens
  const expoTokens = tokens.filter(
    (t) => typeof t === 'string' && (t.startsWith('ExponentPushToken') || t.startsWith('ExpoPushToken'))
  );
  // FCM tokens are long alphanumeric/base64 strings (typically > 30 chars) and must not be mock/client placeholders
  const fcmTokens = tokens.filter(
    (t) =>
      typeof t === 'string' &&
      t.trim().length > 30 &&
      !t.startsWith('ExponentPushToken') &&
      !t.startsWith('ExpoPushToken') &&
      !t.startsWith('ExpoClient_') &&
      !t.startsWith('Test_') &&
      !t.startsWith('SAMPLE_')
  );

  let totalDelivered = 0;
  let totalFailed = 0;

  const logoImageUrl =
    notificationPayload.imageUrl ||
    'https://res.cloudinary.com/etdurbgp/image/upload/v1791802852/vairavan_app/app_logo.png';

  // 1. Deliver native FCM tokens via Firebase Admin SDK
  if (fcmTokens.length > 0) {
    const messaging = getMessaging();
    if (messaging) {
      try {
        const message = {
          tokens: fcmTokens,
          notification: {
            title: notificationPayload.title,
            body: notificationPayload.body,
            imageUrl: logoImageUrl,
          },
          data: {
            ...stringifiedData,
            imageUrl: logoImageUrl,
          },
          android: {
            priority: 'high',
            notification: {
              sound: 'default',
              channelId: 'default',
              priority: 'max',
              defaultSound: true,
              defaultVibrateTimings: true,
              imageUrl: logoImageUrl,
            },
          },
        };

        const response = await messaging.sendEachForMulticast(message);
        console.log(`[FCM] Sent to ${fcmTokens.length} devices: ${response.successCount} succeeded, ${response.failureCount} failed`);
        totalDelivered += response.successCount;
        totalFailed += response.failureCount;

        const tokensToRemove = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const error = resp.error;
            console.warn(`[FCM] Delivery failed for token: ${error?.message || 'Unknown error'}`);
            if (
              error &&
              (error.code === 'messaging/invalid-registration-token' ||
                error.code === 'messaging/registration-token-not-registered' ||
                error.code === 'messaging/invalid-argument')
            ) {
              tokensToRemove.push(fcmTokens[idx]);
            }
          }
        });

        if (tokensToRemove.length > 0) {
          await User.updateMany(
            { deviceTokens: { $in: tokensToRemove } },
            { $pull: { deviceTokens: { $in: tokensToRemove } } }
          ).catch((err) => console.error('[FCM] Error pruning invalid tokens:', err.message));
        }
      } catch (error) {
        console.error(`[FCM] Notification delivery failed: ${error.message}`);
        totalFailed += fcmTokens.length;
      }
    } else {
      console.log(`[FCM Mock] Push notification simulated to ${fcmTokens.length} tokens: "${notificationPayload.title}"`);
      totalDelivered += fcmTokens.length;
    }
  }

  // 2. Deliver Expo Push tokens via Expo Push Service API
  if (expoTokens.length > 0) {
    try {
      const expoMessages = expoTokens.map((to) => ({
        to,
        sound: 'default',
        title: notificationPayload.title,
        body: notificationPayload.body,
        data: {
          ...stringifiedData,
          imageUrl: logoImageUrl,
        },
        priority: 'high',
        channelId: 'default',
        richContent: {
          image: logoImageUrl,
        },
      }));

      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(expoMessages),
      });

      const json = await res.json();
      console.log(`[Expo Push Service] Dispatched push to ${expoTokens.length} devices:`, json);
      totalDelivered += expoTokens.length;
    } catch (expoErr) {
      console.error(`[Expo Push Service] Push delivery failed: ${expoErr.message}`);
      totalFailed += expoTokens.length;
    }
  }

  return {
    success: true,
    deliveredCount: totalDelivered,
    failedCount: totalFailed,
  };
};

/**
 * Send notification to a specific user by userId
 */
export const sendNotificationToUser = async (userId, notificationPayload, dataPayload = {}) => {
  try {
    const user = await User.findById(userId).select('deviceTokens');
    if (!user || !user.deviceTokens || user.deviceTokens.length === 0) {
      console.log(`[FCM] No registered device tokens found for user ${userId}`);
      return { success: true, message: 'No registered devices found for user' };
    }
    console.log(`[FCM] Sending push notification to user ${userId} (${user.deviceTokens.length} device tokens)`);
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
    console.log(`[FCM] Found ${admins.length} active admins with ${uniqueTokens.length} unique device tokens`);
    if (uniqueTokens.length === 0) {
      console.log('[FCM] No admin devices registered yet. Skipping push.');
      return { success: true, deliveredCount: 0, message: 'No registered admin device tokens' };
    }
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
