import axios from 'axios';
import { appStorage } from '../utils/appStorage';
import { API_BASE_URL, APP_CONFIG } from '../constants/config';

// Create base Axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: APP_CONFIG.REQUEST_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
});

let unauthorizedHandler = null;

/**
 * Register a callback when a 401 Unauthorized is intercepted
 */
export const setUnauthorizedHandler = (handler) => {
  unauthorizedHandler = handler;
};

// Request interceptor: attach Bearer token and log request
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await appStorage.getSecureItem(APP_CONFIG.STORAGE_KEYS.ACCESS_TOKEN);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (err) {
      console.warn('[ApiClient] Failed to read token from appStorage:', err);
    }
    console.log(`\n➡️ [API REQ] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    if (config.data && typeof config.data === 'object') {
      console.log('   Payload:', JSON.stringify(config.data));
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let isHandlingUnauthorized = false;

// Response interceptor: log response & handle errors
apiClient.interceptors.response.use(
  (response) => {
    console.log(`✅ [API RES] ${response.status} ${response.config?.url}`);
    return response;
  },
  async (error) => {
    const status = error.response ? error.response.status : 'NETWORK_ERROR';
    const errorData = error.response?.data || error.message;
    console.error(`❌ [API ERR] ${status} ${error.config?.url}`);
    console.error('   Details:', JSON.stringify(errorData));

    if (error.response && error.response.status === 401) {
      const url = error.config?.url || '';
      // Do NOT trigger global logout on auth routes or token unregistration routes
      const isExempt =
        url.includes('/auth/login') ||
        url.includes('/auth/register') ||
        url.includes('/auth/forgot-password') ||
        url.includes('/auth/refresh-token') ||
        url.includes('/notifications/remove-token') ||
        url.includes('/notifications/register-token');

      if (!isExempt && !isHandlingUnauthorized) {
        isHandlingUnauthorized = true;
        console.warn('[ApiClient] 401 Unauthorized received for protected endpoint');
        if (typeof unauthorizedHandler === 'function') {
          try {
            unauthorizedHandler();
          } catch (handlerErr) {
            console.warn('[ApiClient] Error in unauthorizedHandler:', handlerErr);
          }
        }
        setTimeout(() => {
          isHandlingUnauthorized = false;
        }, 3000);
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
