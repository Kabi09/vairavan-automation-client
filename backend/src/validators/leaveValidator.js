import { body, param } from 'express-validator';

export const validateCreateLeave = [
  body('leaveType')
    .optional()
    .isIn(['casual_leave', 'comp_off'])
    .withMessage("Leave type must be either 'casual_leave' or 'comp_off'"),
  body('reason')
    .trim()
    .notEmpty()
    .withMessage('Reason for leave is required')
    .isLength({ max: 1000 })
    .withMessage('Reason cannot exceed 1000 characters'),
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
];

export const validateReviewLeave = [
  param('id')
    .isMongoId()
    .withMessage('Invalid leave request ID format'),
  body('status')
    .notEmpty()
    .withMessage('Decision status is required')
    .isIn(['approved', 'rejected'])
    .withMessage('Status must be either approved or rejected'),
  body('adminRemarks')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Admin remarks cannot exceed 500 characters'),
  body('rejectionReason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Rejection reason cannot exceed 500 characters'),
];

export const validateLeaveIdParam = [
  param('id')
    .isMongoId()
    .withMessage('Invalid leave request ID format'),
];

export const validateAdminGrantLeave = [
  body('employeeId')
    .notEmpty()
    .withMessage('Employee ID is required')
    .isMongoId()
    .withMessage('Invalid employee ID format'),
  body('leaveType')
    .optional()
    .isIn(['casual_leave', 'comp_off'])
    .withMessage("Leave type must be either 'casual_leave' or 'comp_off'"),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Reason cannot exceed 1000 characters'),
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
  body('adminRemarks')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Admin remarks cannot exceed 500 characters'),
];

