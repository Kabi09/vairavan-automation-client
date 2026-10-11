import multer from 'multer';
import ApiError from '../utils/ApiError.js';

// Use in-memory storage buffer
const storage = multer.memoryStorage();

// Allowed image MIME types
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

const imageFileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      ApiError.badRequest(
        `Invalid file type '${file.mimetype}'. Only JPEG, PNG, and WebP images are allowed.`
      ),
      false
    );
  }
};

// Multer instance for customer signature (max 2MB, single file)
export const uploadSignatureMiddleware = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
    files: 1,
  },
  fileFilter: imageFileFilter,
}).single('signature');

// Multer instance for customer proof photos (max 5MB per file, up to 5 photos)
export const uploadProofPhotosMiddleware = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 5,
  },
  fileFilter: imageFileFilter,
}).array('photos', 5);

export default {
  uploadSignatureMiddleware,
  uploadProofPhotosMiddleware,
};
