/**
 * Purpose: Routing endpoints for user registration and authentication login.
 * Inputs: Express router instance.
 * Outputs: Mounted routes.
 * Side Effects: Connects API requests to authentication controller.
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { registerUser, loginUser, getUserProfile, updateUserProfile, forgotPassword, resetPassword } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const { validateRequest } = require('../middleware/validateRequest');
const { registerSchema, loginSchema } = require('../utils/validationSchemas');

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 attempts per 15 minutes (as per Phase 1 Plan)
  message: { success: false, error: 'Too many authentication attempts from this IP. Please try again after 15 minutes.' }
});

// Route mapping for credentials-based authentication
router.post('/register', authRateLimiter, validateRequest(registerSchema), registerUser);
router.post('/login', authRateLimiter, validateRequest(loginSchema), loginUser);
router.post('/forgot-password', authRateLimiter, forgotPassword);
router.put('/reset-password/:token', authRateLimiter, resetPassword);

// User profile endpoints
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);

// Profile image upload endpoint
const upload = require('../middleware/uploadMiddleware');
router.put('/profile/image', protect, upload.single('profileImage'), require('../controllers/authController').uploadProfileImage);

module.exports = router;
