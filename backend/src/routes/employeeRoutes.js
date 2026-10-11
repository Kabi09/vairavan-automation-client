import { Router } from 'express';
import {
  createEmployee,
  getEmployees,
  getEmployeeById,
  updateEmployee,
  updateEmployeeStatus,
  resetEmployeePassword,
} from '../controllers/employeeController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  validateCreateEmployee,
  validateUpdateEmployee,
  validateUpdateEmployeeStatus,
  validateResetEmployeePassword,
  validateEmployeeIdParam,
} from '../validators/employeeValidator.js';

const router = Router();

// All employee routes require authentication
router.use(authenticate);

// Admin-only employee creation and listing
router.post('/', authorize('admin'), validateCreateEmployee, validate, createEmployee);
router.get('/', authorize('admin'), getEmployees);

// Single employee retrieval (Admin or self-access verified inside controller)
router.get('/:id', validateEmployeeIdParam, validate, getEmployeeById);

// Admin-only updates
router.put('/:id', authorize('admin'), validateUpdateEmployee, validate, updateEmployee);
router.patch('/:id/status', authorize('admin'), validateUpdateEmployeeStatus, validate, updateEmployeeStatus);
router.patch('/:id/password', authorize('admin'), validateResetEmployeePassword, validate, resetEmployeePassword);

export default router;
