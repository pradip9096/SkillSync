/**
 * Purpose: Request handlers for User Registration and Authentication (JWT generation).
 * Inputs: Express request and response objects.
 * Outputs: JSON responses containing token and authenticated user profile.
 * Side Effects: Reads/writes User schema, generates JWT tokens.
 */

const User = require('../models/User');
const jwt = require('jsonwebtoken');

/**
 * Helper: Generates a JWT token for a user.
 * @param {string} id - Mongoose User ObjectId.
 * @returns {string} Signed JWT token.
 */
const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET || 'skillsync_fallback_jwt_secret_key_2026',
    { expiresIn: '30d' }
  );
};

/**
 * @desc    Register a new user
 * @route   POST /auth/register
 * @access  Public
 */
const registerUser = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    // Validate email and password are provided
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide an email and password'
      });
    }

    // Standardize role value
    const normalizedRole = role ? String(role).trim() : 'Client';

    // SECURITY BOUNDARY: Strictly block registration of Admin accounts via public API
    if (normalizedRole === 'Admin') {
      return res.status(400).json({
        success: false,
        error: 'Registration of Administrator accounts is forbidden.'
      });
    }

    // Check if user already exists in DB
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        error: 'User already exists with this email address'
      });
    }

    // Create user in DB
    const user = await User.create({
      email,
      password,
      role: normalizedRole
    });

    if (user) {
      res.status(201).json({
        success: true,
        token: generateToken(user._id),
        user: {
          _id: user._id,
          email: user.email,
          role: user.role
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Invalid user data'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Server error during registration'
    });
  }
};

/**
 * @desc    Authenticate user and get token
 * @route   POST /auth/login
 * @access  Public
 */
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide email and password'
      });
    }

    // Find user by email (and select password field to check)
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    res.status(200).json({
      success: true,
      token: generateToken(user._id),
      user: {
        _id: user._id,
        email: user.email,
        role: user.role,
        name: user.name || '',
        phone: user.phone || ''
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Server error during authentication'
    });
  }
};

module.exports = {
  registerUser,
  loginUser
};
