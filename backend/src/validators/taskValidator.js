import { body, param } from 'express-validator';

export const validateCreateTask = [
  body('employee')
    .notEmpty()
    .withMessage('Assigned employee is required')
    .isMongoId()
    .withMessage('Invalid employee ID format'),
  body('taskName')
    .trim()
    .notEmpty()
    .withMessage('Task name is required')
    .isLength({ max: 150 })
    .withMessage('Task name cannot exceed 150 characters'),
  body('date')
    .notEmpty()
    .withMessage('Date is required')
    .isISO8601()
    .withMessage('Date must be a valid ISO date (YYYY-MM-DD)'),
  body('companyName')
    .trim()
    .notEmpty()
    .withMessage('Company name is required')
    .isLength({ max: 150 })
    .withMessage('Company name cannot exceed 150 characters'),
  body('phoneNumber')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^(?:\+91)?[0-9]{10}$/)
    .withMessage('Phone number must be exactly 10 digits'),
  body('work')
    .trim()
    .notEmpty()
    .withMessage('Work details is required')
    .isLength({ max: 200 })
    .withMessage('Work details cannot exceed 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description cannot exceed 2000 characters'),
];

export const validateUpdateTaskStatus = [
  param('id')
    .isMongoId()
    .withMessage('Invalid task ID format'),
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['assigned', 'in_progress', 'completed', 'cancelled'])
    .withMessage('Status must be assigned, in_progress, completed, or cancelled'),
];

export const validateTaskIdParam = [
  param('id')
    .isMongoId()
    .withMessage('Invalid task ID format'),
];
