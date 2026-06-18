/**
 * @file authMiddleware.js
 * @description Express middleware for JWT-based authentication and Role-Based Access Control (RBAC).
 * `protect` must be applied to all private routes. `restrictTo` is composed on top of `protect`
 * to limit access to specific user roles.
 *
 * Inputs and outputs:
 *   - Exports: `{ protect, restrictTo }`.
 *
 * Side effects:
 *   - `protect` reads the `User` MongoDB collection to hydrate `req.user`.
 *   - `protect` attaches the full user object (without password) to `req.user` on success.
 *
 * Dependencies:
 *   - `jsonwebtoken` — JWT signature verification.
 *   - `../models/User` — Mongoose User model for post-verification user lookup.
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Extracts and verifies the Bearer JWT from the `Authorization` header, then looks up the
 * corresponding user in the database and attaches the document to `req.user` (password excluded).
 * This function is async. It awaits `User.findById` with `.select('-password')`.
 *
 * @async
 * @param {import('express').Request} req - Express request. Must include
 *   `Authorization: Bearer <token>` header.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Called with no arguments on success.
 * @returns {Promise<void>}
 * @throws {401} If the header is missing, the token is expired/invalid, or the user no longer exists.
 */
const protect = async (req, res, next) => {
  let token;

  // Check if Authorization header starts with Bearer
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header: "Bearer <token>"
      token = req.headers.authorization.split(' ')[1];

      if (!process.env.JWT_SECRET) {
        throw new Error('FATAL: JWT_SECRET environment variable is not defined.');
      }

      // Decode/Verify token
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET
      );

      // Fetch user from DB and attach to req.user (excluding password hash)
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Not authorized, user not found'
        });
      }

      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized, token validation failed'
      });
    }
  }

  // If no token is provided
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized, no token provided'
    });
  }
};

/**
 * Returns an Express middleware that restricts access to the specified roles.
 * Must be used after `protect`, which populates `req.user`. Returns a 401 if
 * `req.user` is absent and a 403 if the role is not in the allowed list.
 *
 * @param {...string} roles - One or more role strings that are permitted (e.g. `'Admin'`, `'Expert'`).
 * @returns {import('express').RequestHandler} Middleware function that enforces the role restriction.
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized, user credentials missing'
      });
    }

    // Check if the user's role is permitted
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `User role '${req.user.role}' is not authorized to access this resource`
      });
    }

    next();
  };
};

module.exports = {
  protect,
  restrictTo
};
