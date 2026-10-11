/**
 * Standard API Response structure
 */
class ApiResponse {
  constructor(statusCode, message = 'Success', data = null) {
    this.statusCode = statusCode;
    this.success = statusCode < 400;
    this.message = message;
    if (data !== null) {
      this.data = data;
    }
  }

  static success(res, statusCode = 200, message = 'Success', data = null) {
    const payload = {
      success: true,
      message
    };
    if (data !== null) {
      payload.data = data;
    }
    return res.status(statusCode).json(payload);
  }

  static created(res, message = 'Created successfully', data = null) {
    return ApiResponse.success(res, 201, message, data);
  }
}

export default ApiResponse;
