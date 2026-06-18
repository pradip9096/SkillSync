/**
 * @file authController.js
 * @description Express route handler functions for user registration, authentication, and
 * profile management. Handles JWT token issuance, bcrypt password comparison, transactional
 * dual-document creation for Expert accounts, and the full forgot/reset-password flow.
 *
 * Inputs and outputs:
 *   - All handlers receive `(req, res, next)` from Express and write a JSON response.
 *   - Exports: `{ generateToken, registerUser, loginUser, getUserProfile, updateUserProfile,
 *     uploadProfileImage, forgotPassword, resetPassword }`.
 *
 * Side effects:
 *   - Reads and writes the `User` and `Expert` MongoDB collections.
 *   - Transactional writes (registration, profile update, image upload) use `session.withTransaction`.
 *   - Sends a password-reset email via `emailService.sendEmail` in `forgotPassword`.
 *   - Stores a hashed reset token and expiry on the User document.
 *
 * Dependencies:
 *   - `mongoose` — MongoDB transaction sessions.
 *   - `jsonwebtoken` — JWT signing and verification.
 *   - `crypto` — CSPRNG token generation and SHA-256 hashing for reset tokens.
 *   - `../models/User` — Mongoose User model.
 *   - `../models/Expert` — Mongoose Expert model.
 *   - `../services/emailService` — SMTP/Ethereal email dispatch.
 *   - `../utils/phoneUtils` — Indian phone number format validator.
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const Expert = require('../models/Expert');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const emailService = require('../services/emailService');
const { isValidIndianPhone } = require('../utils/phoneUtils');

/**
 * Generates a signed JWT token for the given user ID.
 * Throws immediately if `JWT_SECRET` is not set, preventing silent insecure token creation.
 *
 * @param {string} id - Mongoose `_id` of the User document.
 * @returns {string} Signed JWT string valid for 7 days.
 * @throws {Error} If `process.env.JWT_SECRET` is undefined.
 */
