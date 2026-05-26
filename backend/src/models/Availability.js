/**
 * Purpose: Mongoose schema and model for expert calendar availability blocks.
 * Inputs: None (defines the structure for availability data).
 * Outputs: Mongoose model for the 'Availability' collection.
 * Side Effects: Defines a compound unique index to prevent duplicate blocks for the same expert, date, and time slot.
 */

const mongoose = require('mongoose');

const availabilitySchema = new mongoose.Schema({
  // Reference to the Expert blocking the slot
  expert: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Expert',
    required: true
  },
  // Date of the block in YYYY-MM-DD format
  bookingDate: {
    type: String, // Format: YYYY-MM-DD
    required: true
  },
  // Time slot in HH:mm format (e.g., "10:00")
  slotTime: {
    type: String, // Format: HH:mm (e.g., "10:00")
    required: true
  },
  // Default notes explaining the block type
  notes: {
    type: String,
    default: 'Blocked by Expert'
  }
}, {
  // Automatically manage createdAt and updatedAt fields
  timestamps: true
});

// Compound Unique Index: prevents duplicate availability blocks for the same expert, date, and time slot
availabilitySchema.index(
  { expert: 1, bookingDate: 1, slotTime: 1 },
  { unique: true }
);

module.exports = mongoose.model('Availability', availabilitySchema);
