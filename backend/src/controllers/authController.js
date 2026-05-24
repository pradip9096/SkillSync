/**
 * Purpose: Request handlers for User Registration and Authentication (JWT generation).
 * Inputs: Express request and response objects.
 * Outputs: JSON responses containing token and authenticated user profile.
 * Side Effects: Reads/writes User schema, generates JWT tokens.
 */

const User = require('../models/User');
const Expert = require('../models/Expert');
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
    const { email, password, role, name, phone, category, experience, hourlyRate, description } = req.body;

    // Validate email and password are provided
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please fill in all mandatory fields: email and password'
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

    // For Experts, validate name, phone, and expert-specific fields
    if (normalizedRole === 'Expert') {
      if (!name || !phone || !category || !experience || !hourlyRate || !description) {
        return res.status(400).json({
          success: false,
          error: 'Please provide all expert profile fields: name, phone, category, experience, hourly rate, and description'
        });
      }

      // Phone format validation
      if (!/^\+91[0-9]{10}$/.test(phone)) {
        return res.status(400).json({
          success: false,
          error: 'Phone number must start with +91 followed by 10 digits'
        });
      }

      if (!['Technology', 'Finance', 'Health', 'Marketing', 'Design', 'Business'].includes(category)) {
        return res.status(400).json({
          success: false,
          error: 'Please select a valid category'
        });
      }

      if (isNaN(experience) || Number(experience) < 0) {
        return res.status(400).json({
          success: false,
          error: 'Experience must be a valid positive number'
        });
      }

      if (isNaN(hourlyRate) || Number(hourlyRate) < 0) {
        return res.status(400).json({
          success: false,
          error: 'Hourly rate must be a valid positive number'
        });
      }
    }

    // Check if user already exists in DB
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        error: 'User already exists with this email address'
      });
    }

    // Create user object safely
    const userData = {
      email,
      password,
      role: normalizedRole
    };
    if (name) userData.name = name;
    if (phone) userData.phone = phone;

    // Create user in DB
    const user = await User.create(userData);

    if (user) {
      let expertProfile = null;
      if (normalizedRole === 'Expert') {
        // Create corresponding Expert profile
        expertProfile = await Expert.create({
          name,
          category,
          experience: Number(experience),
          description: description || '',
          hourlyRate: Number(hourlyRate),
          user: user._id
        });
      }

      res.status(201).json({
        success: true,
        token: generateToken(user._id),
        user: {
          _id: user._id,
          email: user.email,
          role: user.role,
          name: user.name,
          phone: user.phone
        },
        expert: expertProfile
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

/**
 * @desc    Get user profile
 * @route   GET /auth/profile
 * @access  Private
 */
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Server error retrieving profile'
    });
  }
};

/**
 * @desc    Update user profile
 * @route   PUT /auth/profile
 * @access  Private
 */
const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Update fields
    if (req.body.name !== undefined) {
      user.name = req.body.name;
    }

    if (req.body.phone !== undefined) {
      const phone = req.body.phone;
      if (phone && !/^\+91[0-9]{10}$/.test(phone)) {
        return res.status(400).json({
          success: false,
          error: 'Phone number must start with +91 followed by 10 digits'
        });
      }
      user.phone = phone;
    }

    if (req.body.password) {
      if (req.body.password.length < 6) {
        return res.status(400).json({
          success: false,
          error: 'Password must be at least 6 characters'
        });
      }
      user.password = req.body.password;
    }

    const updatedUser = await user.save();

    res.status(200).json({
      success: true,
      user: {
        _id: updatedUser._id,
        email: updatedUser.email,
        role: updatedUser.role,
        name: updatedUser.name || '',
        phone: updatedUser.phone || ''
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Server error updating profile'
    });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile
};
