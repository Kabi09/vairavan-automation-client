import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import notificationApi from '../api/notificationApi';

// Determine if running inside Expo Go client sandbox
const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  Constants.appOwnership === 'expo';

// Only load native expo-notifications module when NOT running in Expo Go client.
// Expo SDK 53+ throws an uncatchable runtime error in Expo Go upon evaluating expo-notifications TokenEmitter.
let Notifications = null;
if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
    if (Notifications?.setNotificationHandler) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
    }
  } catch (err) {
    console.log('[NotificationService] Native push module notice:', err.message);
  }
}

let registeredToken = null;
let notificationListener = null;
let responseListener = null;

/**
 * Configure Android notification channels (for standalone APK / Development builds)
 */
export const setupNotificationChannels = async () => {
  if (isExpoGo || !Notifications?.setNotificationChannelAsync) return;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0F52BA',
        sound: 'default',
      });
    }
  } catch (err) {
    console.log('[NotificationService] Channel setup notice:', err.message);
  }
};

/**
 * Request permission, obtain push token and register with backend
 */
export const registerPushNotifications = async () => {
  // Remote device push tokens are disabled by Expo in Expo Go SDK 53+;
  // fully enabled in standalone APK builds
  if (isExpoGo || !Notifications) {
    console.log('[NotificationService] Running in Expo Go client: in-app real-time synchronization active.');
    return null;
  }

  try {
    await setupNotificationChannels();

    if (!Device.isDevice) {
      console.log('[NotificationService] Must use physical device for native Push Notifications');
      return null;
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

    let token = null;
    try {
      const tokenData = await Notifications.getDevicePushTokenAsync();
      token = tokenData?.data;
    } catch (e) {
      console.log('[NotificationService] Device push token query notice:', e.message);
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
 * Listen for incoming notifications and user response clicks (Standalone APK builds)
 */
export const initNotificationListeners = ({ onNotificationReceived, onNotificationTapped }) => {
  if (isExpoGo || !Notifications?.addNotificationReceivedListener) {
    return () => {};
  }

  try {
    if (!notificationListener) {
      notificationListener = Notifications.addNotificationReceivedListener((notification) => {
        console.log('[NotificationService] Foreground notification received:', notification?.request?.content?.title);
        if (typeof onNotificationReceived === 'function') {
          onNotificationReceived(notification);
        }
      });
    }

    if (!responseListener) {
      responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
        console.log('[NotificationService] Notification tapped by user:', response?.notification?.request?.content?.data);
        if (typeof onNotificationTapped === 'function') {
          onNotificationTapped(response);
        }
      });
    }
  } catch (err) {
    console.log('[NotificationService] Native listener notice:', err.message);
  }

  return () => {
    try {
      if (notificationListener) {
        notificationListener.remove();
        notificationListener = null;
      }
      if (responseListener) {
        responseListener.remove();
        responseListener = null;
      }
    } catch {}
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
