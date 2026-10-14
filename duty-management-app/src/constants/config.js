/**
 * Application Configuration
 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'https://vairavan-automation-client-iony.vercel.app/api';

export const APP_CONFIG = {
  APP_NAME: 'VairaWorks',
  COMPANY_NAME: 'Vairavan Automation',
  REQUEST_TIMEOUT_MS: 15000,
  WORK_TYPES: [
    'Electrical',
    'Mechanical',
    'Installation',
    'Maintenance',
    'Repair',
    'Other',
  ],
  STORAGE_KEYS: {
    ACCESS_TOKEN: 'vairavan_access_token',
    REFRESH_TOKEN: 'vairavan_refresh_token',
    USER_DATA: 'vairavan_user_data',
  },
};

export default {
  API_BASE_URL,
  APP_CONFIG,
};
