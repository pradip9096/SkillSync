/**
 * Purpose: Mongoose schema and model for Client Reviews by Experts.
 * Inputs: None.
 * Outputs: Mongoose model for the 'ClientReview' collection.
 * Side Effects: None.
 */

const mongoose = require('mongoose');

const clientReviewSchema = new mongoose.Schema({
  // Reference to the Client (User) being reviewed
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Reference to the Expert leaving the review
  expert: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Expert',
    required: true
  },
  // Saved expert name to avoid extra populations
  expertName: {
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

module.exports = mongoose.model('ClientReview', clientReviewSchema);
