import multer from 'multer';
import ApiError from '../utils/ApiError.js';

// Use in-memory storage buffer
const storage = multer.memoryStorage();

// Allowed image MIME types
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/svg+xml'];

const imageFileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      ApiError.badRequest(
        `Invalid file type '${file.mimetype}'. Only JPEG, PNG, WebP, and SVG images are allowed.`
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

// Allowed extensions for shared document uploads
const ALLOWED_DOCUMENT_EXTS = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'txt',
  'csv',
  'rtf',
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'svg',
  'zip',
  'rar',
  '7z',
  'tar',
  'gz',
  'json',
  'xml',
]);

const documentFileFilter = (req, file, cb) => {
  const ext = (file.originalname || '').split('.').pop()?.toLowerCase();
  if (ext && ALLOWED_DOCUMENT_EXTS.has(ext)) {
    return cb(null, true);
  }

  // Also check general mime types
  const mime = file.mimetype?.toLowerCase() || '';
  if (
    mime.startsWith('image/') ||
    mime.startsWith('text/') ||
    mime.includes('pdf') ||
    mime.includes('word') ||
    mime.includes('excel') ||
    mime.includes('spreadsheet') ||
    mime.includes('presentation') ||
    mime.includes('powerpoint') ||
    mime.includes('zip') ||
    mime.includes('compressed') ||
    mime === 'application/octet-stream'
  ) {
    return cb(null, true);
  }

  return cb(
    ApiError.badRequest(
      `File format for '${file.originalname}' is not supported. Supported: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, Images, ZIP.`
    ),
    false
  );
};

// Max size for shared documents: 25MB per file, up to 10 files
export const uploadDocumentsMiddleware = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
    files: 10,
  },
  fileFilter: documentFileFilter,
}).array('files', 10);

export default {
  uploadSignatureMiddleware,
  uploadProofPhotosMiddleware,
  uploadAvatarMiddleware,
  uploadDocumentsMiddleware,
};

