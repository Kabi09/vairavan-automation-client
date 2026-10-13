import crypto from 'crypto';
import {
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import {
  getR2Client,
  getR2BucketName,
  getR2PublicUrl,
  isR2Configured,
} from '../config/r2.js';
import ApiError from '../utils/ApiError.js';

/**
 * Generate a sanitized, collision-resistant object key for Cloudflare R2
 * Format: {prefix}/{timestamp}-{randomHex}-{sanitizedName}
 */
export const generateR2Key = (prefix = 'uploads', originalName = 'image.jpg') => {
  const sanitizedName = String(originalName).replace(/[^a-zA-Z0-9._-]/g, '_');
  const uniqueHex = crypto.randomBytes(6).toString('hex');
  const cleanPrefix = prefix.replace(/^\/+|\/+$/g, '');
  return `${cleanPrefix}/${Date.now()}-${uniqueHex}-${sanitizedName}`;
};

/**
 * Upload a file buffer directly to Cloudflare R2 via AWS S3-compatible API
 *
 * @param {Buffer} buffer - File buffer from multer memory storage
 * @param {Object} options - Upload options (folder, originalName, mimeType)
 * @returns {Promise<{ url: string, key: string, publicId: string, size: number, mimeType: string }>}
 */
export const uploadBufferToR2 = async (buffer, options = {}) => {
  const {
    folder = 'uploads',
    originalName = 'upload.jpg',
    mimeType = 'image/jpeg',
  } = options;

  const key = generateR2Key(folder, originalName);

  if (!isR2Configured()) {
    // Graceful fallback for local development or tests when real credentials are not supplied
    const publicBase = getR2PublicUrl() || 'https://pub-demo.r2.dev';
    console.log(`[Cloudflare R2 Mock] Upload simulated for key: ${key}`);
    return {
      url: `${publicBase}/${key}`,
      key,
      publicId: key, // Alias for backward compatibility with mobile duty models
      size: buffer.length,
      mimeType,
    };
  }

  try {
    const client = getR2Client();
    const bucket = getR2BucketName();

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    });

    await client.send(command);

    const publicBase = getR2PublicUrl();
    const url = publicBase
      ? `${publicBase}/${key}`
      : `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucket}/${key}`;

    return {
      url,
      key,
      publicId: key, // Alias for backward compatibility
      size: buffer.length,
      mimeType,
    };
  } catch (error) {
    console.error(`[Cloudflare R2] Upload failed for key ${key}:`, error);
    throw new ApiError(500, `Cloudflare R2 upload failed: ${error.message}`);
  }
};

/**
 * Delete an object from Cloudflare R2 by key (or publicId)
 *
 * @param {string} key - Object key to delete
 */
export const deleteFromR2 = async (key) => {
  if (!key) return;

  if (!isR2Configured()) {
    console.log(`[Cloudflare R2 Mock] Delete simulated for key: ${key}`);
    return { success: true, key };
  }

  try {
    const client = getR2Client();
    const bucket = getR2BucketName();

    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await client.send(command);
    return { success: true, key };
  } catch (error) {
    console.error(`[Cloudflare R2] Failed to delete object ${key}:`, error.message);
    throw new ApiError(500, `Failed to delete image from Cloudflare R2: ${error.message}`);
  }
};

/**
 * Retrieve an object stream from Cloudflare R2 (optional fallback)
 *
 * @param {string} key - Object key to fetch
 */
export const getFileStreamFromR2 = async (key) => {
  if (!isR2Configured()) {
    throw new ApiError(503, 'Cloudflare R2 is not configured on this environment');
  }

  try {
    const client = getR2Client();
    const bucket = getR2BucketName();

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    return await client.send(command);
  } catch (error) {
    if (error.name === 'NoSuchKey') {
      throw new ApiError(404, `Image not found in Cloudflare R2: ${key}`);
    }
    throw new ApiError(500, `Failed to retrieve file from Cloudflare R2: ${error.message}`);
  }
};

export default {
  uploadBufferToR2,
  deleteFromR2,
  getFileStreamFromR2,
  generateR2Key,
};
