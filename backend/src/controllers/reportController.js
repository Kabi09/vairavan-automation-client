import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';
import ApiError from '../utils/ApiError.js';
import {
  generateAllInOneReportData,
  generateAllInOneExcelBuffer,
} from '../services/reportService.js';

/**
 * @desc    Get complete All-in-One report data with optional pagination
 * @route   GET /api/reports/all-in-one
 * @access  Private (Admin only)
 */
export const getAllInOneReport = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    throw ApiError.forbidden('Only administrators can access operational reports');
  }

  const reportData = await generateAllInOneReportData(req.query);

  const exportAll = req.query.exportAll === 'true' || req.query.export === 'true';
  const page = parseInt(req.query.page, 10);
  const limit = parseInt(req.query.limit, 10) || 20;

  if (!exportAll && !isNaN(page) && page > 0) {
    const totalDuties = reportData.duties.length;
    const startIndex = (page - 1) * limit;
    const paginatedDuties = reportData.duties.slice(startIndex, startIndex + limit);

    return ApiResponse.success(res, 200, 'Report data fetched successfully', {
      ...reportData,
      duties: paginatedDuties,
      pagination: {
        total: totalDuties,
        page,
        limit,
        totalPages: Math.ceil(totalDuties / limit) || 1,
      },
    });
  }

  return ApiResponse.success(res, 200, 'Complete report data fetched successfully', reportData);
});

/**
 * @desc    Generate and export All-in-One Excel report (.xlsx)
 * @route   GET /api/reports/all-in-one/excel (or POST)
 * @access  Private (Admin only)
 */
export const exportAllInOneExcel = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    throw ApiError.forbidden('Only administrators can export operational reports');
  }

  const filters = req.method === 'POST' ? { ...req.query, ...req.body } : req.query;
  const reportData = await generateAllInOneReportData(filters);

  const buffer = await generateAllInOneExcelBuffer(reportData);
  const safeStart = (reportData.meta.startDate || 'start').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeEnd = (reportData.meta.endDate || 'end').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Vairavan_All_In_One_Report_${safeStart}_to_${safeEnd}.xlsx`;

  // If direct stream requested via query param
  if (req.query.format === 'stream' || req.query.download === 'true') {
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.end(buffer);
  }

  // Default JSON response containing base64 for mobile client
  return ApiResponse.success(res, 200, 'Excel report generated successfully', {
    filename,
    base64: Buffer.from(buffer).toString('base64'),
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    size: buffer.length,
    summary: reportData.summary,
  });
});

