import ApiError from '../utils/ApiError.js';

/**
 * Global centralized error handling middleware
 */
export const errorHandler = (err, req, res, next) => {
  let error = err;

  // Handle Mongoose Bad ObjectId (CastError)
  if (err.name === 'CastError') {
    const message = `Invalid ${err.path}: ${err.value}`;
    error = ApiError.badRequest(message);
  }

  // Handle Mongoose Duplicate Key Error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const value = err.keyValue ? err.keyValue[field] : '';
    const message = `Duplicate value '${value}' entered for field '${field}'. Please use another value.`;
    error = ApiError.conflict(message);
  }

  // Handle Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors || {}).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    error = ApiError.unprocessable('Validation failed', errors);
  }

  // Handle JWT Errors
  if (err.name === 'JsonWebTokenError') {
    error = ApiError.unauthorized('Invalid authorization token');
  }
  if (err.name === 'TokenExpiredError') {
    error = ApiError.unauthorized('Token has expired. Please log in again.');
  }

  // Handle Multer Errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      error = ApiError.badRequest('File size exceeds the allowed limit');
    } else {
      error = ApiError.badRequest(`File upload error: ${err.message}`);
    }
  }

  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  const response = {
    success: false,
    message,
  };

  if (error.errors && error.errors.length > 0) {
    response.errors = error.errors;
  }


  if (statusCode === 500) {
    console.error(`[Unhandled Error] ${req.method} ${req.originalUrl}:`, err);
  }

  return res.status(statusCode).json(response);
};

export default errorHandler;
