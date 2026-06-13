/**
 * Purpose: Security middlewares to verify JWT tokens and restrict route access based on roles.
 * Inputs: Express request, response, and next function.
 * Outputs: Calls next() if successful, otherwise returns 401 (Unauthorized) or 403 (Forbidden) response.
 * Side Effects: Attaches user credentials object to request object.
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware: Verifies the JWT token and attaches the authenticated user to the request.
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
 * Middleware: Restricts route access to specific roles.
 * @param {...string} roles - List of allowed roles.
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
