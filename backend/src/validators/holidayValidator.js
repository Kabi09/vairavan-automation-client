import { body, param } from 'express-validator';

export const validateCreateHoliday = [
  body('holidayName')
    .trim()
    .notEmpty()
    .withMessage('Holiday name is required')
    .isLength({ max: 100 })
    .withMessage('Holiday name cannot exceed 100 characters'),
  body('startDate')
    .notEmpty()
    .withMessage('Start date is required')
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  body('endDate')
    .notEmpty()
    .withMessage('End date is required')
    .isISO8601()
    .withMessage('End date must be a valid date')
    .custom((endDate, { req }) => {
      const start = new Date(req.body.startDate);
      const end = new Date(endDate);
      if (end < start) {
        throw new Error('End date cannot be earlier than start date');
      }
      return true;
    }),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 }),
  body('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Status must be either active or inactive'),
];

export const validateUpdateHoliday = [
  param('id')
    .isMongoId()
    .withMessage('Invalid holiday ID format'),
  body('holidayName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Holiday name cannot be empty')
    .isLength({ max: 100 }),
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date')
    .custom((endDate, { req }) => {
      if (req.body.startDate) {
        const start = new Date(req.body.startDate);
        const end = new Date(endDate);
        if (end < start) {
          throw new Error('End date cannot be earlier than start date');
        }
      }
      return true;
    }),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 }),
  body('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Status must be either active or inactive'),
];

export const validateHolidayIdParam = [
  param('id')
    .isMongoId()
    .withMessage('Invalid holiday ID format'),
];
