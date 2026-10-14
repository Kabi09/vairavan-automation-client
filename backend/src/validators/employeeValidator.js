import { body, param, query } from 'express-validator';

export const validateCreateEmployee = [
  body('employeeName')
    .trim()
    .notEmpty()
    .withMessage('Employee name is required')
    .isLength({ max: 100 })
    .withMessage('Employee name cannot exceed 100 characters'),
  body('employeeId')
    .trim()
    .notEmpty()
    .withMessage('Employee ID is required')
    .isLength({ min: 2, max: 30 })
    .withMessage('Employee ID must be between 2 and 30 characters'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email address is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('phoneNumber')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^(?:\+91)?[0-9]{10}$/)
    .withMessage('Phone number must be exactly 10 digits'),
  body('address')
    .optional()
    .trim(),
  body('designation')
    .optional()
    .trim(),
  body('joiningDate')
    .optional()
    .isISO8601()
    .withMessage('Joining date must be a valid date'),
  body('dateOfBirth')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage('Date of birth must be a valid date'),
  body('role')
    .optional()
    .isIn(['admin', 'employee', 'staff'])
    .withMessage('Role must be admin, employee, or staff'),
  body('accountStatus')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Account status must be either active or inactive'),
];

export const validateUpdateEmployee = [
  param('id')
    .isMongoId()
    .withMessage('Invalid employee ID format'),
  body('employeeName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Employee name cannot be empty')
    .isLength({ max: 100 })
    .withMessage('Employee name cannot exceed 100 characters'),
  body('phoneNumber')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^(?:\+91)?[0-9]{10}$/)
    .withMessage('Phone number must be exactly 10 digits'),
  body('address')
    .optional()
    .trim(),
  body('designation')
    .optional()
    .trim(),
  body('joiningDate')
    .optional()
    .isISO8601()
    .withMessage('Joining date must be a valid date'),
  body('dateOfBirth')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage('Date of birth must be a valid date'),
  body('role')
    .optional()
    .isIn(['admin', 'employee', 'staff'])
    .withMessage('Role must be admin, employee, or staff'),
];

export const validateUpdateEmployeeStatus = [
  param('id')
    .isMongoId()
    .withMessage('Invalid employee ID format'),
  body('accountStatus')
    .notEmpty()
    .withMessage('Account status is required')
    .isIn(['active', 'inactive'])
    .withMessage('Account status must be either active or inactive'),
];

export const validateResetEmployeePassword = [
  param('id')
    .isMongoId()
    .withMessage('Invalid employee ID format'),
  body('newPassword')
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long'),
];

export const validateEmployeeIdParam = [
  param('id')
    .isMongoId()
    .withMessage('Invalid employee ID format'),
];
