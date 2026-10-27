import { Router } from 'express';
import {
  createLeave,
  getMyLeaves,
  getLeaveBalances,
  getLeaveById,
  getAllLeaves,
  reviewLeave,
  cancelLeave,
  getLeaveConfig,
  updateLeaveConfig,
  updateEmployeeAllowance,
} from '../controllers/leaveController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  validateCreateLeave,
  validateReviewLeave,
  validateLeaveIdParam,
} from '../validators/leaveValidator.js';

const router = Router();

router.use(authenticate);

// View leave balances (Employee views own, Admin views own or any employee's)
router.get('/balances', authorize('employee', 'staff', 'admin'), getLeaveBalances);

// Leave configuration (Admin only)
router.get('/config', authorize('admin'), getLeaveConfig);
router.patch('/config', authorize('admin'), updateLeaveConfig);

// Specific employee CL allowance configuration (Admin only)
router.patch('/employee-allowance/:id', authorize('admin'), updateEmployeeAllowance);

// Submit leave request (Employee, Staff, Admin)
router.post('/', authorize('employee', 'staff', 'admin'), validateCreateLeave, validate, createLeave);

// View own leaves (Employee, Staff, Admin)
router.get('/my', authorize('employee', 'staff', 'admin'), getMyLeaves);

// Admin views all employee leave requests
router.get('/', authorize('admin'), getAllLeaves);

// View single leave request (ownership checked inside controller)
router.get('/:id', validateLeaveIdParam, validate, getLeaveById);

// Admin reviews leave request (Approve/Reject)
router.patch('/:id/review', authorize('admin'), validateReviewLeave, validate, reviewLeave);

// Employee cancels own pending leave request
router.patch('/:id/cancel', validateLeaveIdParam, validate, cancelLeave);

export default router;