const generateToken = (id) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET environment variable is not defined.');
  }
  return jwt.sign(
    { id },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

/**
 * Registers a new Client or Expert user. For Expert registrations, atomically creates
 * both a `User` credential document and an `Expert` profile inside a single MongoDB
 * transaction. Admin registration via this endpoint is blocked.
 * This function is async. It awaits `User.findOne`, `session.withTransaction`,
 * transactional `User.create`, and optionally `Expert.create`.
 *
 * @async
 * @param {import('express').Request} req - Express request. Required body: `email`, `password`.
 *   For `role: 'Expert'`: also `name`, `phone` (+91), `category`, `experience`, `hourlyRate`,
 *   `description`.
 * @param {import('express').Response} res - Express response. Returns `{ success, token, user, expert }`.
 * @param {import('express').NextFunction} next - Forwards unexpected errors to the global error handler.
 * @returns {Promise<void>}
 * @throws {400} If required fields are missing, phone/category/experience/hourlyRate validation fails,
 *   email already exists, or `role` is `Admin`.
 * @route POST /auth/register
 */
const registerUser = async (req, res, next) => {
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
      if (!isValidIndianPhone(phone)) {
        return res.status(400).json({
          success: false,
          error: 'Please provide a valid Indian phone number starting with +91 (e.g., +919876543210)'
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
    return next(error);
  }
};

/**
 * Authenticates a user with email and password, returning a signed JWT on success.
 * This function is async. It awaits `User.findOne` and `user.matchPassword` (bcrypt compare).
 *
 * @async
 * @param {import('express').Request} req - Express request. Required body: `email`, `password`.
 * @param {import('express').Response} res - Express response. Returns `{ success, token, user }`.
 * @param {import('express').NextFunction} next - Forwards unexpected errors to the global error handler.
 * @returns {Promise<void>}
 * @throws {400} If `email` or `password` are not provided.
 * @throws {401} If the email does not exist or the password does not match (same message to prevent enumeration).
 * @route POST /auth/login
 */
const loginUser = async (req, res, next) => {
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
    return next(error);
  }
};

/**
 * Returns the authenticated user's profile document, excluding the password hash.
 * This function is async. It awaits `User.findById` with `.select('-password')`.
 *
 * @async
 * @param {import('express').Request} req - Express request. `req.user._id` is set by `authMiddleware.protect`.
 * @param {import('express').Response} res - Express response. Returns `{ success, user }`.
 * @param {import('express').NextFunction} next - Forwards unexpected errors to the global error handler.
 * @returns {Promise<void>}
 * @throws {404} If the user document no longer exists in the database.
 * @route GET /auth/profile
 */
const getUserProfile = async (req, res, next) => {
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
    return next(error);
  }
};

/**
 * Updates the authenticated user's `name`, `phone`, and/or `password`. For Expert users,
 * syncs the `name` field on the linked Expert profile inside the same transaction.
 * This function is async. It awaits `User.findById`, `session.withTransaction`,
 * `user.save`, and optionally `Expert.findOneAndUpdate`.
 *
 * @async
 * @param {import('express').Request} req - Express request. Optional body fields: `name`, `phone`, `password`.
 *   `req.user._id` is set by `authMiddleware.protect`.
 * @param {import('express').Response} res - Express response. Returns `{ success, user }` with updated fields.
 * @param {import('express').NextFunction} next - Forwards unexpected errors to the global error handler.
 * @returns {Promise<void>}
 * @throws {400} If `name` exceeds 100 characters, `phone` format is invalid, or `password` < 6 characters.
 * @throws {404} If the user document no longer exists.
 * @route PUT /auth/profile
 */
const updateUserProfile = async (req, res, next) => {
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
      if (req.body.name && req.body.name.length > 100) {
        return res.status(400).json({ success: false, error: 'Name cannot exceed 100 characters' });
      }
      user.name = req.body.name;
    }

    if (req.body.phone !== undefined) {
      const phone = req.body.phone;
      if (phone && !isValidIndianPhone(phone)) {
        return res.status(400).json({
          success: false,
          error: 'Please provide a valid Indian phone number'
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

    const session = await mongoose.startSession();
    let updatedUser;
    
    try {
      await session.withTransaction(async () => {
        updatedUser = await user.save({ session });
        
        if (updatedUser.role === 'Expert' && req.body.name !== undefined) {
          const Expert = require('../models/Expert');
          await Expert.findOneAndUpdate({ user: updatedUser._id }, { name: updatedUser.name }, { session });
        }
      });
    } finally {
      session.endSession();
    }

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
    return next(error);
  }
};

/**
 * Stores the uploaded profile image path on the User document and, for Expert users,
 * syncs it to the Expert profile inside an ACID transaction.
 * This function is async. It awaits `User.findById`, `session.withTransaction`,
 * `user.save`, and optionally `Expert.findOneAndUpdate`.
 *
 * @async
 * @param {import('express').Request} req - Express request. `req.file` is set by the Multer upload middleware;
 *   `req.user._id` is set by `authMiddleware.protect`.
 * @param {import('express').Response} res - Express response. Returns `{ success, profileImage }` with the new path.
 * @param {import('express').NextFunction} next - Forwards unexpected errors to the global error handler.
 * @returns {Promise<void>}
 * @throws {400} If no file was included in the request.
 * @throws {404} If the user document no longer exists.
 * @route PUT /auth/profile/image
 */
const uploadProfileImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Please upload an image file' });
    }

    const imagePath = `/uploads/${req.file.filename}`;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        user.profileImage = imagePath;
        await user.save({ session });

        // If user is an Expert, keep the Expert profile in sync
        if (user.role === 'Expert') {
          const Expert = require('../models/Expert');
          await Expert.findOneAndUpdate({ user: user._id }, { profileImage: imagePath }, { session });
        }
      });
    } finally {
      session.endSession();
    }

    res.status(200).json({
      success: true,
      profileImage: imagePath
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Initiates the password-reset flow: generates a 20-byte CSPRNG token, stores its
 * SHA-256 hash on the User document with a 10-minute expiry, and emails a reset link.
 * Returns a generic success message even when the email is not found to prevent user enumeration.
 * This function is async. It awaits `User.findOne`, `user.save`, and `emailService.sendEmail`.
 *
 * @async
 * @param {import('express').Request} req - Express request. Required body: `email`.
 * @param {import('express').Response} res - Express response. Returns `{ success, message }` regardless
 *   of whether the email exists.
 * @param {import('express').NextFunction} next - Forwards unexpected errors to the global error handler.
 * @returns {Promise<void>}
 * @throws {400} If `email` is not provided in the request body.
 * @route POST /auth/forgot-password
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Please provide an email address' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      // Prevent user enumeration by returning a generic success message even if email is not found
      return res.status(200).json({ success: true, data: 'If that email address exists in our system, you will receive a password reset link shortly.' });
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
    return next(err);
    }
  } catch (error) {
    return next(error);
  }
};

/**
 * Completes the password-reset flow: validates the URL token against the stored SHA-256 hash
 * and expiry, updates the password (pre-save hook re-hashes it), clears the reset fields,
 * and returns a new JWT so the user is logged in immediately.
 * This function is async. It awaits `User.findOne` and `user.save`.
 *
 * @async
 * @param {import('express').Request} req - Express request. `req.params.token` is the plain-text reset token
 *   from the email link; `req.body.password` is the new password (min 6 characters).
 * @param {import('express').Response} res - Express response. Returns `{ success, token, user }` with a new JWT.
 * @param {import('express').NextFunction} next - Forwards unexpected errors to the global error handler.
 * @returns {Promise<void>}
 * @throws {400} If `password` is missing or < 6 characters, or if the token is invalid or expired.
 * @route PUT /auth/reset-password/:token
 */
const resetPassword = async (req, res, next) => {
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
    return next(error);
  }
};

module.exports = {
  generateToken,
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  uploadProfileImage,
  forgotPassword,
  resetPassword
};
