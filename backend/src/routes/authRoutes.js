/**
 * Purpose: Routing endpoints for user registration and authentication login.
 * Inputs: Express router instance.
 * Outputs: Mounted routes.
 * Side Effects: Connects API requests to authentication controller.
 */

const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getUserProfile, updateUserProfile, forgotPassword, resetPassword } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// Route mapping for credentials-based authentication
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:token', resetPassword);

// User profile endpoints
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);

// Profile image upload endpoint
const upload = require('../middleware/uploadMiddleware');
router.put('/profile/image', protect, upload.single('profileImage'), require('../controllers/authController').uploadProfileImage);

module.exports = router;
