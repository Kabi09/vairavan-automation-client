import { Router } from 'express';
import {
  uploadSignature,
  uploadProofPhotos,
  deleteUploadedAsset,
  streamUploadedFile,
} from '../controllers/uploadController.js';
import { authenticate } from '../middleware/authenticate.js';
import {
  uploadSignatureMiddleware,
  uploadProofPhotosMiddleware,
} from '../middleware/upload.js';

const router = Router();

// Streaming proxy fallback route (allows direct <img> embeds if bucket is private)
router.get('/file/*', streamUploadedFile);

// Authenticated upload and delete endpoints
router.use(authenticate);

router.post('/signature', uploadSignatureMiddleware, uploadSignature);
router.post('/proof-photos', uploadProofPhotosMiddleware, uploadProofPhotos);
router.delete('/:key(*)', deleteUploadedAsset);

export default router;
