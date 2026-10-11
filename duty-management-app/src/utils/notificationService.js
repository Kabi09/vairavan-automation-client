import { Platform } from 'react-native';
import notificationApi from '../api/notificationApi';

/**
 * Push Notification Service (Firebase Cloud Messaging / Expo Push compatible)
 *
 * NOTE: As per Expo SDK guidelines, FCM in standard Expo Go has limited background support;
 * production push notifications require an EAS Development Build or prebuild with google-services.json.
 * This service provides graceful fallback when credentials/services are not configured.
 */

let registeredToken = null;

export const registerPushNotifications = async () => {
  try {
    // Only attempt if expo-notifications is installed in a development build
    let Notifications;
    try {
      Notifications = require('expo-notifications');
    } catch {
      // expo-notifications not installed or not supported in current environment
      return null;
    }

    if (!Notifications) return null;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    // Get FCM / device push token
    const tokenData = await Notifications.getDevicePushTokenAsync();
    const token = tokenData?.data;

    if (token) {
      registeredToken = token;
      // Send token to backend
      try {
        await notificationApi.registerDeviceToken(token);
      } catch (err) {
        // Backend notification endpoints are optional until configured
        console.warn('Failed to register push token with backend:', err.message);
      }
      return token;
    }
  } catch (error) {
    // Push notifications are optional; fail gracefully
    console.warn('Push notification initialization skipped:', error.message);
    return null;
  }
};

export const unregisterPushNotifications = async () => {
  if (!registeredToken) return;
  try {
    await notificationApi.removeDeviceToken(registeredToken);
    registeredToken = null;
  } catch (error) {
    console.warn('Failed to remove push token:', error.message);
  }
};

export default {
  registerPushNotifications,
  unregisterPushNotifications,
};
