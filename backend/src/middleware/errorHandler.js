const logger = require('../config/logger');
const crypto = require('crypto');

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
