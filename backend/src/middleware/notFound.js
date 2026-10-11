import ApiError from '../utils/ApiError.js';

/**
 * 404 Route Not Found middleware
 */
export const notFound = (req, res, next) => {
  next(ApiError.notFound(`Resource not found: ${req.method} ${req.originalUrl}`));
};

export default notFound;
