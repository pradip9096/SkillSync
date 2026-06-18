/**
 * @file AppError.js
 * @description Operational error class used throughout the backend to represent
 * known, user-facing error conditions (as opposed to programming bugs). The
 * global error handler in `middleware/errorHandler.js` inspects `isOperational`
 * to decide whether to send a structured JSON response or a generic 500.
 *
 * Inputs and outputs:
 *   - Exports: the `AppError` class.
 */

/**
 * Operational error with an HTTP status code attached.
 * @extends Error
 */
class AppError extends Error {
  /**
   * @param {string} message - Human-readable error description sent to the client.
   * @param {number} statusCode - HTTP status code (4xx → `status='fail'`; 5xx → `status='error'`).
   */
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
