import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import {
  getAllInOneReport,
  exportAllInOneExcel,
} from '../controllers/reportController.js';

const router = Router();

// Secure all report routes with Admin authentication
router.use(authenticate, authorize('admin'));

// GET /api/reports/all-in-one - Fetch aggregated operational report data
router.get('/all-in-one', getAllInOneReport);

// GET & POST /api/reports/all-in-one/excel - Export multi-worksheet Excel (.xlsx) file
router.get('/all-in-one/excel', exportAllInOneExcel);
router.post('/all-in-one/excel', exportAllInOneExcel);

export default router;
