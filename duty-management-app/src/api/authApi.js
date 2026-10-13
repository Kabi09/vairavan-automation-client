import apiClient from './apiClient';

export const authApi = {
  login: async (email, password) => {
    const res = await apiClient.post('/auth/login', { email, password });
    return res.data;
  },

  getMe: async () => {
    const res = await apiClient.get('/auth/me');
    return res.data;
  },

  updateProfile: async (data) => {
    const res = await apiClient.patch('/auth/profile', data);
    return res.data;
  },

  changePassword: async (currentPassword, newPassword) => {
    const res = await apiClient.patch('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    return res.data;
  },

  refreshToken: async (token) => {
    const res = await apiClient.post('/auth/refresh', { refreshToken: token });
    return res.data;
  },

  logout: async (token) => {
    const res = await apiClient.post('/auth/logout', { refreshToken: token });
    return res.data;
  },
};

export default authApi;
