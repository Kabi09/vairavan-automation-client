import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * Generate Access and Refresh JWT Tokens
 */
const generateTokens = (user) => {
  const secret = process.env.JWT_SECRET || 'fallback_development_jwt_secret_32_characters';
  const refreshSecret = process.env.JWT_REFRESH_SECRET || 'fallback_refresh_jwt_secret_32_characters';
  const expiresIn = process.env.JWT_EXPIRES_IN || '365d';
  const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '365d';

  const payload = {
    id: user._id,
    role: user.role,
    employeeId: user.employeeId,
  };

  const accessToken = jwt.sign(payload, secret, { expiresIn });
  const refreshToken = jwt.sign({ id: user._id }, refreshSecret, { expiresIn: refreshExpiresIn });

  return { accessToken, refreshToken };
};

/**
 * @desc    Authenticate user & get tokens
 * @route   POST /api/auth/login
 * @access  Public
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find user and explicitly include password field
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  // Check account active status
  if (user.accountStatus !== 'active') {
    throw ApiError.forbidden('Your account is deactivated. Please contact an administrator.');
  }

  // Validate password
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const { accessToken, refreshToken } = generateTokens(user);

  // Store refresh token with expiration date based on token lifespan (default 365 days / 1 year)
  const decodedRefresh = jwt.decode(refreshToken);
  const refreshExpiresAt = decodedRefresh?.exp
    ? new Date(decodedRefresh.exp * 1000)
    : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  user.refreshTokens.push({
    token: refreshToken,
    expiresAt: refreshExpiresAt,
  });

  // Limit saved refresh tokens to last 5
  if (user.refreshTokens.length > 5) {
    user.refreshTokens = user.refreshTokens.slice(-5);
  }

  await user.save();

  const userJson = user.toJSON();

  return ApiResponse.success(res, 200, 'Login successful', {
    token: accessToken,
    refreshToken,
    user: userJson,
  });
});

/**
 * @desc    Get authenticated user's profile
 * @route   GET /api/auth/me
 * @access  Private
 */
export const getMe = asyncHandler(async (req, res) => {
  return ApiResponse.success(res, 200, 'Profile retrieved successfully', {
    user: req.user,
  });
});

/**
 * @desc    Update employee's own profile (phone number, email, and avatar only)
 * @route   PATCH /api/auth/profile
 * @access  Private
 */
export const updateProfile = asyncHandler(async (req, res) => {
  const { phoneNumber, email, avatar, dateOfBirth } = req.body;

  const user = await User.findById(req.user._id);
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  // If email is changing, verify uniqueness
  if (email && email.toLowerCase().trim() !== user.email.toLowerCase()) {
    const existing = await User.findOne({
      email: email.toLowerCase().trim(),
      _id: { $ne: user._id },
    });
    if (existing) {
      throw ApiError.badRequest('Email address is already in use by another account');
    }
    user.email = email.toLowerCase().trim();
  }

  if (phoneNumber !== undefined) {
    user.phoneNumber = phoneNumber.trim();
  }

  if (avatar !== undefined) {
    user.avatar = avatar.trim();
  }

  if (dateOfBirth !== undefined) {
    user.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
  }

  await user.save();

  return ApiResponse.success(res, 200, 'Profile updated successfully', {
    user: user.toJSON(),
  });
});

/**
 * @desc    Change authenticated user's password
 * @route   PATCH /api/auth/change-password
 * @access  Private
 */
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+password');
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    throw ApiError.badRequest('Current password is incorrect');
  }

  if (currentPassword === newPassword) {
    throw ApiError.badRequest('New password cannot be the same as the current password');
  }

  user.password = newPassword;
  // Invalidate previous refresh tokens on password change
  user.refreshTokens = [];
  await user.save();

  return ApiResponse.success(res, 200, 'Password changed successfully');
});

/**
 * @desc    Refresh access token
 * @route   POST /api/auth/refresh
 * @access  Public
 */
export const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken: incomingToken } = req.body;

  if (!incomingToken) {
    throw ApiError.badRequest('Refresh token is required');
  }

  const refreshSecret = process.env.JWT_REFRESH_SECRET || 'fallback_refresh_jwt_secret_32_characters';

  let decoded;
  try {
    decoded = jwt.verify(incomingToken, refreshSecret);
  } catch (err) {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const user = await User.findById(decoded.id);
  if (!user || user.accountStatus !== 'active') {
    throw ApiError.unauthorized('User not found or inactive');
  }

  const tokenExists = user.refreshTokens.some(
    (rt) => rt.token === incomingToken && rt.expiresAt > new Date()
  );

  if (!tokenExists) {
    throw ApiError.unauthorized('Refresh token is invalid or has been revoked');
  }

  const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);

  // Rotate refresh token: remove old one, add new one
  const decodedNewRefresh = jwt.decode(newRefreshToken);
  const newRefreshExpiresAt = decodedNewRefresh?.exp
    ? new Date(decodedNewRefresh.exp * 1000)
    : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  user.refreshTokens = user.refreshTokens.filter((rt) => rt.token !== incomingToken);
  user.refreshTokens.push({
    token: newRefreshToken,
    expiresAt: newRefreshExpiresAt,
  });
  await user.save();

  return ApiResponse.success(res, 200, 'Token refreshed successfully', {
    token: accessToken,
    refreshToken: newRefreshToken,
  });
});

/**
 * @desc    Logout and revoke refresh token
 * @route   POST /api/auth/logout
 * @access  Private
 */
export const logout = asyncHandler(async (req, res) => {
  const { refreshToken: tokenToRevoke } = req.body;

  if (tokenToRevoke && req.user) {
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { refreshTokens: { token: tokenToRevoke } },
    });
  }

  return ApiResponse.success(res, 200, 'Logged out successfully');
});

export default {
  login,
  getMe,
  updateProfile,
  changePassword,
  refreshToken,
  logout,
};
