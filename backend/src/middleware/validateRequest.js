/**
 * @file validateRequest.js
 * @description Factory middleware for request body validation using Zod schemas.
 * Apply on individual routes to enforce input constraints before the handler runs.
 *
 * Inputs and outputs:
 *   - Exports: `{ validateRequest }`.
 *
 * Dependencies:
 *   - `zod` — Schema definition and parsing.
 */

const { z, ZodError } = require('zod');

/**
 * Returns an Express middleware that validates `req.body` against the given Zod schema.
 * On validation failure, responds with 400 and a `details` array of field-level error messages.
 * On unexpected errors (non-ZodError), delegates to the next error handler.
 *
 * @param {z.ZodSchema} schema - Zod schema to parse the request body against.
 * @returns {import('express').RequestHandler} Middleware function.
 */
const validateRequest = (schema) => (req, res, next) => {
  try {
    schema.parse(req.body);
    next();
  } catch (error) {
    if (error && error.name === 'ZodError') {
      const errs = error.errors || error.issues || [];
      const formattedErrors = errs.map(err => ({
        field: err.path ? err.path.join('.') : 'unknown',
        message: err.message
      }));
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: formattedErrors
      });
    }
    console.error('ValidateRequest Middleware Error:', error);
    next(error);
  }
};

module.exports = { validateRequest };
