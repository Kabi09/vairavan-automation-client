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

// Dynamic max upload size in bytes (defaults to 10MB)
const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10);
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// Multer instance for customer signature (single file)
export const uploadSignatureMiddleware = multer({
  storage,
  limits: {
    fileSize: Math.min(2 * 1024 * 1024, MAX_FILE_SIZE_BYTES),
    files: 1,
  },
  fileFilter: imageFileFilter,
}).single('signature');

// Multer instance for customer proof photos (max MAX_FILE_SIZE_MB per file, up to 5 photos)
export const uploadProofPhotosMiddleware = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 5,
  },
  fileFilter: imageFileFilter,
}).array('photos', 5);

// Multer instance for avatar photo (single file)
export const uploadAvatarMiddleware = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
  },
  fileFilter: imageFileFilter,
}).single('avatar');

export default {
  uploadSignatureMiddleware,
  uploadProofPhotosMiddleware,
  uploadAvatarMiddleware,
};
