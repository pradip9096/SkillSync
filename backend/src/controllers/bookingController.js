/**
 * Purpose: Handlers for booking-related API requests.
 * Inputs: Express request objects containing booking details, user identifiers (email), and status updates.
 * Outputs: Express response objects with JSON data representing bookings, lists of booked slots, or status confirmations.
 * Side Effects: Performs database operations (create, find, update) on the Booking collection and emits real-time events via Socket.io.
 */

const Booking = require('../models/Booking');
const Expert = require('../models/Expert');
const Availability = require('../models/Availability');

/**
 * Purpose: Create a new booking after checking for existing conflicts.
 * @param {Object} req - Express request object containing expert, userName, userEmail, userPhone, bookingDate, slotTime, and notes in the body.
 * @param {Object} res - Express response object used to send back the status and booking data.
 * @returns {Promise<void>} Sends a 201 response with the booking data on success, or a 400/500 response on failure.
 * Side effects: Consults the database for existing bookings, writes a new record to the database, and emits a 'slot_booked' event to a Socket.io room.
 */
const createBooking = async (req, res) => {
  try {
    const { expert, userName, userEmail, userPhone, bookingDate, slotTime, notes } = req.body;

    // Check for authenticated user from req.user or parse JWT from header
    let userRef = null;
    let authUser = req.user;

    if (!authUser && req.headers && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const jwt = require('jsonwebtoken');
        const User = require('../models/User');
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || 'skillsync_fallback_jwt_secret_key_2026'
        );
        authUser = await User.findById(decoded.id).select('-password');
      } catch (err) {
        console.error('Manual auth parsing in createBooking failed:', err.message);
      }
    }

    if (authUser) {
      userRef = authUser._id;
      // Auto-save: update user's profile details if currently empty
      let profileUpdated = false;
      if (!authUser.name && userName) {
        authUser.name = userName;
        profileUpdated = true;
      }
      if (!authUser.phone && userPhone) {
        authUser.phone = userPhone;
        profileUpdated = true;
      }
      if (profileUpdated) {
        await authUser.save();
      }
    }

    // Block admin from booking expert sessions
    if (authUser && authUser.role === 'Admin') {
      return res.status(400).json({
        success: false,
        error: 'Administrators are not permitted to book expert sessions. Please use a Client account.'
      });
    }

    // Block expert from booking their own slot
    const expertProfile = await Expert.findById(expert).populate('user');
    if (!expertProfile) {
      return res.status(404).json({
        success: false,
        error: 'Expert profile not found.'
      });
    }

    if (expertProfile.user) {
      const expertUserId = expertProfile.user._id.toString();
      const expertEmail = expertProfile.user.email;

      if (
        (authUser && expertUserId === authUser._id.toString()) ||
        (userEmail && userEmail.toLowerCase().trim() === expertEmail.toLowerCase().trim())
      ) {
        return res.status(400).json({
          success: false,
          error: 'You cannot book a session with yourself.'
        });
      }
    }

    /**
     * Check if the selected time slot is already booked.
     * We exclude 'Cancelled' bookings to allow previously cancelled slots to be re-booked.
     */
    const existingBooking = await Booking.findOne({ 
      expert, 
      bookingDate, 
      slotTime,
      status: { $ne: 'Cancelled' }
    });
    
    // If a non-cancelled booking exists for this slot, return an error.
    if (existingBooking) {
      return res.status(400).json({
        success: false,
        error: 'This time slot is already booked.'
      });
    }

    // Check if the slot is blocked in Availability collection
    const existingBlock = await Availability.findOne({
      expert,
      bookingDate,
      slotTime
    });

    if (existingBlock) {
      return res.status(400).json({
        success: false,
        error: 'This time slot is blocked by the expert.'
      });
    }

    // Create the booking record in the database
    const booking = await Booking.create({
      expert,
      user: userRef,
      userName,
      userEmail,
      userPhone,
      bookingDate,
      slotTime,
      notes
    });

    /**
     * Real-time notification via Socket.io.
     * We emit a 'slot_booked' event to the expert's specific room so other users
     * viewing that expert see the slot as booked immediately.
     */
    const io = req.app.get('io');
    io.to(expert).emit('slot_booked', { bookingDate, slotTime });

    res.status(201).json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Error in createBooking:', error);
    
    /**
     * Handle MongoDB Duplicate Key Error (code 11000).
     * This acts as a secondary safeguard against race conditions where two users
     * might pass the initial check simultaneously.
     */
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'Double booking detected. This slot was just taken.'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

/**
 * Purpose: Get all bookings associated with a specific user email.
 * @param {Object} req - Express request object containing 'email' in the query string.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a 200 response with an array of bookings, or a 400/500 response on failure.
 * Side effects: Reads from the database and populates expert details for the returned bookings.
 */
