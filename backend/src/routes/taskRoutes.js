import { Router } from 'express';
import {
  createTask,
  getTasks,
  getMyTasks,
  getTaskById,
  updateTaskStatus,
  deleteTask,
} from '../controllers/taskController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  validateCreateTask,
  validateUpdateTaskStatus,
  validateTaskIdParam,
} from '../validators/taskValidator.js';

const router = Router();

router.use(authenticate);

// View own tasks (Employee / Staff)
router.get('/my', getMyTasks);

// Get tasks list (Admin sees all; Employee sees own)
router.get('/', getTasks);

// Admin assigns task
router.post('/', authorize('admin'), validateCreateTask, validate, createTask);

// Get single task
router.get('/:id', validateTaskIdParam, validate, getTaskById);

// Update status (assigned employee or admin)
router.patch('/:id/status', validateUpdateTaskStatus, validate, updateTaskStatus);

// Admin deletes task
router.delete('/:id', authorize('admin'), validateTaskIdParam, validate, deleteTask);

export default router;
