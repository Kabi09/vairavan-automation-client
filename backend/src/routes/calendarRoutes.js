import { Router } from 'express';
import { getMonthlyCalendar } from '../controllers/calendarController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();

router.use(authenticate);

// Monthly calendar feed (Employee views own, Admin views own or any employee's)
router.get('/monthly', authorize('employee', 'staff', 'admin'), getMonthlyCalendar);

export default router;
