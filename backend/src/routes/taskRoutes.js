import { Router } from 'express';
import {
  createTask,
  getTasks,
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
  validateTaskId,
} from '../validators/taskValidator.js';

const router = Router();

router.use(authenticate);

// Admin creates a task and assigns to employees
router.post('/', authorize('admin'), validateCreateTask, validate, createTask);

// Get tasks list (Admin gets all, Employee gets assigned)
router.get('/', getTasks);

// Get single task by ID
router.get('/:id', validateTaskId, validate, getTaskById);

// Update task status (Admin or assigned Employee)
router.patch('/:id/status', validateUpdateTaskStatus, validate, updateTaskStatus);

// Admin deletes a task
router.delete('/:id', authorize('admin'), validateTaskId, validate, deleteTask);

export default router;
