import apiClient from './apiClient';

export const taskApi = {
  createTask: async (taskData) => {
    const res = await apiClient.post('/tasks', taskData);
    return res.data;
  },

  getTasks: async (params = {}) => {
    const res = await apiClient.get('/tasks', { params });
    return res.data;
  },

  getMyTasks: async (params = {}) => {
    const res = await apiClient.get('/tasks/my', { params });
    return res.data;
  },

  getTaskById: async (id) => {
    const res = await apiClient.get(`/tasks/${id}`);
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
