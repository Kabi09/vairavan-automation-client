import apiClient from './apiClient';

export const dutyApi = {
  createDuty: async (dutyData) => {
    const res = await apiClient.post('/duties', dutyData);
    return res.data;
  },

  getMyDuties: async (params = {}) => {
    const res = await apiClient.get('/duties/my', { params });
    return res.data;
  },

  getAllDuties: async (params = {}) => {
    const res = await apiClient.get('/duties', { params });
    return res.data;
  },

  getDutyById: async (id) => {
    const res = await apiClient.get(`/duties/${id}`);
    return res.data;
  },

  updateDuty: async (id, dutyData) => {
    const res = await apiClient.put(`/duties/${id}`, dutyData);
    return res.data;
  },

  updateDutyStatus: async (id, statusData) => {
    const res = await apiClient.patch(`/duties/${id}/status`, statusData);
    return res.data;
  },

  deleteDuty: async (id) => {
    const res = await apiClient.delete(`/duties/${id}`);
    return res.data;
  },
};

export default dutyApi;
