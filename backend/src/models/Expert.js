/**
 * Purpose: Mongoose schema and model for Experts.
 * Inputs: None (defines the structure for expert profile data).
 * Outputs: Mongoose model for the 'Expert' collection.
 * Side Effects: None.
 */

const mongoose = require('mongoose');

const expertSchema = new mongoose.Schema({
  // Expert's full name
  name: {
    type: String,
    required: [true, 'Please add a name'],
    trim: true
  },
  // Industry category the expert belongs to
  category: {
    type: String,
    required: [true, 'Please add a category'],
    enum: [
      'Technology',
      'Finance',
      'Health',
      'Marketing',
      'Design',
      'Business'
    ]
  },
  // Years of professional experience
  experience: {
    type: Number,
    required: [true, 'Please add years of experience']
  },
  // Average rating from 1 to 5
  rating: {
    type: Number,
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot be more than 5'],
    default: 4.5
  },
  // Total number of reviews received
  numReviews: {
    type: Number,
    default: 0
  },
  // URL to the expert's profile image
  profileImage: {
    type: String,
    default: 'https://placehold.co/150'
  },
  // Detailed bio or description of the expert's services
  description: {
    type: String,
    required: [true, 'Please add a description']
  },
  // Rate charged per hour of session (USD)
  hourlyRate: {
    type: Number,
    required: [true, 'Please add an hourly rate']
  }
}, {
  // Automatically manage createdAt and updatedAt fields
  timestamps: true
});

module.exports = mongoose.model('Expert', expertSchema);
