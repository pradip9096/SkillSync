/**
 * @file Review.js
 * @description Mongoose schema and model for client-written reviews of experts.
 * Tracks star ratings and optional comments that a client submits after a completed
 * session. A unique index on `booking` enforces one review per session per client.
 *
 * Inputs and outputs:
 *   - Exports: the `Review` Mongoose model.
 */

const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  // Reference to the Expert being reviewed
  expert: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Expert',
    required: true
  },
  // Reference to the User who left the review
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Saved client name to avoid populating User object on listings
  userName: {
    type: String,
    required: true,
    trim: true
  },
  // Numerical rating from 1 to 5
  rating: {
    type: Number,
    required: true,
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot be more than 5']
  },
  // Optional written feedback comment
  comment: {
    type: String,
    trim: true
  },
  // Reference to the Booking associated with this review (must be unique per booking)
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    unique: true
  }
}, {
  // Automatically manage createdAt and updatedAt fields
  timestamps: true
});

module.exports = mongoose.model('Review', reviewSchema);
