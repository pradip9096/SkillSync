/**
 * Purpose: Handlers for booking-related API requests.
 * Inputs: Express request objects containing booking details, user identifiers (email), and status updates.
 * Outputs: Express response objects with JSON data representing bookings, lists of booked slots, or status confirmations.
 * Side Effects: Performs database operations (create, find, update) on the Booking collection and emits real-time events via Socket.io.
 */

const Booking = require('../models/Booking');
const Expert = require('../models/Expert');
const Availability = require('../models/Availability');
const agenda = require('../config/agenda');
const { formatTime12H } = require('../utils/timeFormatters');
const { scheduleSessionReminders, cancelScheduledReminders } = require('../services/reminderScheduler');

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

    // Check if user is suspended
    if (authUser && authUser.suspendedUntil && Date.now() < authUser.suspendedUntil.getTime()) {
      const suspendedDateStr = new Date(authUser.suspendedUntil).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Kolkata'
      });
      return res.status(403).json({
        success: false,
        error: `Your booking privileges are temporarily suspended due to repeated late cancellations. Access will be restored on ${suspendedDateStr} IST.`
      });
    }

    // Block non-client users (Admins and Experts) from booking expert sessions
    if (authUser && authUser.role !== 'Client') {
      return res.status(403).json({
        success: false,
        error: `${authUser.role === 'Admin' ? 'Administrators' : 'Experts'} are not permitted to book expert sessions. Please use a Client account.`
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
      status: { $nin: ['Cancelled', 'Late Cancellation'] }
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

    try {
      const Notification = require('../models/Notification');
      const expertProfileForNotif = await Expert.findById(expert);
      if (expertProfileForNotif && expertProfileForNotif.user) {
        const notif = await Notification.create({
          user: expertProfileForNotif.user,
          type: 'BOOKING_UPDATE',
          title: 'New Booking Request',
          message: `${userName} booked a session with you on ${bookingDate} at ${formatTime12H(slotTime)}.`
        });
        const io = req.app.get('io');
        if (io) io.to(`user_${expertProfileForNotif.user.toString()}`).emit('new_notification', notif.toJSON());
      }
    } catch (err) {
      console.error('Error creating new booking notification:', err);
    }

    // Schedule confirmations and pre-session reminders via Agenda
    try {
      await agenda.now('send-booking-confirmation', { bookingId: booking._id });
      await scheduleSessionReminders(booking);
    } catch (schedErr) {
      console.error('[Scheduler Error] Failed to schedule reminders during booking creation:', schedErr.message);
    }

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
     * Time-lock checks for status transitions
     */
    let normalizedStatus = String(status || '').trim();
    
    if (normalizedStatus === 'Completed') {
      const nowMs = Date.now();
      // Construct a Date object for the session time in IST
      const sessionTime = new Date(`${booking.bookingDate}T${booking.slotTime}:00+05:30`);
      const sessionMs = sessionTime.getTime();

      // Validate that the session time construction was successful
      if (Number.isNaN(sessionMs)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid booking date or slot time. Cannot verify session end time.'
        });
      }

      // Check if current time is before the session end time (start time + 1 hour)
      if (nowMs < sessionMs + 60 * 60 * 1000) {
        return res.status(400).json({
          success: false,
          error: `Time-lock violation: This session is scheduled for ${booking.bookingDate} ${booking.slotTime} IST and cannot be completed yet until the hour has passed.`
        });
      }
    }

    // Cancellation policy checks for non-Admins
    if ((normalizedStatus === 'Cancelled' || normalizedStatus === 'Late Cancellation') && !isAdmin) {
      const nowMs = Date.now();
      const sessionTime = new Date(`${booking.bookingDate}T${booking.slotTime}:00+05:30`);
      const sessionMs = sessionTime.getTime();

      if (Number.isNaN(sessionMs)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid booking date or slot time. Cannot verify cancellation policy.'
        });
      }

      // Past Check: prevent Clients and Experts from cancelling past sessions
      if (nowMs >= sessionMs) {
        return res.status(400).json({
          success: false,
          error: 'Cannot cancel a session that has already passed.'
        });
      }

      // 2-Hour Window Check
      const twoHoursInMs = 2 * 60 * 60 * 1000;
      const isWithinTwoHours = (sessionMs - nowMs) <= twoHoursInMs;

      if (isWithinTwoHours) {
        if (normalizedStatus === 'Cancelled') {
          return res.status(400).json({
            success: false,
            error: 'Cancellations within 2 hours of the scheduled time must be processed as late cancellations. Please confirm to cancel late.'
          });
        }
      } else {
        // Outside 2 hours: automatically downgrade Late Cancellation requests to standard Cancelled status
        if (normalizedStatus === 'Late Cancellation') {
          normalizedStatus = 'Cancelled';
        }
      }
    }

    // If the status is changing to 'Late Cancellation', increment strikes for the cancelling user
    if (normalizedStatus === 'Late Cancellation') {
      const User = require('../models/User');
      const cancellingUser = await User.findById(req.user._id);
      if (cancellingUser) {
        cancellingUser.lateCancellationsCount = (cancellingUser.lateCancellationsCount || 0) + 1;
        if (cancellingUser.lateCancellationsCount >= 3) {
          cancellingUser.suspendedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days suspension
          cancellingUser.lateCancellationsCount = 0; // reset strike count
        }
        await cancellingUser.save();
      }
    }

    // Update and save the booking document
    booking.status = normalizedStatus;
    await booking.save();

    try {
      const Notification = require('../models/Notification');
      const io = req.app.get('io');
      
      let message = `Your session for ${booking.bookingDate} at ${formatTime12H(booking.slotTime)} was updated to ${normalizedStatus}.`;
      let type = 'BOOKING_UPDATE';
      
      if (normalizedStatus === 'Late Cancellation') {
        type = 'STRIKE';
        message = `Your session was cancelled late, resulting in a penalty strike.`;
      }

      // Notify Client if they exist
      if (booking.user) {
        const notif = await Notification.create({
          user: booking.user,
          type,
          title: `Booking ${normalizedStatus}`,
          message
        });
        if (io) io.to(`user_${booking.user.toString()}`).emit('new_notification', notif.toJSON());
      }
      
      // Notify Expert
      const expertProfile = await Expert.findById(booking.expert);
      if (expertProfile && expertProfile.user) {
        const notif = await Notification.create({
          user: expertProfile.user,
          type,
          title: `Session ${normalizedStatus}`,
          message
        });
        if (io) io.to(`user_${expertProfile.user.toString()}`).emit('new_notification', notif.toJSON());
      }
    } catch (err) {
      console.error('Error creating notification:', err);
    }

    /**
     * Real-time release notification.
     * If a booking is cancelled or late-cancelled, we notify other users so the slot becomes available immediately.
     */
    if (normalizedStatus === 'Cancelled' || normalizedStatus === 'Late Cancellation') {
      // Cancel pending scheduled reminders
      try {
        await cancelScheduledReminders(booking);
        
        // Dispatch instant cancellation alert
        const expertProfile = await Expert.findById(booking.expert).populate('user');
        if (expertProfile && expertProfile.user) {
          await agenda.now('send-booking-cancellation', {
            clientEmail: booking.userEmail,
            clientName: booking.userName,
            clientPhone: booking.userPhone,
            expertName: expertProfile.name,
            expertEmail: expertProfile.user.email,
            bookingDate: booking.bookingDate,
            slotTime: booking.slotTime,
            status: normalizedStatus,
            cancelledBy: req.user ? (req.user.role === 'Admin' ? 'Administrator' : req.user.role === 'Expert' ? 'Expert' : 'Client') : 'System'
          });
        }
      } catch (schedErr) {
        console.error('[Scheduler Error] Failed to handle cancellation reminders/alerts:', schedErr.message);
      }

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
      status: { $nin: ['Cancelled', 'Late Cancellation'] }
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
