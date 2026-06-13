const { z, ZodError } = require('zod');

/**
 * Middleware to validate request body against a Zod schema.
 * @param {z.ZodSchema} schema - The Zod schema to validate against.
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
