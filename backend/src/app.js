import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import routes from './routes/index.js';
import errorHandler from './middleware/errorHandler.js';
import notFound from './middleware/notFound.js';
import { generalLimiter } from './middleware/rateLimiter.js';
import { connectDB } from './config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables across potential run contexts
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });
dotenv.config();

const app = express();

// Ensure active database connection for incoming requests
app.use(async (req, res, next) => {
  // Allow root and health check without blocking
  if (req.path === '/' || req.path === '/api/health') {
    return next();
  }

  if (mongoose.connection.readyState !== 1) {
    if (!process.env.MONGODB_URI) {
      return res.status(500).json({
        success: false,
        message:
          'Database configuration missing: MONGODB_URI is not set in environment variables. Please add MONGODB_URI in Vercel Project Settings > Environment Variables.',
        code: 'MONGODB_URI_MISSING',
      });
    }

    try {
      await connectDB();
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: `Database connection failed: ${err.message}. If using MongoDB Atlas, ensure '0.0.0.0/0' (Allow access from anywhere) is configured under Network Access.`,
        code: 'MONGODB_CONNECTION_ERROR',
      });
    }
  }

  next();
});

// Security HTTP headers
app.use(helmet());

// CORS configuration
const corsOrigin = process.env.CORS_ORIGIN || '*';
const allowedOrigins = corsOrigin.includes(',')
  ? corsOrigin.split(',').map((origin) => origin.trim())
  : corsOrigin;

app.use(
  cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// Global rate limiting
app.use(generalLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Root welcome route
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to Vairavan Automation Employee Duty Management API',
    docs: '/api/health',
    version: '1.0.0',
  });
});

// Mount all API endpoints under /api
app.use('/api', routes);

// 404 Route Not Found
app.use(notFound);

// Global centralized Error Handler
app.use(errorHandler);

export default app;
