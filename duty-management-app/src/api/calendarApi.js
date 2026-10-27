import apiClient from './apiClient';

export const calendarApi = {
  getMonthlyCalendar: async (params = {}) => {
    const res = await apiClient.get('/calendar/monthly', { params });
    return res.data;
  },
};

export default calendarApi;