const getBookingsByEmail = async (req, res) => {
  try {
    const { email } = req.query;
    
    // Email is required to filter bookings
    if (!email) {
      return res.status(400).json({ success: false, error: 'Please provide an email' });
    }

    // Ensure caller is authorized (Admin or the owner of the email)
    if (req.user.role !== 'Admin' && req.user.email.toLowerCase().trim() !== email.toLowerCase().trim()) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view bookings for this email address.'
      });
    }

    // Find bookings and populate expert details for the frontend to display
    const bookings = await Booking.find({ 
      userEmail: email,
      notes: { $ne: 'Blocked by Expert' }
    }).populate('expert', 'name category');

    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings
    });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

/**
 * Purpose: Update the status of an existing booking, including time-lock validation for completions.
 * @param {Object} req - Express request object containing the new status in the body and booking ID in params.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a 200 response with the updated booking, or a 400/404/500 response on failure.
 * Side effects: Updates a database record and emits a 'slot_released' event via Socket.io if the status is changed to 'Cancelled'.
 */
const updateBookingStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    // Verify caller has permissions (Admin, Client owner, or host Expert)
    const isAdmin = req.user.role === 'Admin';
    const isClientOwner = (booking.user && booking.user.toString() === req.user._id.toString()) || 
                          (booking.userEmail && booking.userEmail.toLowerCase().trim() === req.user.email.toLowerCase().trim());
    
    let isExpertOwner = false;
    if (req.user.role === 'Expert') {
      const expertProfile = await Expert.findOne({ user: req.user._id });
      isExpertOwner = expertProfile && booking.expert.toString() === expertProfile._id.toString();
    }

    if (!isAdmin && !isClientOwner && !isExpertOwner) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to modify the status of this booking.'
      });
    }

    /**
     * Time-lock check for "Completed" status.
     * We prevent marking a session as completed if the scheduled time hasn't passed yet.
     */
    const normalizedStatus = String(status || '').trim();
    if (normalizedStatus === 'Completed') {
      const nowMs = Date.now();
      // Construct a Date object for the session time in IST
      const sessionTime = new Date(`${booking.bookingDate}T${booking.slotTime}:00+05:30`);
      const sessionMs = sessionTime.getTime();

      // Validate that the session time construction was successful
      if (Number.isNaN(sessionMs)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid booking date or slot time. Cannot verify session start time.'
        });
      }

      // Check if current time is before the session time
      if (nowMs < sessionMs) {
        return res.status(400).json({
          success: false,
          error: `Time-lock violation: This session is scheduled for ${booking.bookingDate} ${booking.slotTime} IST and cannot be completed yet.`
        });
      }
    }

    // Update and save the booking document
    booking.status = normalizedStatus;
    await booking.save();

    /**
     * Real-time release notification.
     * If a booking is cancelled, we notify other users so the slot becomes available immediately.
     */
    if (normalizedStatus === 'Cancelled') {
      const io = req.app.get('io');
      if (io) {
        io.to(booking.expert.toString()).emit('slot_released', { 
          bookingDate: booking.bookingDate, 
          slotTime: booking.slotTime 
        });
      }
    }

    res.status(200).json({ success: true, data: booking });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

/**
 * Purpose: Retrieve all booked slot times for a specific expert on a specific date.
 * @param {Object} req - Express request object containing expertId and date in params.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a 200 response with an array of booked slot strings.
 * Side effects: Reads booking records from the database.
 */
const getBookedSlots = async (req, res) => {
  try {
    const { expertId, date } = req.params;
    
    /**
     * Fetch all bookings for the given expert and date.
     * Exclude cancelled bookings so those slots appear as available on the frontend.
     */
    const bookings = await Booking.find({ 
      expert: expertId, 
      bookingDate: date,
      status: { $ne: 'Cancelled' }
    });

    // Fetch availability blocks
    const blocks = await Availability.find({
      expert: expertId,
      bookingDate: date
    });
    
    // Extract slot details needed by both client and expert dashboards
    const bookedSlots = [
      ...bookings.map(b => ({
        slotTime: b.slotTime,
        userName: b.userName,
        notes: b.notes
      })),
      ...blocks.map(a => ({
        slotTime: a.slotTime,
        userName: 'Blocked Slot',
        notes: a.notes || 'Blocked by Expert'
      }))
    ];

    res.status(200).json({
      success: true,
      data: bookedSlots
    });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

/**
 * Purpose: Mark a booking as having been rated by the user.
 * @param {Object} req - Express request object containing the booking ID in params.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a 200 response with the updated booking, or a 404/500 response on failure.
 * Side effects: Updates the 'isRated' field of a booking record in the database.
 */
const markAsRated = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    // Ensure caller is authorized (Admin or Client owner)
    const isAdmin = req.user.role === 'Admin';
    const isClientOwner = (booking.user && booking.user.toString() === req.user._id.toString()) || 
                          (booking.userEmail && booking.userEmail.toLowerCase().trim() === req.user.email.toLowerCase().trim());

    if (!isAdmin && !isClientOwner) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to rate this session.'
      });
    }

    booking.isRated = true;
    await booking.save();

    res.status(200).json({ success: true, data: booking });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

module.exports = {
  createBooking,
  getBookingsByEmail,
  updateBookingStatus,
  getBookedSlots,
  markAsRated
};
