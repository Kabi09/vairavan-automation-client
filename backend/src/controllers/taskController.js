import mongoose from 'mongoose';
import Task from '../models/Task.js';
import Company from '../models/Company.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendNotificationToUser, notifyAdmins } from '../services/notificationService.js';

/**
 * @desc Create and assign a new task
 * @route POST /api/tasks
 * @access Admin only
 */
export const createTask = asyncHandler(async (req, res) => {
  const { taskName, companyId, company: companyBodyId, description, assignedEmployees, priority } = req.body;
  const targetCompanyId = companyBodyId || companyId;

  // 1. Validate Company
  const company = await Company.findById(targetCompanyId);
  if (!company) {
    throw ApiError.notFound('Client company not found');
  }

  // 2. Validate Assigned Employees
  if (!Array.isArray(assignedEmployees) || assignedEmployees.length === 0) {
    throw ApiError.badRequest('At least one employee must be assigned');
  }

  const validEmployees = await User.find({
    _id: { $in: assignedEmployees },
    accountStatus: 'active',
  }).select('_id employeeName employeeId designation email phoneNumber avatar');

  if (validEmployees.length === 0) {
    throw ApiError.badRequest('No valid active employees found for assignment');
  }

  const validEmployeeIds = validEmployees.map((e) => e._id);

  // 3. Create Task
  const task = await Task.create({
    taskName: taskName.trim(),
    company: company._id,
    description: (description || '').trim(),
    assignedEmployees: validEmployeeIds,
    createdBy: req.user._id,
    priority: priority || 'medium',
    status: 'pending',
  });

  const populatedTask = await Task.findById(task._id)
    .populate('company', 'companyName location contactPerson phone email')
    .populate('assignedEmployees', 'employeeName employeeId designation email phoneNumber avatar')
    .populate('createdBy', 'employeeName employeeId');

  // 4. Dispatch In-App Notifications to All Assigned Employees
  const inAppNotifications = validEmployees.map((emp) => ({
    recipient: emp._id,
    recipientRole: 'employee',
    sender: req.user._id,
    type: 'task_assigned',
    title: 'New Task Assigned 📌',
    message: `${task.taskName} for ${company.companyName}`,
    data: {
      taskId: task._id,
      taskName: task.taskName,
      companyId: company._id,
      companyName: company.companyName,
      companyLocation: company.location || '',
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      createdAt: task.createdAt,
    },
    isRead: false,
  }));

  if (inAppNotifications.length > 0) {
    await Notification.insertMany(inAppNotifications).catch((err) => {
      console.error('[Task] Failed to insert in-app notifications:', err.message);
    });
  }

  // 5. Dispatch FCM & Expo Push Notifications
  for (const emp of validEmployees) {
    sendNotificationToUser(
      emp._id,
      {
        title: 'New Task Assigned 📌',
        body: `Task: ${task.taskName} | Company: ${company.companyName}`,
      },
      {
        type: 'task_assigned',
        taskId: task._id.toString(),
        taskName: task.taskName,
        companyName: company.companyName,
        companyLocation: company.location || '',
      }
    ).catch((err) => console.warn(`[Task Push] Push dispatch failed for ${emp._id}:`, err.message));
  }

  return ApiResponse.success(res, 201, 'Task created and assigned successfully', {
    task: populatedTask,
  });
});

/**
 * @desc Get tasks list (Admin gets all, Employee gets assigned tasks)
 * @route GET /api/tasks
 * @access Admin & Employee
 */
export const getTasks = asyncHandler(async (req, res) => {
  const { status, companyId, employeeId, search } = req.query;
  const filter = {};

  // If user is employee/staff, strictly filter tasks assigned to them
  if (req.user.role !== 'admin') {
    filter.assignedEmployees = req.user._id;
  } else if (employeeId) {
    filter.assignedEmployees = employeeId;
  }

  if (status) {
    filter.status = status;
  }

  if (companyId) {
    filter.company = companyId;
  }

  if (search && search.trim()) {
    filter.taskName = { $regex: search.trim(), $options: 'i' };
  }

  const tasks = await Task.find(filter)
    .sort({ createdAt: -1 })
    .populate('company', 'companyName location contactPerson phone email')
    .populate('assignedEmployees', 'employeeName employeeId designation email phoneNumber avatar')
    .populate('createdBy', 'employeeName employeeId')
    .populate('completedBy', 'employeeName employeeId')
    .lean();

  return ApiResponse.success(res, 200, 'Tasks retrieved successfully', {
    tasks,
    total: tasks.length,
  });
});

/**
 * @desc Get single task details
 * @route GET /api/tasks/:id
 * @access Admin & Employee (if assigned)
 */
export const getTaskById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const task = await Task.findById(id)
    .populate('company', 'companyName location contactPerson phone email address')
    .populate('assignedEmployees', 'employeeName employeeId designation email phoneNumber avatar')
    .populate('createdBy', 'employeeName employeeId')
    .populate('completedBy', 'employeeName employeeId');

  if (!task) {
    throw ApiError.notFound('Task not found');
  }

  // If not admin, check if employee is assigned to this task
  if (req.user.role !== 'admin') {
    const isAssigned = task.assignedEmployees.some(
      (e) => e._id.toString() === req.user._id.toString()
    );
    if (!isAssigned) {
      throw ApiError.forbidden('You are not authorized to view this task');
    }
  }

  return ApiResponse.success(res, 200, 'Task details retrieved successfully', { task });
});

/**
 * @desc Update task status
 * @route PATCH /api/tasks/:id/status
 * @access Admin & Assigned Employee
 */
export const updateTaskStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const task = await Task.findById(id).populate('company', 'companyName location');
  if (!task) {
    throw ApiError.notFound('Task not found');
  }

  // Verify permission
  if (req.user.role !== 'admin') {
    const isAssigned = task.assignedEmployees.some(
      (e) => e.toString() === req.user._id.toString()
    );
    if (!isAssigned) {
      throw ApiError.forbidden('You are not assigned to this task');
    }
  }

  task.status = status;
  if (status === 'completed') {
    task.completedAt = new Date();
    task.completedBy = req.user._id;

    // Notify Admins if completed by employee
    if (req.user.role !== 'admin') {
      notifyAdmins(
        {
          title: 'Task Completed ✅',
          body: `${req.user.employeeName} completed task: ${task.taskName}`,
        },
        {
          type: 'task',
          taskId: task._id.toString(),
          taskName: task.taskName,
        }
      ).catch(() => {});
    }
  } else {
    task.completedAt = null;
    task.completedBy = null;
  }

  await task.save();

  const updatedTask = await Task.findById(task._id)
    .populate('company', 'companyName location contactPerson phone email')
    .populate('assignedEmployees', 'employeeName employeeId designation email phoneNumber avatar')
    .populate('createdBy', 'employeeName employeeId')
    .populate('completedBy', 'employeeName employeeId');

  return ApiResponse.success(res, 200, 'Task status updated successfully', {
    task: updatedTask,
  });
});

/**
 * @desc Delete task
 * @route DELETE /api/tasks/:id
 * @access Admin only
 */
export const deleteTask = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const task = await Task.findById(id);
  if (!task) {
    throw ApiError.notFound('Task not found');
  }

  await Task.findByIdAndDelete(id);

  return ApiResponse.success(res, 200, 'Task deleted successfully');
});
