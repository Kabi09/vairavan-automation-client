import apiClient from './apiClient';

export const taskApi = {
  getTasks: async (params = {}) => {
    const res = await apiClient.get('/tasks', { params });
    return res.data;
  },

  getTaskById: async (id) => {
    const res = await apiClient.get(`/tasks/${id}`);
    return res.data;
  },

  createTask: async (taskData) => {
    const res = await apiClient.post('/tasks', taskData);
    return res.data;
  },

  updateTaskStatus: async (id, status) => {
    const res = await apiClient.patch(`/tasks/${id}/status`, { status });
    return res.data;
  },

  deleteTask: async (id) => {
    const res = await apiClient.delete(`/tasks/${id}`);
    return res.data;
  },
};

export default taskApi;
