import apiClient from './apiClient';

/**
 * All-in-One Operations & Executive Report API
 */
export const reportApi = {
  /**
   * Fetch complete or paginated All-in-One report data
   * @param {Object} params - { dateRange, startDate, endDate, companyId, clientId, employeeId, workType, workStatus, leaveType, leaveStatus, expenseCategory, page, limit, exportAll }
   */
  getAllInOneReport: async (params = {}) => {
    const res = await apiClient.get('/reports/all-in-one', { params });
    return res.data;
  },

  /**
   * Generate and export multi-worksheet Excel report (.xlsx)
   * Returns { success: true, data: { filename, base64, size, summary } }
   */
  exportExcel: async (params = {}) => {
    const res = await apiClient.get('/reports/all-in-one/excel', { params });
    return res.data;
  },
};

export default reportApi;

