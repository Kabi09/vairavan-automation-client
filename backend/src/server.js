import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import app from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { initializeFirebase } from './config/firebase.js';
import { configureCloudinary } from './config/cloudinary.js';

const PORT = parseInt(process.env.PORT || '5000', 10);
const HOST = process.env.HOST || '0.0.0.0';

let server;

const startServer = async () => {
  try {
    // 1. Connect to MongoDB
    await connectDB();

    // 2. Initialize external cloud services (graceful fallback if unconfigured)
    configureCloudinary();
    initializeFirebase();

    // 3. Start listening on configured host and port
    server = app.listen(PORT, HOST, () => {
      console.log(`=======================================================`);
      console.log(`  Vairavan Automation Backend API Server Started`);
      console.log(`  Mode: ${process.env.NODE_ENV || 'development'}`);
      console.log(`  Listening on http://${HOST}:${PORT}`);
      console.log(`  Health Check: http://${HOST}:${PORT}/api/health`);
      console.log(`=======================================================`);
    });
  } catch (error) {
    console.error(`[Server Boot Error] Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`\n[Server] Received ${signal}. Initiating graceful shutdown...`);

  if (server) {
    server.close(async () => {
      console.log('[Server] HTTP server closed.');
      await disconnectDB();
      console.log('[Server] Graceful shutdown completed.');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }

  // Force shutdown after 10 seconds timeout
  setTimeout(() => {
    console.error('[Server] Forcefully shutting down due to timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startServer();
