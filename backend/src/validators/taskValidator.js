import { body, param, query } from 'express-validator';

const TASK_STATUSES = ['pending', 'in_progress', 'completed'];
const TASK_PRIORITIES = ['low', 'medium', 'high'];

export const validateCreateTask = [
  body('taskName')
    .trim()
    .notEmpty()
    .withMessage('Task name is required')
    .isLength({ max: 200 })
    .withMessage('Task name cannot exceed 200 characters'),
  body('company')
    .custom((value, { req }) => {
      const companyVal = value || req.body.companyId;
      if (!companyVal) {
        throw new Error('Client Company is required');
      }
      return true;
    }),
  body('assignedEmployees')
    .isArray({ min: 1 })
    .withMessage('At least one employee must be assigned to the task'),
  body('assignedEmployees.*')
    .isMongoId()
    .withMessage('Invalid employee ID in assigned employees list'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description cannot exceed 2000 characters'),
  body('priority')
    .optional()
    .isIn(TASK_PRIORITIES)
    .withMessage(`Priority must be one of: ${TASK_PRIORITIES.join(', ')}`),
];

export const validateUpdateTaskStatus = [
  param('id')
    .isMongoId()
    .withMessage('Invalid task ID format'),
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(TASK_STATUSES)
    .withMessage(`Status must be one of: ${TASK_STATUSES.join(', ')}`),
];

export const validateTaskId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid task ID format'),
];
