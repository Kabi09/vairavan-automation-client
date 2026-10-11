import { Router } from 'express';
import {
  getAdminDashboard,
  getEmployeeDashboard,
} from '../controllers/dashboardController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();

router.use(authenticate);

router.get('/admin', authorize('admin'), getAdminDashboard);
router.get('/employee', authorize('employee'), getEmployeeDashboard);

export default router;
