import { S3Client } from '@aws-sdk/client-s3';

let s3ClientInstance = null;

/**
 * Check if Cloudflare R2 credentials and bucket are configured with active non-placeholder values.
 */
export const isR2Configured = () => {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
    return false;
  }
  // Check if values are demo placeholders
  if (
    R2_ACCOUNT_ID === 'your_cloudflare_account_id' ||
    R2_ACCESS_KEY_ID === 'your_r2_access_key_id' ||
    R2_SECRET_ACCESS_KEY === 'your_r2_secret_access_key'
  ) {
    return false;
  }
  return true;
};

/**
 * Get the target R2 bucket name
 */
export const getR2BucketName = () => {
  return process.env.R2_BUCKET_NAME || 'vairavan-automation';
};

/**
 * Get base public URL without trailing slash
 */
export const getR2PublicUrl = () => {
  const raw = process.env.R2_PUBLIC_URL || '';
  return raw.replace(/\/+$/, '');
};

/**
 * Get maximum allowed file upload size in megabytes
 */
export const getMaxFileSizeMB = () => {
  return parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10);
};

/**
 * Get or initialize S3Client configured for Cloudflare R2
 */
export const getR2Client = () => {
  if (!isR2Configured()) {
    return null;
  }

  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }

  return s3ClientInstance;
};

/**
 * Validate and log R2 status on server startup
 */
export const initializeR2 = () => {
  if (isR2Configured()) {
    getR2Client();
    console.log(`[Cloudflare R2] Configured for bucket: ${getR2BucketName()}`);
    if (getR2PublicUrl()) {
      console.log(`[Cloudflare R2] Public Base URL: ${getR2PublicUrl()}`);
    }
    return true;
  }

  console.log(
    `[Cloudflare R2] Credentials not configured or using demo placeholders. Running in mock/development mode.`
  );
  return false;
};

export default {
  isR2Configured,
  getR2BucketName,
  getR2PublicUrl,
  getR2Client,
  initializeR2,
};
