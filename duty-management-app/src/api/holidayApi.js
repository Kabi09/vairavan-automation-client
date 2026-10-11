import apiClient from './apiClient';

export const holidayApi = {
  getHolidays: async (params = {}) => {
    const res = await apiClient.get('/holidays', { params });
    return res.data;
  },

  getHolidayById: async (id) => {
    const res = await apiClient.get(`/holidays/${id}`);
    return res.data;
  },

  createHoliday: async (holidayData) => {
    const res = await apiClient.post('/holidays', holidayData);
    return res.data;
  },

  updateHoliday: async (id, holidayData) => {
    const res = await apiClient.put(`/holidays/${id}`, holidayData);
    return res.data;
  },

  deleteHoliday: async (id) => {
    const res = await apiClient.delete(`/holidays/${id}`);
    return res.data;
  },
};

export default holidayApi;
