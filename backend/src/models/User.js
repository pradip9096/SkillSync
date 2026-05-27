/**
 * Purpose: Mongoose schema and model for Users (credentials and profiles).
 * Inputs: None.
 * Outputs: Mongoose model for the 'User' collection.
 * Side Effects: Hashes passwords on save/modification.
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
    trim: true
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
      /^\+91[0-9]{10}$/,
      'Please add a valid Indian phone number starting with +91'
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
  }
}, {
  // Automatically manage createdAt and updatedAt fields
  timestamps: true
});

// Encrypt password using bcrypt before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
