/**
 * Extract human-readable error message from backend or network error
 */
export const extractErrorMessage = (error, defaultMessage = 'An unexpected error occurred') => {
  if (!error) return defaultMessage;

  // Axios response with JSON body
  if (error.response && error.response.data) {
    const data = error.response.data;

    // Specific field validation errors array
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      return data.errors.map((e) => e.message || `${e.field}: invalid`).join('\n');
    }

    if (data.message && typeof data.message === 'string') {
      return data.message;
    }
  }

  // Network / connection error
  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    return 'Request timed out. Please check your internet connection.';
  }

  if (error.message?.includes('Network Error')) {
    return 'Unable to connect to the server. Please check your internet connection.';
  }

  if (error.message && typeof error.message === 'string') {
    return error.message;
  }

  return defaultMessage;
};

export default {
  extractErrorMessage,
};
