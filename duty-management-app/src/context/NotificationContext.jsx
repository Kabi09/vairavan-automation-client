import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { useAuth } from './AuthContext';
import notificationApi from '../api/notificationApi';
import notificationService from '../utils/notificationService';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children, navigationRef }) => {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const prevUnreadRef = useRef(0);

  const fetchNotifications = useCallback(
    async (silent = false) => {
      if (!isAuthenticated) return;
      if (!silent) setLoading(true);
      try {
        const res = await notificationApi.getNotifications({ limit: 50 });
        if (res?.data) {
          const newUnread = res.data.unreadCount || 0;
          const newNotifs = res.data.notifications || [];

          // Alert user when new notification arrives in foreground
          if (newUnread > prevUnreadRef.current && prevUnreadRef.current !== 0) {
            const newest = newNotifs[0];
            if (newest && !newest.isRead) {
              Alert.alert(
                newest.title || 'New Notification Received',
                newest.message || 'You have a new update.',
                [
                  { text: 'Dismiss', style: 'cancel' },
                  {
                    text: 'View',
                    onPress: () => {
                      if (navigationRef?.current) {
                        navigationRef.current.navigate('Notifications');
                      }
                    },
                  },
                ]
              );
            }
          }

          prevUnreadRef.current = newUnread;
          setNotifications(newNotifs);
          setUnreadCount(newUnread);
        }
      } catch {
        // Silently catch during background polling
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [isAuthenticated, navigationRef]
  );

  // Register push notifications and setup 15s real-time sync
  useEffect(() => {
    if (isAuthenticated) {
      // 1. Obtain & register push token with backend
      notificationService.registerPushNotifications();

      // 2. Initial notifications fetch
      fetchNotifications();

      // 3. Setup native notification listeners (foreground and tap)
      const cleanupListeners = notificationService.initNotificationListeners({
        onNotificationReceived: () => {
          fetchNotifications(true);
        },
        onNotificationTapped: () => {
          fetchNotifications(true);
          if (navigationRef?.current) {
            navigationRef.current.navigate('Notifications');
          }
        },
      });

      // 4. 15-second background auto-polling for real-time synchronization
      const pollInterval = setInterval(() => {
        fetchNotifications(true);
      }, 15000);

      return () => {
        clearInterval(pollInterval);
        if (typeof cleanupListeners === 'function') {
          cleanupListeners();
        }
      };
    } else {
      setNotifications([]);
      setUnreadCount(0);
      prevUnreadRef.current = 0;
    }
  }, [isAuthenticated, fetchNotifications, navigationRef]);

  const value = {
    notifications,
    unreadCount,
    loading,
    refreshNotifications: fetchNotifications,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export default NotificationContext;
