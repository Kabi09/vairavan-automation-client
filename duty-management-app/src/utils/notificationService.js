import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import notificationApi from '../api/notificationApi';

// Configure foreground presentation behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

let registeredToken = null;
let notificationListener = null;
let responseListener = null;

/**
 * Configure Android notification channels
 */
export const setupNotificationChannels = async () => {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0F52BA',
      sound: 'default',
    });
  }
};

/**
 * Request permission, obtain push token and register with backend
 */
export const registerPushNotifications = async () => {
  try {
    await setupNotificationChannels();

    if (!Device.isDevice) {
      console.log('[NotificationService] Must use physical device for native Push Notifications');
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[NotificationService] Push notification permission not granted');
      return null;
    }

    // Try fetching device token (FCM for Android)
    let token = null;
    try {
      const tokenData = await Notifications.getDevicePushTokenAsync();
      token = tokenData?.data;
    } catch {
      // In Expo Go client, fallback to Expo Push Token if device token unavailable
      try {
        const expoTokenData = await Notifications.getExpoPushTokenAsync();
        token = expoTokenData?.data;
      } catch (expoErr) {
        console.log('[NotificationService] Token fetch info:', expoErr.message);
      }
    }

    if (token) {
      registeredToken = token;
      console.log('[NotificationService] Acquired push token:', token);

      try {
        await notificationApi.registerDeviceToken(token);
        console.log('[NotificationService] Device token registered with backend successfully');
      } catch (err) {
        console.warn('[NotificationService] Failed to register token with backend:', err.message);
      }
      return token;
    }
  } catch (error) {
    console.warn('[NotificationService] Registration error:', error.message);
    return null;
  }
};

/**
 * Listen for incoming notifications and user response clicks
 */
export const initNotificationListeners = ({ onNotificationReceived, onNotificationTapped }) => {
  // Listener for foreground notifications
  if (!notificationListener) {
    notificationListener = Notifications.addNotificationReceivedListener((notification) => {
      console.log('[NotificationService] Foreground notification received:', notification.request.content.title);
      if (typeof onNotificationReceived === 'function') {
        onNotificationReceived(notification);
      }
    });
  }

  // Listener for user tapping notification (background/closed app)
  if (!responseListener) {
    responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('[NotificationService] Notification tapped by user:', response.notification.request.content.data);
      if (typeof onNotificationTapped === 'function') {
        onNotificationTapped(response);
      }
    });
  }

  return () => {
    if (notificationListener) {
      notificationListener.remove();
      notificationListener = null;
    }
    if (responseListener) {
      responseListener.remove();
      responseListener = null;
    }
  };
};

/**
 * Unregister device token on logout
 */
export const unregisterPushNotifications = async () => {
  if (!registeredToken) return;
  try {
    await notificationApi.removeDeviceToken(registeredToken);
    registeredToken = null;
    console.log('[NotificationService] Device token removed from backend');
  } catch (error) {
    console.warn('[NotificationService] Failed to remove push token:', error.message);
  }
};

export default {
  registerPushNotifications,
  unregisterPushNotifications,
  initNotificationListeners,
  setupNotificationChannels,
};
