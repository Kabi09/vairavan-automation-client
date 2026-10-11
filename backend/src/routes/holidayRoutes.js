import { Router } from 'express';
import {
  createHoliday,
  getHolidays,
  getHolidayById,
  updateHoliday,
  deleteHoliday,
} from '../controllers/holidayController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  validateCreateHoliday,
  validateUpdateHoliday,
  validateHolidayIdParam,
} from '../validators/holidayValidator.js';

const router = Router();

router.use(authenticate);

// View holidays (both Admin and Employee)
router.get('/', getHolidays);
router.get('/:id', validateHolidayIdParam, validate, getHolidayById);

// Admin-only mutations
router.post('/', authorize('admin'), validateCreateHoliday, validate, createHoliday);
router.put('/:id', authorize('admin'), validateUpdateHoliday, validate, updateHoliday);
router.delete('/:id', authorize('admin'), validateHolidayIdParam, validate, deleteHoliday);

export default router;
