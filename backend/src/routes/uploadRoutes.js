import { Router } from 'express';
import {
  uploadSignature,
  uploadProofPhotos,
  deleteUploadedAsset,
} from '../controllers/uploadController.js';
import { authenticate } from '../middleware/authenticate.js';
import {
  uploadSignatureMiddleware,
  uploadProofPhotosMiddleware,
} from '../middleware/upload.js';

const router = Router();

router.use(authenticate);

router.post('/signature', uploadSignatureMiddleware, uploadSignature);
router.post('/proof-photos', uploadProofPhotosMiddleware, uploadProofPhotos);
router.delete('/:publicId(*)', deleteUploadedAsset);

export default router;
