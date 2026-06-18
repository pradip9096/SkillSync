/**
 * @file errorHandler.js
 * @description Express global error-handling middleware. Must be registered after all routes
 * in `app.js` (four-argument signature). Normalizes Mongoose/MongoDB driver errors to
 * client-friendly HTTP responses and attaches a correlation ID for log traceability.
 *
 * Inputs and outputs:
 *   - Receives `(err, req, res, next)` from Express's error pipeline.
 *   - Exports: `errorHandler` — the middleware function.
 *
 * Side effects:
 *   - Writes a structured error log entry via Pino (includes `correlationId`, `statusCode`,
 *     `method`, `url`, `message`, `stack`).
 *   - In production, 500-level non-operational errors are returned as `'Internal server error'`
 *     to avoid leaking stack traces to clients.
 *
 * Dependencies:
 *   - `../config/logger` — Shared Pino logger.
 *   - `crypto` — UUID generation for the correlation ID when `req.id` is not set.
 */

const logger = require('../config/logger');
const crypto = require('crypto');

/**
 * Normalizes errors and sends a structured JSON error response.
 * Maps Mongoose `CastError` → 400, `ValidationError` → 422, and MongoDB duplicate-key
 * (`code 11000`) → 409. In production, hides stack traces and opaque 500 messages.
 *
 * @param {Error & { statusCode?: number; status?: string; isOperational?: boolean; code?: number }} err
 *   - The error object. `isOperational` distinguishes expected `AppError` throws from
 *     unexpected programming errors (used to decide whether to expose the message in production).
 * @param {import('express').Request} req - Express request (used for `req.id` and logging context).
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Required by Express to recognise this as an error handler.
 * @returns {void}
 */
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  const correlationId = req.id || crypto.randomUUID();

  // Log error using structured logger
  logger.error({
    correlationId,
    statusCode: err.statusCode,
    method: req.method,
    url: req.originalUrl,
    message: err.message,
    stack: err.stack,
  });

  // Mongoose / MongoDB driver error mappings.
  // Use else-if so only one branch fires; the first match wins.
  if (err.name === 'CastError') {
    err.statusCode = 400;
    err.message = `Invalid ${err.path}: ${err.value}.`;
  } else if (err.name === 'ValidationError') {
    err.statusCode = 422;
    const errors = Object.values(err.errors).map(el => el.message);
    err.message = `Invalid input data. ${errors.join('. ')}`;
  } else if (err.code === 11000) {
    err.statusCode = 409;
    // Preserve a domain-level message already set by the service layer;
    // only fall back to the generic text for raw MongoDB driver errors
    // whose message starts with the internal "E11000 duplicate key" prefix.
    if (!err.message || err.message.startsWith('E11000')) {
      err.message = 'This time slot is already booked.';
    }
  }

  // Send response
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    res.status(err.statusCode).json({
      success: false,
      correlationId,
      error: err.statusCode === 500 && !err.isOperational ? 'Internal server error' : err.message,
    });
  } else {
    res.status(err.statusCode).json({
      success: false,
      correlationId,
      error: err.message,
      stack: err.stack,
      err: err
    });
  }
};

module.exports = errorHandler;
