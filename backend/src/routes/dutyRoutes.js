import { Router } from 'express';
import {
  createDuty,
  getMyDuties,
  getDutyById,
  updateDuty,
  getAllDuties,
  updateDutyStatus,
} from '../controllers/dutyController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  validateCreateDuty,
  validateUpdateDuty,
  validateUpdateDutyStatus,
  validateDutyIdParam,
} from '../validators/dutyValidator.js';

const router = Router();

router.use(authenticate);

// Employee submits duty
router.post('/', authorize('employee'), validateCreateDuty, validate, createDuty);

// Employee views own duties
router.get('/my', authorize('employee'), getMyDuties);

// Admin views all duties
router.get('/', authorize('admin'), getAllDuties);

// View single duty (ownership checked inside controller)
router.get('/:id', validateDutyIdParam, validate, getDutyById);

// Employee edits own duty
router.put('/:id', validateUpdateDuty, validate, updateDuty);

// Admin changes duty review status
router.patch('/:id/status', authorize('admin'), validateUpdateDutyStatus, validate, updateDutyStatus);

export default router;
