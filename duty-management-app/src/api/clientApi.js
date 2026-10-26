import apiClient from './apiClient';

/**
 * Client Management API
 */
export const clientApi = {
  /**
   * Get clients, optionally filtered by company
   */
  getClients: (params = {}) => apiClient.get('/clients', { params }),

  /**
   * Add a new client linked to a company
   */
  createClient: (data) => apiClient.post('/clients', data),

  /**
   * Get single client by ID
   */
  getClientById: (id) => apiClient.get(`/clients/${id}`),

  /**
   * Update client
   */
  updateClient: (id, data) => apiClient.put(`/clients/${id}`, data),

  /**
   * Delete client
   */
  deleteClient: (id) => apiClient.delete(`/clients/${id}`),
};

export default clientApi;
