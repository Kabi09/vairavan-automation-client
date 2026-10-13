import { Router } from 'express';
import {
  login,
  getMe,
  updateProfile,
  changePassword,
  refreshToken,
  logout,
} from '../controllers/authController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';
import {
  validateLogin,
  validateChangePassword,
  validateRefreshToken,
  validateUpdateProfile,
} from '../validators/authValidator.js';

const router = Router();

// Public routes
router.post('/login', authLimiter, validateLogin, validate, login);
router.post('/refresh', validateRefreshToken, validate, refreshToken);

// Protected routes
router.get('/me', authenticate, getMe);
router.patch('/profile', authenticate, validateUpdateProfile, validate, updateProfile);
router.patch('/change-password', authenticate, validateChangePassword, validate, changePassword);
router.post('/logout', authenticate, logout);

export default router;
