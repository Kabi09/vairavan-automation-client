import { Router } from 'express';
import {
  createDuty,
  checkIn,
  getActiveCheckIn,
  checkOut,
  getMyDuties,
  getDutyById,
  updateDuty,
  getAllDuties,
  updateDutyStatus,
  deleteDuty,
} from '../controllers/dutyController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  validateCreateDuty,
  validateCheckIn,
  validateUpdateDuty,
  validateUpdateDutyStatus,
  validateDutyIdParam,
} from '../validators/dutyValidator.js';

const router = Router();

router.use(authenticate);

// Check-in and Check-out workflows
router.post('/check-in', authorize('employee', 'staff'), validateCheckIn, validate, checkIn);
router.get('/active-checkin', authorize('employee', 'staff', 'admin'), getActiveCheckIn);
router.post('/check-out', authorize('employee', 'staff', 'admin'), checkOut);
router.post('/:id/check-out', authorize('employee', 'staff', 'admin'), checkOut);

// Employee submits duty
router.post('/', authorize('employee', 'staff'), validateCreateDuty, validate, createDuty);

// Employee views own duties
router.get('/my', authorize('employee', 'staff'), getMyDuties);


// Admin views all duties
router.get('/', authorize('admin'), getAllDuties);

// View single duty (ownership checked inside controller)
router.get('/:id', validateDutyIdParam, validate, getDutyById);

// Edit duty (owner employee or admin)
router.put('/:id', validateUpdateDuty, validate, updateDuty);

// Admin changes duty review status
router.patch('/:id/status', authorize('admin'), validateUpdateDutyStatus, validate, updateDutyStatus);

// Admin deletes duty report
router.delete('/:id', authorize('admin'), validateDutyIdParam, validate, deleteDuty);

export default router;
