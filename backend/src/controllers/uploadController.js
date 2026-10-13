import r2Service from '../services/r2Service.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * @desc    Upload customer signature image to Cloudflare R2
 * @route   POST /api/uploads/signature
 * @access  Private (Employee / Admin)
 */
export const uploadSignature = asyncHandler(async (req, res) => {
  let buffer;
  let mimeType = 'image/png';
  let originalName = `sig_${req.user?.employeeId || 'emp'}_${Date.now()}.png`;

  if (req.file) {
    buffer = req.file.buffer;
    mimeType = req.file.mimetype || 'image/png';
    originalName = req.file.originalname || originalName;
  } else if (req.body?.svgString || req.body?.dataUri || req.body?.signature || req.body?.svg) {
    const rawData = req.body.svgString || req.body.dataUri || req.body.signature || req.body.svg;
    if (
      typeof rawData === 'string' &&
      (rawData.startsWith('<svg') ||
        rawData.startsWith('data:image/svg') ||
        rawData.includes('<svg'))
    ) {
      let svgXml = rawData;
      if (rawData.startsWith('data:image/svg+xml;utf8,')) {
        svgXml = decodeURIComponent(rawData.replace('data:image/svg+xml;utf8,', ''));
      } else if (rawData.startsWith('data:image/svg+xml;base64,')) {
        svgXml = Buffer.from(
          rawData.replace('data:image/svg+xml;base64,', ''),
          'base64'
        ).toString('utf8');
      } else if (rawData.startsWith('data:image/svg+xml,')) {
        svgXml = decodeURIComponent(rawData.replace('data:image/svg+xml,', ''));
      }
      buffer = Buffer.from(svgXml, 'utf8');
      mimeType = 'image/svg+xml';
      originalName = `sig_${req.user?.employeeId || 'emp'}_${Date.now()}.svg`;
    } else if (typeof rawData === 'string' && rawData.startsWith('data:image/')) {
      const matches = rawData.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
      if (matches) {
        mimeType = `image/${matches[1]}`;
        buffer = Buffer.from(matches[2], 'base64');
        originalName = `sig_${req.user?.employeeId || 'emp'}_${Date.now()}.${
          matches[1] === 'jpeg' ? 'jpg' : matches[1]
        }`;
      } else {
        buffer = Buffer.from(rawData, 'utf8');
      }
    } else {
      buffer = Buffer.from(String(rawData), 'utf8');
    }
  } else {
    throw ApiError.badRequest(
      'Please provide a signature image file in the "signature" field or signature data (svgString, dataUri)'
    );
  }

  const result = await r2Service.uploadBufferToR2(buffer, {
    folder: 'vairavan-automation/signatures',
    originalName,
    mimeType,
  });

  return ApiResponse.created(res, 'Signature uploaded successfully to Cloudflare R2', {
    signature: {
      url: result.url,
      key: result.key,
      publicId: result.key, // Backward compatibility for existing mobile models
    },
  });
});

/**
 * @desc    Upload service proof photos to Cloudflare R2 (up to 5)
 * @route   POST /api/uploads/proof-photos
 * @access  Private (Employee / Admin)
 */
export const uploadProofPhotos = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    throw ApiError.badRequest('Please provide at least one photo in the "photos" field');
  }

  const uploadPromises = req.files.map((file, index) =>
    r2Service.uploadBufferToR2(file.buffer, {
      folder: 'vairavan-automation/proofs',
      originalName: file.originalname || `proof_${req.user?.employeeId || 'emp'}_${index}.jpg`,
      mimeType: file.mimetype || 'image/jpeg',
    })
  );

  const results = await Promise.all(uploadPromises);

  const photos = results.map((r) => ({
    url: r.url,
    key: r.key,
    publicId: r.key, // Backward compatibility for existing mobile models
  }));

  return ApiResponse.created(res, `${photos.length} photo(s) uploaded successfully to Cloudflare R2`, {
    photos,
  });
});

/**
 * @desc    Upload avatar photo to Cloudflare R2
 * @route   POST /api/uploads/avatar
 * @access  Private (Employee / Admin)
 */
export const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw ApiError.badRequest('Please provide an image file in the "avatar" field');
  }

  const result = await r2Service.uploadBufferToR2(req.file.buffer, {
    folder: 'vairavan-automation/avatars',
    originalName: req.file.originalname || `avatar_${req.user?.employeeId || 'emp'}.jpg`,
    mimeType: req.file.mimetype || 'image/jpeg',
  });

  return ApiResponse.created(res, 'Avatar uploaded successfully to Cloudflare R2', {
    avatar: {
      url: result.url,
      key: result.key,
      publicId: result.key,
    },
  });
});

/**
 * @desc    Delete an uploaded image asset from Cloudflare R2 by key (or publicId)
 * @route   DELETE /api/uploads/:key(*)
 * @access  Private
 */
export const deleteUploadedAsset = asyncHandler(async (req, res) => {
  const key = req.params.key || req.params.publicId || req.params[0];

  if (!key) {
    throw ApiError.badRequest('Object key or public ID is required');
  }

  await r2Service.deleteFromR2(key);

  return ApiResponse.success(res, 200, `Image '${key}' deleted successfully from Cloudflare R2`);
});

/**
 * @desc    Streaming proxy fallback for private R2 buckets
 * @route   GET /api/uploads/file/*
 * @access  Public / Private
 */
export const streamUploadedFile = asyncHandler(async (req, res) => {
  const key = req.params[0];

  if (!key) {
    throw ApiError.badRequest('Object key is required');
  }

  const { Body, ContentType } = await r2Service.getFileStreamFromR2(key);

  res.setHeader('Content-Type', ContentType || 'image/jpeg');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  Body.pipe(res);
});

export default {
  uploadSignature,
  uploadProofPhotos,
  uploadAvatar,
  deleteUploadedAsset,
  streamUploadedFile,
};
