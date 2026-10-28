import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { appStorage } from '../utils/appStorage';
import authApi from '../api/authApi';
import { setUnauthorizedHandler } from '../api/apiClient';
import { APP_CONFIG } from '../constants/config';
import { extractErrorMessage } from '../utils/errorUtils';
import notificationService from '../utils/notificationService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const isLoggingOutRef = useRef(false);

  // Initialize and check stored session
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedToken = await appStorage.getSecureItem(APP_CONFIG.STORAGE_KEYS.ACCESS_TOKEN);
        const storedRefresh = await appStorage.getSecureItem(APP_CONFIG.STORAGE_KEYS.REFRESH_TOKEN);
        const storedUser = await appStorage.getSecureItem(APP_CONFIG.STORAGE_KEYS.USER_DATA);

        if (storedToken && storedUser) {
          setToken(storedToken);
          setRefreshToken(storedRefresh);
          setUser(JSON.parse(storedUser));

          // Refresh device token with backend on app launch
          notificationService.registerPushNotifications().catch(() => {});

          // Verify token validity in background
          try {
            const meRes = await authApi.getMe();
            if (meRes.data && meRes.data.user) {
              setUser(meRes.data.user);
              await appStorage.setSecureItem(
                APP_CONFIG.STORAGE_KEYS.USER_DATA,
                JSON.stringify(meRes.data.user)
              );
            }
          } catch (verifyError) {
            console.warn('[AuthContext] Token verification failed:', verifyError.message);
          }
        }
      } catch (err) {
        console.error('[AuthContext] Session restore error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Handle automatic logout on 401
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if ((token || refreshToken) && !isLoggingOutRef.current) {
        logout();
      }
    });
  }, [token, refreshToken]);

  const login = async (email, password) => {
    try {
      const response = await authApi.login(email, password);
      const { token: newAccessToken, refreshToken: newRefreshToken, user: userData } = response.data;

      // Save credentials in appStorage
      if (newAccessToken) {
        await appStorage.setSecureItem(APP_CONFIG.STORAGE_KEYS.ACCESS_TOKEN, newAccessToken);
      }
      if (newRefreshToken) {
        await appStorage.setSecureItem(APP_CONFIG.STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken);
      }
      if (userData) {
        await appStorage.setSecureItem(APP_CONFIG.STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
      }

      setToken(newAccessToken);
      setRefreshToken(newRefreshToken);
      setUser(userData);

      // Register device token on backend immediately upon login
      notificationService.registerPushNotifications().catch(() => {});

      return { success: true, user: userData };
    } catch (error) {
      const message = extractErrorMessage(error, 'Login failed');
      return { success: false, error: message };
    }
  };

  const logout = async () => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;
    try {
      if (token) {
        await notificationService.unregisterPushNotifications().catch(() => {});
      }
      if (refreshToken) {
        await authApi.logout(refreshToken).catch(() => {});
      }
    } finally {
      // Clear all local auth credentials
      await appStorage.removeSecureItem(APP_CONFIG.STORAGE_KEYS.ACCESS_TOKEN);
      await appStorage.removeSecureItem(APP_CONFIG.STORAGE_KEYS.REFRESH_TOKEN);
      await appStorage.removeSecureItem(APP_CONFIG.STORAGE_KEYS.USER_DATA);

      setToken(null);
      setRefreshToken(null);
      setUser(null);
      isLoggingOutRef.current = false;
    }
  };

  const updateProfile = (updatedUser) => {
    setUser(updatedUser);
    appStorage.setSecureItem(
      APP_CONFIG.STORAGE_KEYS.USER_DATA,
      JSON.stringify(updatedUser)
    ).catch(() => {});
  };

  const value = {
    user,
    token,
    isLoading,
    isAuthenticated: Boolean(token && user),
    isAdmin: user?.role === 'admin',
    isEmployee: user?.role === 'employee' || user?.role === 'staff',
    isStaff: user?.role === 'staff' || user?.role === 'employee',
    login,
    logout,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
