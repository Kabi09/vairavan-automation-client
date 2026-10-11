import apiClient from './apiClient';

export const notificationApi = {
  registerDeviceToken: async (deviceToken) => {
    const res = await apiClient.post('/notifications/register-token', { deviceToken });
    return res.data;
  },

  removeDeviceToken: async (deviceToken) => {
    const res = await apiClient.post('/notifications/remove-token', { deviceToken });
    return res.data;
  },
};

export default notificationApi;
