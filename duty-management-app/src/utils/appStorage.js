import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Universal Cross-Platform Storage Adapter
 * Safely handles iOS Keychain, Android Keystore, and Web localStorage/AsyncStorage
 */
export const appStorage = {
  /**
   * Secure storage for sensitive data (tokens, credentials)
   */
  async getSecureItem(key) {
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage.getItem(key);
        }
      } catch (err) {
        console.warn('[appStorage] localStorage read error:', err);
      }
      return null;
    }

    try {
      return await SecureStore.getItemAsync(key);
    } catch (err) {
      console.warn(`[appStorage] SecureStore.getItemAsync failed for ${key}, falling back to AsyncStorage:`, err);
      try {
        return await AsyncStorage.getItem(key);
      } catch {
        return null;
      }
    }
  },

  async setSecureItem(key, value) {
    if (value === undefined || value === null) {
      await this.removeSecureItem(key);
      return;
    }

    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, stringValue);
        }
      } catch (err) {
        console.warn('[appStorage] localStorage write error:', err);
      }
      return;
    }

    try {
      await SecureStore.setItemAsync(key, stringValue);
    } catch (err) {
      console.warn(`[appStorage] SecureStore.setItemAsync failed for ${key}, falling back to AsyncStorage:`, err);
      try {
        await AsyncStorage.setItem(key, stringValue);
      } catch (aErr) {
        console.error('[appStorage] AsyncStorage write error:', aErr);
      }
    }
  },

  async removeSecureItem(key) {
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key);
        }
      } catch (err) {
        console.warn('[appStorage] localStorage remove error:', err);
      }
      return;
    }

    try {
      await SecureStore.deleteItemAsync(key);
    } catch (err) {
      try {
        await AsyncStorage.removeItem(key);
      } catch {}
    }
  },

  /**
   * General storage for cache, offline data, and drafts
   */
  async getItem(key) {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return await AsyncStorage.getItem(key);
    } catch (err) {
      console.warn(`[appStorage] getItem failed for ${key}:`, err);
      return null;
    }
  },

  async setItem(key, value) {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, stringValue);
        return;
      }
      await AsyncStorage.setItem(key, stringValue);
    } catch (err) {
      console.warn(`[appStorage] setItem failed for ${key}:`, err);
    }
  },

  async removeItem(key) {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
        return;
      }
      await AsyncStorage.removeItem(key);
    } catch (err) {
      console.warn(`[appStorage] removeItem failed for ${key}:`, err);
    }
  },
};

export default appStorage;

