import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import notificationApi from '../api/notificationApi';
import notificationService from '../utils/notificationService';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children, navigationRef }) => {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(
    async (silent = false) => {
      if (!isAuthenticated) return;
      if (!silent) setLoading(true);
      try {
        const res = await notificationApi.getNotifications({ limit: 50 });
        if (res?.data) {
          const newUnread = res.data.unreadCount || 0;
          const newNotifs = res.data.notifications || [];
          setNotifications(newNotifs);
          setUnreadCount(newUnread);
        }
      } catch {
        // Silently catch during background updates
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [isAuthenticated]
  );

  // Initialize push notifications and OS listeners
  useEffect(() => {
    if (isAuthenticated) {
      // 1. Obtain & register device token with backend
      notificationService.registerPushNotifications();

      // 2. Initial notifications fetch
      fetchNotifications();

      // 3. Setup OS push notification listeners (foreground reception and tray tap)
      const cleanupListeners = notificationService.initNotificationListeners({
        onNotificationReceived: () => {
          fetchNotifications(true);
        },
        onNotificationTapped: (response) => {
          fetchNotifications(true);
          const data =
            response?.notification?.request?.content?.data ||
            response?.notification?.data ||
            {};
          if (navigationRef?.current) {
            const notifType = data.type || '';
            const expenseId = data.expenseId;
            if (notifType.includes('expense') || expenseId) {
              try {
                navigationRef.current.navigate('AdminExpenses', { expenseId });
                return;
              } catch {
                try {
                  navigationRef.current.navigate('MyExpenses', { expenseId });
                  return;
                } catch {}
              }
            }
            navigationRef.current.navigate('Notifications');
          }
        },
      });

      return () => {
        if (typeof cleanupListeners === 'function') {
          cleanupListeners();
        }
      };
    } else {
      setNotifications([]);
      setUnreadCount(0);
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
