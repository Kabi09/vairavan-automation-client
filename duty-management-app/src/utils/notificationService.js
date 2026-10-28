import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import notificationApi from '../api/notificationApi';
import { APP_CONFIG } from '../constants/config';

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
 * Guaranteed to execute on login, app launch, and token refresh.
 */
export const registerPushNotifications = async () => {
  if (Platform.OS === 'web') return null;
  try {
    let token = null;

    // 1. In Standalone APK / Production / Native Builds:
    if (Notifications) {
      await setupNotificationChannels();

      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus === 'granted') {
          // A. Fetch native device push token (FCM on Android)
          try {
            const tokenData = await Notifications.getDevicePushTokenAsync();
            token = tokenData?.data;
            if (token) {
              console.log('[NotificationService] Acquired native device push token (FCM):', token);
            }
          } catch (e) {
            console.log('[NotificationService] Native FCM query notice:', e.message);
          }

          // B. Fallback to Expo push token
          if (!token) {
            try {
              const projectId =
                Constants.easConfig?.projectId ||
                Constants.expoConfig?.extra?.eas?.projectId ||
                'ff8c1225-7ed8-47ee-ab46-9196bd0e21b8';
              const expoTokenData = await Notifications.getExpoPushTokenAsync({ projectId });
              token = expoTokenData?.data;
              if (token) {
                console.log('[NotificationService] Acquired Expo push token:', token);
              }
            } catch (expoErr) {
              console.log('[NotificationService] Expo push token query notice:', expoErr.message);
            }
          }
        }
      } catch (permErr) {
        console.log('[NotificationService] Permission check notice:', permErr.message);
      }
    }

    // 2. Check local SecureStore cache if token not retrieved from OS
    if (!token) {
      try {
        token = await SecureStore.getItemAsync('vairavan_device_token');
      } catch {}
    }

    // 3. In Expo Go client or testing environment, ensure consistent device token exists
    if (!token) {
      const deviceIdentifier = Device.modelName
        ? `${Device.modelName.replace(/[^a-zA-Z0-9]/g, '_')}`
        : 'MobileDevice';
      token = `ExpoClient_${Platform.OS}_${deviceIdentifier}_${Date.now().toString(36)}`;
      console.log('[NotificationService] Generated client device token for session:', token);
    }

    if (token) {
      registeredToken = token;
      console.log('[NotificationService] Syncing device token to backend:', token);

      try {
        await SecureStore.setItemAsync('vairavan_device_token', token);
        const authToken = await SecureStore.getItemAsync(APP_CONFIG.STORAGE_KEYS.ACCESS_TOKEN);
        if (authToken) {
          await notificationApi.registerDeviceToken(token);
          console.log('[NotificationService] Device token registered with backend successfully');
        } else {
          console.log('[NotificationService] Device token cached locally; will register after login');
        }
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

  // Verify access token exists before calling authenticated endpoint
  let authToken = null;
  try {
    authToken = await SecureStore.getItemAsync(APP_CONFIG.STORAGE_KEYS.ACCESS_TOKEN);
  } catch {}

  // If no auth token is present, server unregistration would fail with 401
  if (!authToken) {
    registeredToken = null;
    return;
  }

  try {
    await notificationApi.removeDeviceToken(token);
    // Keep device token in SecureStore so subsequent logins on this physical device can re-register immediately
    registeredToken = null;
    console.log('[NotificationService] Device token unlinked from backend user successfully');
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
