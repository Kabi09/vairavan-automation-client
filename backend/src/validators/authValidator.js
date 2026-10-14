import { body } from 'express-validator';

export const validateLogin = [
  body('email')
    .customSanitizer((val, { req }) => {
      const input = (val || req.body.identifier || req.body.phoneNumber || '').toString().trim();
      return input;
    })
    .notEmpty()
    .withMessage('Email address or 10-digit mobile number is required')
    .custom((value) => {
      const cleanPhone = value.replace(/[\s-]/g, '').replace(/^\+91/, '');
      const isPhone = /^[0-9]{10}$/.test(cleanPhone);
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      if (!isPhone && !isEmail) {
        throw new Error('Please provide a valid email address or 10-digit mobile number');
      }
      return true;
    }),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

export const validateChangePassword = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long'),
];

export const validateRefreshToken = [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required'),
];

export const validateUpdateProfile = [
  body('employeeName')
    .optional({ checkFalsy: true })
    .trim()
    .notEmpty()
    .withMessage('Employee name cannot be empty')
    .isLength({ max: 100 })
    .withMessage('Employee name cannot exceed 100 characters'),
  body('email')
    .optional({ checkFalsy: true })
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('phoneNumber')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^(?:\+91)?[0-9]{10}$/)
    .withMessage('Phone number must be exactly 10 digits'),
  body('avatar')
    .optional()
    .isString(),
  body('dateOfBirth')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage('Date of birth must be a valid date (YYYY-MM-DD)'),
];
