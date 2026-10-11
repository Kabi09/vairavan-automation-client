import { Router } from 'express';
import {
  createLeave,
  getMyLeaves,
  getLeaveById,
  getAllLeaves,
  reviewLeave,
  cancelLeave,
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

// Employee submits leave request
router.post('/', authorize('employee'), validateCreateLeave, validate, createLeave);

// Employee views own leaves
router.get('/my', authorize('employee'), getMyLeaves);

// Admin views all employee leave requests
router.get('/', authorize('admin'), getAllLeaves);

// View single leave request (ownership checked inside controller)
router.get('/:id', validateLeaveIdParam, validate, getLeaveById);

// Admin reviews leave request (Approve/Reject)
router.patch('/:id/review', authorize('admin'), validateReviewLeave, validate, reviewLeave);

// Employee cancels own pending leave request
router.patch('/:id/cancel', validateLeaveIdParam, validate, cancelLeave);

export default router;
