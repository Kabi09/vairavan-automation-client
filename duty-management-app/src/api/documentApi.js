import apiClient from './apiClient';

export const documentApi = {
  /**
   * Get shared documents with optional search, role filter, and pagination
   * @param {Object} params - { search, role, page, limit }
   */
  getDocuments: async (params = {}) => {
    const res = await apiClient.get('/documents', { params });
    return res.data;
  },

  /**
   * Upload shared documents with multiple files
   * @param {FormData} formData - FormData with title, description, and files array
   * @param {Function} onUploadProgress - Axios upload progress callback
   */
  uploadDocuments: async (formData, onUploadProgress) => {
    const res = await apiClient.post('/documents', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress,
    });
    return res.data;
  },

  /**
   * Delete a shared document by ID
   * @param {string} id - Document ID
   */
  deleteDocument: async (id) => {
    const res = await apiClient.delete(`/documents/${id}`);
    return res.data;
  },

  /**
   * Get unread document notification count for current user
   */
  getUnreadCount: async () => {
    const res = await apiClient.get('/documents/unread-count');
    return res.data;
  },

  /**
   * Mark all document upload notifications as viewed for current user
   */
  markDocumentsViewed: async () => {
    const res = await apiClient.patch('/documents/mark-viewed');
    return res.data;
  },
};

export default documentApi;
