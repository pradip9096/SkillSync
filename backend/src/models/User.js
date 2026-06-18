/**
 * @file User.js
 * @description Mongoose model for the `users` collection. Stores login credentials,
 * role assignments, profile data, and booking-penalty state (late cancellation strikes
 * and suspension timestamps). Passwords are hashed automatically by a pre-save hook.
 *
 * Inputs and outputs:
 *   - Exports: the `User` Mongoose model.
 *
 * Side effects:
 *   - `pre('save')`: hashes the password with bcrypt (salt rounds = 10) whenever
 *     the `password` field is modified.
 *
 * Dependencies:
 *   - `mongoose` — MongoDB ODM.
 *   - `bcryptjs` — Password hashing and comparison.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // User's email address (used for login)
  email: {
    type: String,
    required: [true, 'Please add an email address'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email address'
    ]
  },
  // Hashed password
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  // Authorization role
  role: {
    type: String,
    enum: ['Client', 'Expert', 'Admin'],
    default: 'Client'
  },
  // User's display name (optional, gathered during booking)
  name: {
    type: String,
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  // Profile picture URL
  profileImage: {
    type: String,
    default: ''
  },
  // User's phone number (optional, gathered during booking, +91 validated)
  phone: {
    type: String,
    match: [
      /^\+91[6-9][0-9]{9}$/,
      'Please add a valid Indian phone number starting with +91 followed by 10 digits (6-9)'
    ]
  },
  // Number of late cancellations accumulated
  lateCancellationsCount: {
    type: Number,
    default: 0
  },
  // Suspension end timestamp
  suspendedUntil: {
    type: Date,
    default: null
  },
  // Client's average rating as reviewed by experts
  rating: {
    type: Number,
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot be more than 5'],
    default: 5.0
  },
  // Total number of ratings client has received
  numReviews: {
    type: Number,
    default: 0
  },
  // Temporary tokens used for forgot password operations
  resetPasswordToken: {
    type: String,
    default: null
  },
  resetPasswordExpire: {
    type: Date,
    default: null
  }
}, {
  // Automatically manage createdAt and updatedAt fields
  timestamps: true
});

/**
 * Hashes the password with bcrypt before persisting whenever the `password` field has
 * been modified. Uses a salt factor of 10. No-ops on saves that do not touch the password
 * (e.g. profile field updates) to avoid unnecessary re-hashing.
 */
userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

/**
 * Compares a plain-text password attempt against the stored bcrypt hash.
 * This function is async. It awaits `bcrypt.compare`.
 *
 * @async
 * @param {string} enteredPassword - The plain-text password provided during login.
 * @returns {Promise<boolean>} `true` if the password matches; `false` otherwise.
 */
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
