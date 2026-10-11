import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * @desc    Register a device token for push notifications
 * @route   POST /api/notifications/register-token
 * @access  Private
 */
export const registerDeviceToken = asyncHandler(async (req, res) => {
  const { deviceToken } = req.body;

  if (!deviceToken || typeof deviceToken !== 'string') {
    throw ApiError.badRequest('Valid deviceToken string is required');
  }

  // Atomically add the token if not already present
  await User.findByIdAndUpdate(req.user._id, {
    $addToSet: { deviceTokens: deviceToken.trim() },
  });

  return ApiResponse.success(res, 200, 'Device token registered successfully');
});

/**
 * @desc    Remove/unregister a device token (e.g. on device logout)
 * @route   POST /api/notifications/remove-token
 * @access  Private
 */
export const removeDeviceToken = asyncHandler(async (req, res) => {
  const { deviceToken } = req.body;

  if (!deviceToken) {
    throw ApiError.badRequest('deviceToken is required');
  }

  await User.findByIdAndUpdate(req.user._id, {
    $pull: { deviceTokens: deviceToken.trim() },
  });

  return ApiResponse.success(res, 200, 'Device token removed successfully');
});

export default {
  registerDeviceToken,
  removeDeviceToken,
};
