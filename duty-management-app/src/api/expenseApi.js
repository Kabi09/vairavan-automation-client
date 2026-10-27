import apiClient from './apiClient';

/**
 * Expense Management API Client
 */
export const expenseApi = {
  // Categories (Configured by Admin)
  getCategories: async (params = {}) => {
    const res = await apiClient.get('/expense-categories', { params });
    return res.data;
  },

  createCategory: async (categoryData) => {
    const res = await apiClient.post('/expense-categories', categoryData);
    return res.data;
  },

  updateCategory: async (id, categoryData) => {
    const res = await apiClient.put(`/expense-categories/${id}`, categoryData);
    return res.data;
  },

  deleteCategory: async (id) => {
    const res = await apiClient.delete(`/expense-categories/${id}`);
    return res.data;
  },

  // Expense Submissions
  submitExpense: async (expenseData) => {
    const res = await apiClient.post('/expenses', expenseData);
    return res.data;
  },

  createExpense: async (expenseData) => {
    const res = await apiClient.post('/expenses', expenseData);
    return res.data;
  },

  getMyExpenses: async (params = {}) => {
    const res = await apiClient.get('/expenses/my', { params });
    return res.data;
  },

  getAllExpenses: async (params = {}) => {
    const res = await apiClient.get('/expenses', { params });
    return res.data;
  },

  getExpenseById: async (id) => {
    const res = await apiClient.get(`/expenses/${id}`);
    return res.data;
  },

  deleteExpense: async (id) => {
    const res = await apiClient.delete(`/expenses/${id}`);
    return res.data;
  },
};

export default expenseApi;
