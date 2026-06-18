/**
 * @file Availability.js
 * @description Mongoose schema and model for expert calendar availability blocks.
 * An `Availability` document represents a slot that an expert has manually blocked —
 * it is not a booking, but it prevents new bookings from being created for the same
 * expert/date/time combination. Used alongside the `Booking` compound index for
 * two-layer conflict prevention.
 *
 * Inputs and outputs:
 *   - Exports: the `Availability` Mongoose model.
 *
 * Side effects:
 *   - Defines a compound unique index `{ expert, bookingDate, slotTime }` in MongoDB.
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
