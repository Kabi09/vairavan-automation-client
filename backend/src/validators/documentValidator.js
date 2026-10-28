import { body, param, query } from 'express-validator';

export const validateUploadDocument = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Document title is required')
    .isLength({ min: 2, max: 150 })
    .withMessage('Document title must be between 2 and 150 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
];

export const validateDocumentIdParam = [
  param('id')
    .isMongoId()
    .withMessage('Invalid document ID format'),
];

export default {
  validateUploadDocument,
  validateDocumentIdParam,
};
