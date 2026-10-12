import { Router } from 'express';
import mongoose from 'mongoose';
import authRoutes from './authRoutes.js';
import employeeRoutes from './employeeRoutes.js';
import companyRoutes from './companyRoutes.js';
import dutyRoutes from './dutyRoutes.js';
import leaveRoutes from './leaveRoutes.js';
import holidayRoutes from './holidayRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';
import uploadRoutes from './uploadRoutes.js';
import notificationRoutes from './notificationRoutes.js';
import taskRoutes from './taskRoutes.js';
import ApiResponse from '../utils/ApiResponse.js';
import { connectDB } from '../config/db.js';

const router = Router();

// Health check endpoint for Render / Vercel / monitoring
router.get('/health', async (req, res) => {
  let dbError = null;

  if (mongoose.connection.readyState !== 1 && process.env.MONGODB_URI) {
    try {
      await connectDB();
    } catch (err) {
      dbError = err.message;
    }
  }

  const dbState = mongoose.connection.readyState;
  const dbStatusMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  return ApiResponse.success(res, 200, 'Server is running and healthy', {
    status: 'UP',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: dbStatusMap[dbState] || 'unknown',
    hasMongoUri: !!process.env.MONGODB_URI,
    dbError,
  });
});

// Mount module routes
router.use('/auth', authRoutes);
router.use('/employees', employeeRoutes);
router.use('/companies', companyRoutes);
router.use('/duties', dutyRoutes);
router.use('/leaves', leaveRoutes);
router.use('/holidays', holidayRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/uploads', uploadRoutes);
router.use('/notifications', notificationRoutes);
router.use('/tasks', taskRoutes);

export default router;
