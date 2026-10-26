import { Router } from 'express';
import {
  createExpense,
  getMyExpenses,
  getAllExpenses,
  getExpenseById,
  deleteExpense,
} from '../controllers/expenseController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();

router.use(authenticate);

// Submit expense (Employee, Staff, Admin)
router.post('/', authorize('employee', 'staff', 'admin'), createExpense);

// Get current user's expenses
router.get('/my', authorize('employee', 'staff', 'admin'), getMyExpenses);

// Admin view all employee expenses with dashboard metrics
router.get('/', authorize('admin'), getAllExpenses);

// View single expense record
router.get('/:id', getExpenseById);

// Delete expense
router.delete('/:id', deleteExpense);

export default router;
