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

  // Mongoose error mappings
  if (err.name === 'CastError') {
    err.statusCode = 400;
    err.message = `Invalid ${err.path}: ${err.value}.`;
  }
  if (err.name === 'ValidationError') {
    err.statusCode = 422;
    const errors = Object.values(err.errors).map(el => el.message);
    err.message = `Invalid input data. ${errors.join('. ')}`;
  }
  if (err.code === 11000) {
    err.statusCode = 409;
    err.message = 'Duplicate field value entered.';
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
