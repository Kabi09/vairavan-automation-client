import { v2 as cloudinary } from 'cloudinary';
import { isCloudinaryConfigured } from '../config/cloudinary.js';
import ApiError from '../utils/ApiError.js';

/**
 * Upload a file buffer to Cloudinary
 * @param {Buffer} buffer - File buffer from multer memory storage
 * @param {Object} options - Upload options (folder, tags, etc.)
 * @returns {Promise<{ url: string, publicId: string, format: string, bytes: number }>}
 */
export const uploadBufferToCloudinary = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    if (!isCloudinaryConfigured()) {
      // Return a simulated mock object in development/testing if credentials are not configured
      const mockId = `mock_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      console.log(`[Cloudinary Mock] Upload simulated: ${mockId}`);
      return resolve({
        url: `https://res.cloudinary.com/demo/image/upload/sample.jpg?mockId=${mockId}`,
        publicId: `${options.folder || 'vairavan'}/${mockId}`,
        format: 'jpg',
        bytes: buffer.length,
      });
    }

    const defaultOptions = {
      resource_type: 'image',
      folder: 'vairavan-automation',
      ...options,
    };

    const uploadStream = cloudinary.uploader.upload_stream(defaultOptions, (error, result) => {
      if (error) {
        return reject(new ApiError(500, `Cloudinary upload failed: ${error.message}`));
      }
      resolve({
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        bytes: result.bytes,
      });
    });

    uploadStream.end(buffer);
  });
};

/**
 * Delete an asset from Cloudinary by its publicId
 * @param {string} publicId
 */
export const deleteFromCloudinary = async (publicId) => {
  if (!publicId) return;

  if (!isCloudinaryConfigured()) {
    console.log(`[Cloudinary Mock] Delete simulated for publicId: ${publicId}`);
    return { result: 'ok' };
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error(`[Cloudinary] Failed to delete asset ${publicId}:`, error.message);
    throw new ApiError(500, `Failed to delete image: ${error.message}`);
  }
};

export default {
  uploadBufferToCloudinary,
  deleteFromCloudinary,
};
