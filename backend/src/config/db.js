import mongoose from 'mongoose';

/**
 * Connect to MongoDB instance using Mongoose
 */
export const connectDB = async (customUri = null) => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const uri = customUri || process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  try {
    const conn = await mongoose.connect(uri, {
      autoIndex: true,
      serverSelectionTimeoutMS: 10000,
    });

    console.log(`[MongoDB] Connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`[MongoDB] Connection error: ${error.message}`);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw error;
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
