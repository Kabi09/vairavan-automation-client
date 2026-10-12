import Task from '../models/Task.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import notificationService from '../services/notificationService.js';

/**
 * @desc    Assign a new task to an employee
 * @route   POST /api/tasks
 * @access  Private/Admin
 */
export const createTask = asyncHandler(async (req, res) => {
  const { employee, taskName, date, companyName, phoneNumber, work, description = '' } = req.body;

  const targetEmployee = await User.findOne({
    _id: employee,
    accountStatus: 'active',
  });

  if (!targetEmployee) {
    throw ApiError.notFound('Target employee not found or is currently inactive');
  }

  const cleanPhone = phoneNumber.replace(/\D/g, '').slice(-10);

  const task = await Task.create({
    taskName: taskName.trim(),
    employee,
    date: new Date(date),
    companyName: companyName.trim(),
    phoneNumber: cleanPhone,
    work: work.trim(),
    description: description.trim(),
    status: 'assigned',
    assignedBy: req.user._id,
  });

  const populatedTask = await Task.findById(task._id)
    .populate('employee', 'employeeName employeeId email phoneNumber designation')
    .populate('assignedBy', 'employeeName employeeId');

  // Create in-app notification for the assigned employee
  try {
    await Notification.create({
      recipient: targetEmployee._id,
      recipientRole: targetEmployee.role,
      sender: req.user._id,
      type: 'duty_submitted',
      title: `New Task Assigned: ${taskName.trim()}`,
      message: `You have been assigned to "${taskName.trim()}" at ${companyName.trim()} scheduled for ${new Date(date).toLocaleDateString('en-GB')}.`,
      data: {
        taskId: task._id,
        taskName: taskName.trim(),
        companyName: companyName.trim(),
        date: task.date,
        work: task.work,
      },
    });
  } catch (notifErr) {
    console.error('[Notification] Error creating task notification:', notifErr.message);
  }

  // Send Push notification via FCM
  try {
    const pushPayload = {
      title: `New Task: ${taskName.trim()}`,
      body: `Assigned at ${companyName.trim()} (${work.trim()}) for ${new Date(date).toLocaleDateString('en-GB')}.`,
    };
    await notificationService.sendNotificationToUser(targetEmployee._id, pushPayload, {
      taskId: task._id.toString(),
      type: 'task_assigned',
    });
  } catch (pushErr) {
    console.error('[FCM] Error dispatching task push notification:', pushErr.message);
  }

  return ApiResponse.created(res, 'Task assigned successfully', { task: populatedTask });
});

/**
 * @desc    Get all tasks (Admin sees all; Employee sees own tasks)
 * @route   GET /api/tasks
 * @access  Private
 */
export const getTasks = asyncHandler(async (req, res) => {
  const { employee, status, date, startDate, endDate, search, limit = 500 } = req.query;

  const filter = { isDeleted: false };

  // If user is not admin, restrict strictly to their own assigned tasks
  if (req.user.role !== 'admin') {
    filter.employee = req.user._id;
  } else if (employee) {
    filter.employee = employee;
  }

  if (status) {
    filter.status = status;
  }

  if (date) {
    const d = new Date(date);
    const startOfDay = new Date(d.setHours(0, 0, 0, 0));
    const endOfDay = new Date(d.setHours(23, 59, 59, 999));
    filter.date = { $gte: startOfDay, $lte: endOfDay };
  } else if (startDate || endDate) {
    filter.date = {};
    if (startDate) {
      filter.date.$gte = new Date(new Date(startDate).setHours(0, 0, 0, 0));
    }
    if (endDate) {
      filter.date.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    }
  }

  if (search) {
    const q = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { taskName: new RegExp(q, 'i') },
      { companyName: new RegExp(q, 'i') },
      { work: new RegExp(q, 'i') },
      { phoneNumber: new RegExp(q, 'i') },
    ];
  }

  const tasks = await Task.find(filter)
    .sort({ date: -1, createdAt: -1 })
    .limit(parseInt(limit, 10))
    .populate('employee', 'employeeName employeeId email phoneNumber designation')
    .populate('assignedBy', 'employeeName employeeId');

  return ApiResponse.success(res, 200, 'Tasks retrieved successfully', { tasks });
});

/**
 * @desc    Get authenticated employee's assigned tasks
 * @route   GET /api/tasks/my
 * @access  Private (Employee / Staff)
 */
export const getMyTasks = asyncHandler(async (req, res) => {
  const { status, date } = req.query;

  const filter = {
    employee: req.user._id,
    isDeleted: false,
  };

  if (status) {
    filter.status = status;
  }

  if (date) {
    const d = new Date(date);
    const startOfDay = new Date(d.setHours(0, 0, 0, 0));
    const endOfDay = new Date(d.setHours(23, 59, 59, 999));
    filter.date = { $gte: startOfDay, $lte: endOfDay };
  }

  const tasks = await Task.find(filter)
    .sort({ date: 1, createdAt: -1 })
    .populate('assignedBy', 'employeeName employeeId');

  return ApiResponse.success(res, 200, 'Assigned tasks retrieved successfully', { tasks });
});

/**
 * @desc    Get single task by ID
 * @route   GET /api/tasks/:id
 * @access  Private
 */
export const getTaskById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const task = await Task.findOne({ _id: id, isDeleted: false })
    .populate('employee', 'employeeName employeeId email phoneNumber designation')
    .populate('assignedBy', 'employeeName employeeId');

  if (!task) {
    throw ApiError.notFound('Task not found');
  }

  // Authorization: Admins can view any; Employees can only view their own
  if (req.user.role !== 'admin' && task.employee._id.toString() !== req.user._id.toString()) {
    throw ApiError.forbidden('You do not have permission to view this task');
  }

  return ApiResponse.success(res, 200, 'Task retrieved successfully', { task });
});

/**
 * @desc    Update task status (e.g. assigned -> in_progress -> completed)
 * @route   PATCH /api/tasks/:id/status
 * @access  Private
 */
export const updateTaskStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const task = await Task.findOne({ _id: id, isDeleted: false });
  if (!task) {
    throw ApiError.notFound('Task not found');
  }

  // Ensure user is assigned employee or admin
  if (req.user.role !== 'admin' && task.employee.toString() !== req.user._id.toString()) {
    throw ApiError.forbidden('You do not have permission to update this task');
  }

  task.status = status;
  await task.save();

  const populatedTask = await Task.findById(task._id)
    .populate('employee', 'employeeName employeeId email phoneNumber')
    .populate('assignedBy', 'employeeName employeeId');

  return ApiResponse.success(res, 200, 'Task status updated successfully', { task: populatedTask });
});

/**
 * @desc    Delete / Cancel a task
 * @route   DELETE /api/tasks/:id
 * @access  Private/Admin
 */
export const deleteTask = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const task = await Task.findOne({ _id: id, isDeleted: false });
  if (!task) {
    throw ApiError.notFound('Task not found');
  }

  task.isDeleted = true;
  task.status = 'cancelled';
  await task.save();

  return ApiResponse.success(res, 200, 'Task deleted successfully');
});

export default {
  createTask,
  getTasks,
  getMyTasks,
  getTaskById,
  updateTaskStatus,
  deleteTask,
};
