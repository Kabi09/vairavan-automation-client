import { Router } from 'express';
import {
  getExpenseCategories,
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
} from '../controllers/expenseCategoryController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();

router.use(authenticate);

router.get('/', getExpenseCategories);
router.post('/', authorize('admin'), createExpenseCategory);
router.put('/:id', authorize('admin'), updateExpenseCategory);
router.delete('/:id', authorize('admin'), deleteExpenseCategory);

export default router;
