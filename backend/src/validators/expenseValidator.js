import { body, param, query } from 'express-validator';

const EXPENSE_CATEGORIES = [
  'Travel',
  'Food',
  'Accommodation',
  'Materials',
  'Maintenance',
  'Miscellaneous',
  'Other',
];

const EXPENSE_STATUSES = ['pending', 'approved', 'rejected'];

export const validateCreateExpense = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Expense title is required')
    .isLength({ max: 150 })
    .withMessage('Expense title cannot exceed 150 characters'),
  body('amount')
    .notEmpty()
    .withMessage('Expense amount is required')
    .isFloat({ min: 0 })
    .withMessage('Amount must be a non-negative number'),
  body('expenseDate')
    .optional()
    .isISO8601()
    .withMessage('Expense date must be a valid date'),
  body('category')
    .notEmpty()
    .withMessage('Expense category is required')
    .isIn(EXPENSE_CATEGORIES)
    .withMessage(`Category must be one of: ${EXPENSE_CATEGORIES.join(', ')}`),
  body('companyId')
    .optional({ checkFalsy: true })
    .isMongoId()
    .withMessage('Invalid company ID format'),
  body('dutyId')
    .optional({ checkFalsy: true })
    .isMongoId()
    .withMessage('Invalid duty ID format'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  body('receiptPhotos')
    .optional()
    .isArray()
    .withMessage('Receipt photos must be an array of photo objects'),
];

export const validateReviewExpense = [
  param('id')
    .isMongoId()
    .withMessage('Invalid expense ID format'),
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(EXPENSE_STATUSES)
    .withMessage(`Status must be one of: ${EXPENSE_STATUSES.join(', ')}`),
  body('adminRemarks')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Admin remarks cannot exceed 500 characters'),
];

export const validateExpenseIdParam = [
  param('id')
    .isMongoId()
    .withMessage('Invalid expense ID format'),
];
