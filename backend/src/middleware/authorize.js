import ApiError from '../utils/ApiError.js';

/**
 * Role-based authorization middleware
 * @param  {...string} allowedRoles - e.g. 'admin', 'employee'
 */
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        ApiError.forbidden(
          `Forbidden: Role '${req.user.role}' is not authorized to access this resource`
        )
      );
    }

    next();
  };
};

export default authorize;
