import apiClient from './apiClient';

export const dutyApi = {
  checkIn: async (checkInData) => {
    const res = await apiClient.post('/duties/check-in', checkInData);
    return res.data;
  },

  getActiveCheckIn: async () => {
    const res = await apiClient.get('/duties/active-checkin');
    return res.data;
  },

  checkOut: async (checkOutData) => {
    const res = await apiClient.post('/duties/check-out', checkOutData);
    return res.data;
  },

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
