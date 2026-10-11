import mongoose from 'mongoose';

let isConnectingPromise = null;

/**
 * Connect to MongoDB instance using Mongoose with connection pooling and caching
 */
export const connectDB = async (customUri = null) => {
  // If already connected, reuse existing connection
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // If connection is in progress, await the existing promise
  if (isConnectingPromise) {
    return isConnectingPromise;
  }
  const uri = customUri || process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  try {
    isConnectingPromise = mongoose.connect(uri, {
      autoIndex: true,
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
    });

    const conn = await isConnectingPromise;
    console.log(`[MongoDB] Connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`[MongoDB] Connection error: ${error.message}`);
    throw error;
  } finally {
    isConnectingPromise = null;
  }
};

/**
 * Disconnect MongoDB instance
 */
export const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    console.log('[MongoDB] Disconnected successfully');
  } catch (error) {
    console.error(`[MongoDB] Disconnect error: ${error.message}`);
  }
};

export default connectDB;
