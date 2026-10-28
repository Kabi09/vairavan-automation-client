import { Router } from 'express';
import {
  uploadDocuments,
  getDocuments,
  deleteDocument,
  getUnreadDocumentCount,
  markDocumentsViewed,
} from '../controllers/documentController.js';
import { authenticate } from '../middleware/authenticate.js';
import { uploadDocumentsMiddleware } from '../middleware/upload.js';
import {
  validateUploadDocument,
  validateDocumentIdParam,
} from '../validators/documentValidator.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// All document routes require authentication (both Admin and Employee)
router.use(authenticate);

// Get all shared documents (supports ?search= &role=admin|employee &page= &limit=)
router.get('/', getDocuments);

// Get unread document notification count for current user
router.get('/unread-count', getUnreadDocumentCount);

// Mark all document upload notifications as viewed
router.patch('/mark-viewed', markDocumentsViewed);

// Upload new documents with multiple files
router.post(
  '/',
  uploadDocumentsMiddleware,
  validateUploadDocument,
  validate,
  uploadDocuments
);

// Delete document (admins can delete any, users can delete only their own)
router.delete('/:id', validateDocumentIdParam, validate, deleteDocument);

export default router;
