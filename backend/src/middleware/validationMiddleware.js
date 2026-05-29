/**
 * @file validationMiddleware.js
 * @description Reusable parameter and query validations for route security.
 */

const mongoose = require('mongoose');

/**
 * Middleware: Validates that specified request parameters are valid MongoDB ObjectIds.
 * Returns a 400 Bad Request if any specified parameter is present but invalid.
 * 
 * @param {string[]} paramNames - List of request parameters to validate (e.g. ['id', 'bookingId'])
 */
exports.validateParams = (paramNames = ['id']) => {
  return (req, res, next) => {
    for (const name of paramNames) {
      const value = req.params[name];
      if (value && !mongoose.Types.ObjectId.isValid(value)) {
        return res.status(400).json({
          success: false,
          error: `Invalid formatted resource identifier parameter: ${name}`
        });
      }
    }
    next();
  };
};
