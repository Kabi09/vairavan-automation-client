import apiClient from './apiClient';

export const notificationApi = {
  getNotifications: async (params = {}) => {
    const res = await apiClient.get('/notifications', { params });
    return res.data;
  },

  markAsRead: async (id) => {
    const res = await apiClient.patch(`/notifications/${id}/read`);
    return res.data;
  },

  markAllAsRead: async () => {
    const res = await apiClient.patch('/notifications/mark-all-read');
    return res.data;
  },

  deleteNotification: async (id) => {
    const res = await apiClient.delete(`/notifications/${id}`);
    return res.data;
  },

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
