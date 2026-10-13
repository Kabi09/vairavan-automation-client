import Holiday from '../models/Holiday.js';
import Notification from '../models/Notification.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import notificationService from '../services/notificationService.js';

/**
 * @desc    Create a new holiday
 * @route   POST /api/holidays
 * @access  Private/Admin
 */
export const createHoliday = asyncHandler(async (req, res) => {
  const { holidayName, startDate, endDate, description, status = 'active', notify = false } = req.body;

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end < start) {
    throw ApiError.badRequest('End date cannot be earlier than start date');
  }

  // Prevent duplicate holiday with the same name and year
  const startOfYear = new Date(start.getFullYear(), 0, 1);
  const endOfYear = new Date(start.getFullYear(), 11, 31, 23, 59, 59);

  const escapedName = holidayName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const duplicate = await Holiday.findOne({
    holidayName: new RegExp(`^${escapedName}$`, 'i'),
    startDate: { $gte: startOfYear, $lte: endOfYear },
    isDeleted: false,
  });

  if (duplicate) {
    throw ApiError.conflict(
      `A holiday named '${holidayName.trim()}' already exists for year ${start.getFullYear()}`
    );
  }

  const holiday = await Holiday.create({
    holidayName: holidayName.trim(),
    startDate: start,
    endDate: end,
    description: description ? description.trim() : '',
    status,
    createdBy: req.user._id,
  });

  const holidayDateStr = `${start.toISOString().split('T')[0]}${start.getTime() !== end.getTime() ? ` to ${end.toISOString().split('T')[0]}` : ''}`;
  const holidayMessage = `Company holiday scheduled for ${holidayDateStr}.${holiday.description ? ` Details: ${holiday.description}` : ''}`;

  // 1. Create in-app notification for all employees
  try {
    await Notification.create({
      recipientRole: 'employee',
      sender: req.user._id,
      type: 'holiday',
      title: `Upcoming Holiday: ${holiday.holidayName}`,
      message: holidayMessage,
      data: {
        holidayId: holiday._id,
        holidayName: holiday.holidayName,
        startDate: start,
        endDate: end,
        description: holiday.description,
        type: 'holiday',
      },
    });
  } catch (notifErr) {
    console.error('[Notification] Error creating in-app holiday notification:', notifErr.message);
  }

  // 2. Dispatch push notification to all employees via FCM
  try {
    const payload = {
      title: `Upcoming Holiday: ${holiday.holidayName}`,
      body: holidayMessage,
    };
    await notificationService.notifyAllEmployees(payload, {
      holidayId: holiday._id.toString(),
      type: 'holiday',
    });
  } catch (err) {
    console.error('[FCM] Error notifying employees of new holiday:', err.message);
  }

  return ApiResponse.created(res, 'Holiday created successfully', { holiday });
});

/**
 * @desc    Get holidays (Admin sees all; Employees/Staff see active holidays)
 * @route   GET /api/holidays
 * @access  Private (Admin / Employee / Staff)
 */
export const getHolidays = asyncHandler(async (req, res) => {
  const { year, status, startDate, endDate } = req.query;

  const filter = { isDeleted: false };

  if (req.user.role !== 'admin') {
    filter.status = 'active';
  } else if (status) {
    filter.status = status;
  }

  if (year) {
    const yr = parseInt(year, 10);
    filter.startDate = {
      $gte: new Date(`${yr}-01-01T00:00:00.000Z`),
      $lte: new Date(`${yr}-12-31T23:59:59.999Z`),
    };
  } else if (startDate || endDate) {
    filter.startDate = {};
    if (startDate) filter.startDate.$gte = new Date(startDate);
    if (endDate) filter.startDate.$lte = new Date(endDate);
  }

  const holidays = await Holiday.find(filter)
    .sort({ startDate: 1 })
    .populate('createdBy', 'employeeName employeeId');

  return ApiResponse.success(res, 200, 'Holidays retrieved successfully', { holidays });
});

/**
 * @desc    Get single holiday by ID
 * @route   GET /api/holidays/:id
 * @access  Private (Admin / Employee)
 */
export const getHolidayById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const holiday = await Holiday.findOne({ _id: id, isDeleted: false }).populate(
    'createdBy',
    'employeeName employeeId'
  );

  if (!holiday) {
    throw ApiError.notFound('Holiday not found');
  }

  return ApiResponse.success(res, 200, 'Holiday retrieved successfully', { holiday });
});

/**
 * @desc    Update holiday
 * @route   PUT /api/holidays/:id
 * @access  Private/Admin
 */
export const updateHoliday = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { holidayName, startDate, endDate, description, status } = req.body;

  const holiday = await Holiday.findOne({ _id: id, isDeleted: false });
  if (!holiday) {
    throw ApiError.notFound('Holiday not found');
  }

  if (startDate) holiday.startDate = new Date(startDate);
  if (endDate) holiday.endDate = new Date(endDate);

  if (holiday.endDate < holiday.startDate) {
    throw ApiError.badRequest('End date cannot be earlier than start date');
  }

  if (holidayName) holiday.holidayName = holidayName.trim();
  if (description !== undefined) holiday.description = description.trim();
  if (status) holiday.status = status;

  await holiday.save();

  return ApiResponse.success(res, 200, 'Holiday updated successfully', { holiday });
});

/**
 * @desc    Deactivate / Soft-delete holiday
 * @route   DELETE /api/holidays/:id
 * @access  Private/Admin
 */
export const deleteHoliday = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const holiday = await Holiday.findOne({ _id: id, isDeleted: false });
  if (!holiday) {
    throw ApiError.notFound('Holiday not found');
  }

  holiday.status = 'inactive';
  holiday.isDeleted = true;
  await holiday.save();

  return ApiResponse.success(res, 200, 'Holiday deactivated and archived successfully');
});

export default {
  createHoliday,
  getHolidays,
  getHolidayById,
  updateHoliday,
  deleteHoliday,
};
