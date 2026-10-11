import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
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

// Request interceptor: attach Bearer token from secure storage
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync(APP_CONFIG.STORAGE_KEYS.ACCESS_TOKEN);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (err) {
      console.warn('[ApiClient] Failed to read token from SecureStore:', err);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401 and global errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      console.warn('[ApiClient] 401 Unauthorized received');
      if (typeof unauthorizedHandler === 'function') {
        unauthorizedHandler();
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
