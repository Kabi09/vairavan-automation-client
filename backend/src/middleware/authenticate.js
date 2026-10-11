import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * Authentication middleware: verifies JWT access token and attaches authenticated user
 */
export const authenticate = asyncHandler(async (req, res, next) => {
  let token = null;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    throw ApiError.unauthorized('Authentication token is required');
  }

  const secret = process.env.JWT_SECRET || 'fallback_development_jwt_secret_32_characters';

  let decoded;
  try {
    decoded = jwt.verify(token, secret);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Token has expired. Please log in again.');
    }
    throw ApiError.unauthorized('Invalid authentication token');
  }

  if (!decoded || !decoded.id) {
    throw ApiError.unauthorized('Malformed token payload');
  }

  // Retrieve user from DB, ensure active status
  const user = await User.findById(decoded.id);

  if (!user) {
    throw ApiError.unauthorized('The user belonging to this token no longer exists');
  }

  if (user.accountStatus !== 'active') {
    throw ApiError.forbidden('Your account has been deactivated. Please contact an administrator.');
  }

  // Attach verified user instance and user claims
  req.user = user;
  next();
});

export default authenticate;
