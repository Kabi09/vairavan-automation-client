import cloudinaryService from '../services/cloudinaryService.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * @desc    Upload customer signature image
 * @route   POST /api/uploads/signature
 * @access  Private (Employee / Admin)
 */
export const uploadSignature = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw ApiError.badRequest('Please provide a signature image file in the "signature" field');
  }

  const result = await cloudinaryService.uploadBufferToCloudinary(req.file.buffer, {
    folder: 'vairavan-automation/signatures',
    public_id: `sig_${req.user.employeeId}_${Date.now()}`,
    tags: ['signature', req.user.employeeId],
  });

  return ApiResponse.created(res, 'Signature uploaded successfully', {
    signature: {
      url: result.url,
      publicId: result.publicId,
    },
  });
});

/**
 * @desc    Upload service proof photos (up to 5)
 * @route   POST /api/uploads/proof-photos
 * @access  Private (Employee / Admin)
 */
export const uploadProofPhotos = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    throw ApiError.badRequest('Please provide at least one photo in the "photos" field');
  }

  const uploadPromises = req.files.map((file, index) =>
    cloudinaryService.uploadBufferToCloudinary(file.buffer, {
      folder: 'vairavan-automation/proofs',
      public_id: `proof_${req.user.employeeId}_${Date.now()}_${index}`,
      tags: ['proof_photo', req.user.employeeId],
    })
  );

  const results = await Promise.all(uploadPromises);

  const photos = results.map((r) => ({
    url: r.url,
    publicId: r.publicId,
  }));

  return ApiResponse.created(res, `${photos.length} photo(s) uploaded successfully`, {
    photos,
  });
});

/**
 * @desc    Delete an uploaded image asset by publicId
 * @route   DELETE /api/uploads/:publicId
 * @access  Private
 */
export const deleteUploadedAsset = asyncHandler(async (req, res) => {
  const { publicId } = req.params;

  if (!publicId) {
    throw ApiError.badRequest('Public ID is required');
  }

  await cloudinaryService.deleteFromCloudinary(publicId);

  return ApiResponse.success(res, 200, 'Image deleted successfully');
});

export default {
  uploadSignature,
  uploadProofPhotos,
  deleteUploadedAsset,
};
