import apiClient from './apiClient';

export const dashboardApi = {
  getAdminDashboard: async () => {
    const res = await apiClient.get('/dashboard/admin');
    return res.data;
  },

  getEmployeeDashboard: async () => {
    const res = await apiClient.get('/dashboard/employee');
    return res.data;
  },
};

export default dashboardApi;
