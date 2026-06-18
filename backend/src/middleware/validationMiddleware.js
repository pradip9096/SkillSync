/**
 * @file validationMiddleware.js
 * @description Reusable parameter and query validations for route security.
 */

const mongoose = require('mongoose');

/**
 * Returns an Express middleware that validates the specified route parameters as MongoDB ObjectIds.
 * Only validates parameters that are actually present on `req.params`; missing params are skipped.
 * Responds with 400 if any present parameter is not a valid ObjectId string.
 *
 * @param {string[]} [paramNames=['id']] - Route parameter names to validate (e.g. `['id', 'bookingId']`).
 * @returns {import('express').RequestHandler} Middleware function.
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
