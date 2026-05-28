/**
 * Purpose: Request handlers for User Registration and Authentication (JWT generation).
 * Inputs: Express request and response objects.
 * Outputs: JSON responses containing token and authenticated user profile.
 * Side Effects: Reads/writes User schema, generates JWT tokens.
 */

const mongoose = require('mongoose');
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

      if (isNaN(hourlyRate) || Number(hourlyRate) < 100) {
        return res.status(400).json({
          success: false,
          error: 'Hourly rate must be at least 100 rupees'
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

    // Start MongoDB Session for Transaction
    const session = await mongoose.startSession();
    let createdUser;
    let expertProfile = null;

    try {
      await session.withTransaction(async () => {
        // Create user in DB
        const [user] = await User.create([userData], { session });
        createdUser = user;

        if (normalizedRole === 'Expert') {
          // Create corresponding Expert profile
          const [expert] = await Expert.create([{
            name,
            category,
            experience: Number(experience),
            description: description || '',
            hourlyRate: Number(hourlyRate),
            user: user._id
          }], { session });
          expertProfile = expert;
        }
      });
      // Transaction committed successfully
    } catch (transactionError) {
      // Transaction aborted automatically
      return res.status(400).json({
        success: false,
        error: transactionError.message || 'Failed to create account profile. Registration aborted.'
      });
    } finally {
      await session.endSession();
    }

    res.status(201).json({
      success: true,
      token: generateToken(createdUser._id),
      user: {
        _id: createdUser._id,
        email: createdUser.email,
        role: createdUser.role,
        name: createdUser.name,
        phone: createdUser.phone
      },
      expert: expertProfile
    });

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

/**
 * @desc    Upload profile picture
 * @route   PUT /auth/profile/image
 * @access  Private
 */
const uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Please upload an image file' });
    }

    const imagePath = `/uploads/${req.file.filename}`;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    user.profileImage = imagePath;
    await user.save();

    // If user is an Expert, keep the Expert profile in sync
    if (user.role === 'Expert') {
      const Expert = require('../models/Expert');
      await Expert.findOneAndUpdate({ user: user._id }, { profileImage: imagePath });
    }

    res.status(200).json({
      success: true,
      profileImage: imagePath
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Server error uploading image'
    });
  }
};

const crypto = require('crypto');
const emailService = require('../services/emailService');

/**
 * @desc    Request password reset link
 * @route   POST /auth/forgot-password
 * @access  Public
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Please provide an email address' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({ success: false, error: 'There is no user registered with that email address' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(20).toString('hex');

    // Hash token and set to resetPasswordToken field
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Set expire (10 minutes)
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

    await user.save({ validateBeforeSave: false });

    // Create reset url
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

    const messageHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #2196F3;">Password Reset Request</h2>
        <p>Hi ${user.name || 'User'},</p>
        <p>You are receiving this email because you (or someone else) requested a password reset for your account on SkillSync.</p>
        <p>Please click the button below or copy and paste the link into your browser to reset your password. This link is valid for 10 minutes:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #2196F3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Reset Password</a>
        </div>
        <p style="word-break: break-all; color: #777;"><a href="${resetUrl}">${resetUrl}</a></p>
        <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;">
        <p style="font-size: 12px; color: #777;">If you did not request this reset, please ignore this email and your password will remain unchanged.</p>
      </div>
    `;

    try {
      await emailService.sendEmail({
        to: user.email,
        subject: 'SkillSync Password Reset Request',
        html: messageHtml,
        text: `SkillSync Password Reset: You requested a password reset. Reset your password by clicking here: ${resetUrl}`
      });

      res.status(200).json({ success: true, message: 'Password reset link sent to your email' });
    } catch (err) {
      console.error('Failed to send reset email:', err.message);
      user.resetPasswordToken = null;
      user.resetPasswordExpire = null;
      await user.save({ validateBeforeSave: false });
      return res.status(500).json({ success: false, error: 'Email could not be sent. Please try again later.' });
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

/**
 * @desc    Reset password
 * @route   PUT /auth/reset-password/:token
 * @access  Public
 */
const resetPassword = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, error: 'Please provide a valid password of at least 6 characters' });
    }

    // Hash token sent in URL
    const resetPasswordToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ success: false, error: 'Invalid or expired password reset token' });
    }

    // Set new password (will be hashed in userSchema.pre('save') hook)
    user.password = password;
    user.resetPasswordToken = null;
    user.resetPasswordExpire = null;
    await user.save();

    // Log the user in immediately by sending a new token
    res.status(200).json({
      success: true,
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        rating: user.rating,
        numReviews: user.numReviews,
        profileImage: user.profileImage
      }
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  uploadProfileImage,
  forgotPassword,
  resetPassword
};
