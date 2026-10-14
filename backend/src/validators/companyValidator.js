import { body, param } from 'express-validator';
import mongoose from 'express-validator';

export const validateCreateCompany = [
  body('companyName')
    .trim()
    .notEmpty()
    .withMessage('Company name is required')
    .isLength({ max: 150 })
    .withMessage('Company name cannot exceed 150 characters'),
  body('location')
    .trim()
    .notEmpty()
    .withMessage('Location is required')
    .isLength({ max: 200 })
    .withMessage('Location cannot exceed 200 characters'),
  body('companyPhoneNumber')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^(?:\+91)?[0-9]{10}$/)
    .withMessage('Company phone number must be exactly 10 digits'),
  body('companyType')
    .optional()
    .isIn(['office', 'client'])
    .withMessage('Company type must be either office or client'),
  body('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Status must be either active or inactive'),
];

export const validateUpdateCompany = [
  param('id')
    .isMongoId()
    .withMessage('Invalid company ID format'),
  body('companyName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Company name cannot be empty')
    .isLength({ max: 150 })
    .withMessage('Company name cannot exceed 150 characters'),
  body('location')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Location cannot be empty')
    .isLength({ max: 200 })
    .withMessage('Location cannot exceed 200 characters'),
  body('companyPhoneNumber')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^(?:\+91)?[0-9]{10}$/)
    .withMessage('Company phone number must be exactly 10 digits'),
  body('companyType')
    .optional()
    .isIn(['office', 'client'])
    .withMessage('Company type must be either office or client'),
  body('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Status must be either active or inactive'),
];

export const validateCompanyIdParam = [
  param('id')
    .isMongoId()
    .withMessage('Invalid company ID format'),
];
