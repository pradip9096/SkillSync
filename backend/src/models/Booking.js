/**
 * @file Booking.js
 * @description Mongoose schema and model for session bookings. This is the central
 * document in the booking lifecycle. Conflict prevention uses two layers: (1) a
 * pre-check query in `BookingService` and (2) a compound unique partial index on the
 * `active` field defined below. An `active=false` booking (Cancelled, Late Cancellation,
 * or Completed) is excluded from the index so the slot can be rebooked.
 *
 * Inputs and outputs:
 *   - Exports: the `Booking` Mongoose model.
 *
 * Side effects:
 *   - Registers two pre-save hooks (one for `save`, one for `findOneAndUpdate`) that
 *     enforce the `active` flag synchronisation and a time-lock preventing premature
 *     `Completed` transitions.
 *   - Defines a compound unique partial index `{ expert, bookingDate, slotTime }` where
 *     `active: true` — written to MongoDB on first model use.
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
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
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
      /^\+91[6-9][0-9]{9}$/,
      'Please add a valid Indian phone number starting with +91 followed by 10 digits (6-9)'
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
    default: 'Pending'
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
  },
  // Store job IDs from Agenda to track and manage pending scheduled tasks
  agenda24hJobId: {
    type: String,
    default: null
  },
  agenda2hJobId: {
    type: String,
    default: null
  },
  razorpayOrderId: {
    type: String,
    default: null
  }
}, {
  // Automatically manage createdAt and updatedAt fields
  timestamps: true
});

/**
 * Parses a `YYYY-MM-DD` date and `HH:mm` 24-hour time string in IST (+05:30)
 * into a UTC JavaScript `Date` object.
 *
 * @param {string} bookingDate - Session date in `YYYY-MM-DD` format.
 * @param {string} slotTime - Session start time in `HH:mm` (24-hour) format.
 * @returns {Date|null} Parsed `Date`, or `null` if the input is invalid.
 */
const parseISTSessionTime = (bookingDate, slotTime) => {
  const session = new Date(`${bookingDate}T${slotTime}:00+05:30`);
  return Number.isNaN(session.getTime()) ? null : session;
};

/**
 * Pre-save hook. Synchronises the `active` flag with booking status and enforces the
 * time-lock rule: a booking cannot be moved to `Completed` until at least 1 hour after
 * the session start time (IST). `bypassTimeLock` or `_bypassTimeLock` skip this guard
 * for admin overrides.
 *
 * @async
 * @returns {Promise<void>}
 * @throws {Error} If `bookingDate`/`slotTime` are unparseable, or the session has not yet ended.
 */
bookingSchema.pre('save', async function () {
  // Synchronize the active field state with the status.
  // active=false releases the compound unique index so the slot can be rebooked.
  // IMPORTANT: 'Completed' must also set active=false — otherwise the slot is
  // permanently blocked by the unique index for that expert/date/time combination.
  if (['Cancelled', 'Late Cancellation', 'Completed'].includes(this.status)) {
    this.active = false;
  } else {
    // 'Pending' and 'Confirmed' hold the slot exclusively
    this.active = true;
  }

  if (this.isModified('status') && this.status === 'Completed' && !this.bypassTimeLock && !this._bypassTimeLock) {
    const sessionTime = parseISTSessionTime(this.bookingDate, this.slotTime);
    if (!sessionTime) {
      throw new Error('Invalid booking date or slot time.'); 
    }
    // Compare current time with the session end time (start time + 1 hour)
    if (Date.now() < sessionTime.getTime() + 60 * 60 * 1000) {
      throw new Error('Time-lock violation: Session has not ended yet.');
    }
  }
});

/**
 * Pre-`findOneAndUpdate` hook. Mirrors the time-lock logic from the `pre('save')` hook
 * for update-path writes (e.g. admin status changes via `findOneAndUpdate`).
 *
 * @async
 * @returns {Promise<void>}
 * @throws {Error} If the session has not yet ended when transitioning to `Completed`.
 */
bookingSchema.pre('findOneAndUpdate', async function () {
  const update = this.getUpdate();
  const status = update.status || (update.$set && update.$set.status);
  
  if (status === 'Completed') {
    // Fetch the booking document to ensure we have its date and time slot
    const booking = await this.model.findOne(this.getQuery());
    if (booking) {
      const bookingDate = update.bookingDate || (update.$set && update.$set.bookingDate) || booking.bookingDate;
      const slotTime = update.slotTime || (update.$set && update.$set.slotTime) || booking.slotTime;
      
      const sessionTime = parseISTSessionTime(bookingDate, slotTime);
      if (sessionTime && Date.now() < sessionTime.getTime() + 60 * 60 * 1000) {
        throw new Error('Time-lock violation: Session has not ended yet.');
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
