/**
 * Purpose: Mongoose schema and model for session bookings.
 * Inputs: None (defines the structure for booking data).
 * Outputs: Mongoose model for the 'Booking' collection.
 * Side Effects: Defines a compound unique index in MongoDB to prevent duplicate bookings for the same expert, date, and time slot (excluding cancelled ones).
 */

const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  // Reference to the Expert being booked
  expert: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Expert',
    required: true
  },
  // Reference to the registered User who made this booking
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // User's name with basic validation
  userName: {
    type: String,
    required: [true, 'Please add your name'],
    trim: true
  },
  // User's email with regex validation
  userEmail: {
    type: String,
    required: [true, 'Please add your email'],
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ]
  },
  // User's phone number validated for Indian format (+91 followed by 10 digits)
  userPhone: {
    type: String,
    required: [true, 'Please add your phone number'],
    match: [
      /^\+91[0-9]{10}$/,
      'Please add a valid Indian phone number starting with +91'
    ]
  },
  // Date of the booking in YYYY-MM-DD format
  bookingDate: {
    type: String, // Format: YYYY-MM-DD
    required: true
  },
  // Time slot in HH:mm format (e.g., "10:00")
  slotTime: {
    type: String, // Format: HH:mm (e.g., "10:00")
    required: true
  },
  // Current status of the booking
  status: {
    type: String,
    enum: ['Pending', 'Confirmed', 'Completed', 'Cancelled', 'Late Cancellation'],
    default: 'Confirmed'
  },
  // Tracks if the user has already rated this session
  isRated: {
    type: Boolean,
    default: false
  },
  // Tracks if the expert has already rated the client for this session
  isClientRated: {
    type: Boolean,
    default: false
  },
  // Optional notes provided by the user during booking
  notes: {
    type: String
  },
  // Helper field to enforce compound uniqueness for active bookings
  active: {
    type: Boolean,
    default: true
  }
}, {
  // Automatically manage createdAt and updatedAt fields
  timestamps: true
});

/**
 * Purpose: Converts booking date and slot time into a JavaScript Date object in IST (+05:30).
 * @param {string} bookingDate - Date string in YYYY-MM-DD format.
 * @param {string} slotTime - Time string in HH:mm format.
 * @returns {Date|null} - A JavaScript Date object representing the session time, or null if the date/time is invalid.
 * Side effects: None.
 */
const parseISTSessionTime = (bookingDate, slotTime) => {
  const session = new Date(`${bookingDate}T${slotTime}:00+05:30`);
  return Number.isNaN(session.getTime()) ? null : session;
};

/**
 * Purpose: Pre-save hook to enforce time-lock validation for 'Completed' status updates.
 * @returns {Promise<void>} Resolves if validation passes, otherwise throws an Error.
 * Side effects: Throws an error to prevent saving if the session time has not yet passed.
 */
bookingSchema.pre('save', async function () {
  // Synchronize the active field state with the status
  if (['Cancelled', 'Late Cancellation'].includes(this.status)) {
    this.active = false;
  } else {
    this.active = true;
  }

  if (this.isModified('status') && this.status === 'Completed') {
    const sessionTime = parseISTSessionTime(this.bookingDate, this.slotTime);
    if (!sessionTime) {
      throw new Error('Invalid booking date or slot time.'); 
    }
    // Compare current time with the session time
    if (Date.now() < sessionTime.getTime()) {
      throw new Error('Time-lock violation: Session has not started yet.');
    }
  }
});

/**
 * Purpose: Pre-findOneAndUpdate hook to enforce time-lock validation for 'Completed' status updates during updates.
 * @returns {Promise<void>} Resolves if validation passes, otherwise throws an Error.
 * Side effects: Throws an error to prevent the update if the session time has not yet passed.
 */
bookingSchema.pre('findOneAndUpdate', async function () {
  const update = this.getUpdate();
  const status = update.status || (update.$set && update.$set.status);
  
  if (status === 'Completed') {
    // Attempt to extract booking details from the update object
    const bookingDate = update.bookingDate || (update.$set && update.$set.bookingDate);
    const slotTime = update.slotTime || (update.$set && update.$set.slotTime);
    
    if (bookingDate && slotTime) {
      const sessionTime = parseISTSessionTime(bookingDate, slotTime);
      if (sessionTime && Date.now() < sessionTime.getTime()) {
        throw new Error('Time-lock violation: Session has not started yet.');
      }
    }
  }
});

/**
 * Compound Unique Index
 * Prevents double booking for the same expert, date, and time slot.
 * The partial filter ensures that 'Cancelled' and 'Late Cancellation' bookings do not block new bookings for the same slot.
 */
bookingSchema.index(
  { expert: 1, bookingDate: 1, slotTime: 1 }, 
  { 
    unique: true,
    partialFilterExpression: { active: true }
  }
);

module.exports = mongoose.model('Booking', bookingSchema);
