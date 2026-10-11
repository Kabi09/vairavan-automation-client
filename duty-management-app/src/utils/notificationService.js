import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import notificationApi from '../api/notificationApi';

// Determine if running inside Expo Go client sandbox
const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  Constants.appOwnership === 'expo';

// Dynamic safe loading of expo-notifications module
let Notifications = null;
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
  console.log('[NotificationService] expo-notifications load notice:', err.message);
}

let registeredToken = null;
let notificationListener = null;
let responseListener = null;

/**
 * Configure Android notification channels (MAX importance for system tray & heads-up display)
 */
export const setupNotificationChannels = async () => {
  if (!Notifications?.setNotificationChannelAsync) return;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0F52BA',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
    }
  } catch (err) {
    console.log('[NotificationService] Channel setup notice:', err.message);
  }
};

/**
 * Request permission, obtain push token and register with backend.
 * Called on login and on app launch / token refresh.
 */
export const registerPushNotifications = async () => {
  try {
    if (!Device.isDevice) {
      console.log('[NotificationService] Physical device required for remote Push Notifications');
      return null;
    }

    if (!Notifications) {
      console.log('[NotificationService] Push notification native module not loaded.');
      return null;
    }

    await setupNotificationChannels();

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

    // 1. Fetch native device push token (FCM on Android APK)
    try {
      const tokenData = await Notifications.getDevicePushTokenAsync();
      token = tokenData?.data;
      if (token) {
        console.log('[NotificationService] Acquired native device push token (FCM)');
      }
    } catch (e) {
      console.log('[NotificationService] Native device push token notice:', e.message);
    }

    // 2. Fallback to Expo push token if native FCM token unavailable
    if (!token) {
      try {
        const projectId =
          Constants.easConfig?.projectId ||
          Constants.expoConfig?.extra?.eas?.projectId ||
          'ff8c1225-7ed8-47ee-ab46-9196bd0e21b8';
        const expoTokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        token = expoTokenData?.data;
        if (token) {
          console.log('[NotificationService] Acquired Expo push token');
        }
      } catch (expoErr) {
        console.log('[NotificationService] Expo push token notice:', expoErr.message);
      }
    }

    // 3. Fallback to cached token in SecureStore
    if (!token) {
      try {
        token = await SecureStore.getItemAsync('vairavan_device_token');
      } catch {}
    }

    if (token) {
      registeredToken = token;
      console.log('[NotificationService] Registering device token with backend:', token);

      try {
        await SecureStore.setItemAsync('vairavan_device_token', token);
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
  if (!Notifications?.addNotificationReceivedListener) {
    return () => {};
  }

  try {
    if (!notificationListener) {
      notificationListener = Notifications.addNotificationReceivedListener((notification) => {
        console.log('[NotificationService] Notification received in foreground:', notification?.request?.content?.title);
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
  let token = registeredToken;
  if (!token) {
    try {
      token = await SecureStore.getItemAsync('vairavan_device_token');
    } catch {}
  }
  if (!token) return;
  try {
    await notificationApi.removeDeviceToken(token);
    await SecureStore.deleteItemAsync('vairavan_device_token').catch(() => {});
    registeredToken = null;
    console.log('[NotificationService] Device token removed from backend successfully');
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
