import apiClient from './apiClient';

export const employeeApi = {
  getEmployees: async (params = {}) => {
    const res = await apiClient.get('/employees', { params });
    return res.data;
  },

  getEmployeeById: async (id) => {
    const res = await apiClient.get(`/employees/${id}`);
    return res.data;
  },

  createEmployee: async (employeeData) => {
    const res = await apiClient.post('/employees', employeeData);
    return res.data;
  },

  updateEmployee: async (id, employeeData) => {
    const res = await apiClient.put(`/employees/${id}`, employeeData);
    return res.data;
  },

  updateEmployeeStatus: async (id, accountStatus) => {
    const res = await apiClient.patch(`/employees/${id}/status`, { accountStatus });
    return res.data;
  },

  resetEmployeePassword: async (id, newPassword) => {
    const res = await apiClient.patch(`/employees/${id}/password`, { newPassword });
    return res.data;
  },
};

export default employeeApi;
