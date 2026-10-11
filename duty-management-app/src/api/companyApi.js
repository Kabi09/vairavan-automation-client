import apiClient from './apiClient';

export const companyApi = {
  getCompanies: async (params = {}) => {
    const res = await apiClient.get('/companies', { params });
    return res.data;
  },

  getCompanyById: async (id) => {
    const res = await apiClient.get(`/companies/${id}`);
    return res.data;
  },

  createCompany: async (companyData) => {
    const res = await apiClient.post('/companies', companyData);
    return res.data;
  },

  updateCompany: async (id, companyData) => {
    const res = await apiClient.put(`/companies/${id}`, companyData);
    return res.data;
  },

  deleteCompany: async (id) => {
    const res = await apiClient.delete(`/companies/${id}`);
    return res.data;
  },
};

export default companyApi;
