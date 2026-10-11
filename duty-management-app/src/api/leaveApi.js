import apiClient from './apiClient';

export const leaveApi = {
  createLeave: async (leaveData) => {
    const res = await apiClient.post('/leaves', leaveData);
    return res.data;
  },

  getMyLeaves: async (params = {}) => {
    const res = await apiClient.get('/leaves/my', { params });
    return res.data;
  },

  getAllLeaves: async (params = {}) => {
    const res = await apiClient.get('/leaves', { params });
    return res.data;
  },

  getLeaveById: async (id) => {
    const res = await apiClient.get(`/leaves/${id}`);
    return res.data;
  },

  reviewLeave: async (id, reviewData) => {
    const res = await apiClient.patch(`/leaves/${id}/review`, reviewData);
    return res.data;
  },

  cancelLeave: async (id) => {
    const res = await apiClient.patch(`/leaves/${id}/cancel`);
    return res.data;
  },
};

export default leaveApi;
