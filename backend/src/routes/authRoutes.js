/**
 * Purpose: Routing endpoints for user registration and authentication login.
 * Inputs: Express router instance.
 * Outputs: Mounted routes.
 * Side Effects: Connects API requests to authentication controller.
 */

const express = require('express');
const router = express.Router();
const { registerUser, loginUser } = require('../controllers/authController');

// Route mapping for credentials-based authentication
router.post('/register', registerUser);
router.post('/login', loginUser);

module.exports = router;
