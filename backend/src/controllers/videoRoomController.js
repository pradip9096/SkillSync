/**
 * Purpose: Controller for WebRTC Video Room token provisioning.
 * Inputs: Express request containing booking ID and authenticated user.
 * Outputs: Express response containing Twilio STUN/TURN credentials or error.
 * Side Effects: Calls videoRoomService.
 */

const Booking = require('../models/Booking');

/**
 * Purpose: Converts booking date and slot time into a JavaScript Date object in IST (+05:30).
 * @param {string} bookingDate - Date string in YYYY-MM-DD format.
 * @param {string} slotTime - Time string in HH:mm format.
 * @returns {Date|null}
 */
const parseISTSessionTime = (bookingDate, slotTime) => {
  const session = new Date(`${bookingDate}T${slotTime}:00+05:30`);
  return Number.isNaN(session.getTime()) ? null : session;
};

/**
 * @desc    Get WebRTC Video Token (Twilio STUN/TURN credentials)
 * @route   GET /api/v1/bookings/:id/video-token
 * @access  Private (Participants only)
 */
const getVideoToken = async (req, res, next) => {
  try {
    const bookingId = req.params.id;
    const userId = req.user._id.toString();

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    // Authorization Boundary: Verify userId matches booking.user or booking.expert
    const isClient = booking.user && booking.user.toString() === userId;
    const isExpert = booking.expert && booking.expert.toString() === userId;

    if (!isClient && !isExpert) {
      return res.status(403).json({ success: false, error: 'Not authorized to join this room' });
    }

    // Time-Lock Check: Accessible 5 minutes before scheduled start time
    const sessionTime = parseISTSessionTime(booking.bookingDate, booking.slotTime);
    if (!sessionTime) {
      return res.status(500).json({ success: false, error: 'Invalid booking date or slot time configured' });
    }

    const FIVE_MINUTES_MS = 5 * 60 * 1000;
    if (Date.now() < sessionTime.getTime() - FIVE_MINUTES_MS) {
      return res.status(403).json({ 
        success: false, 
        error: 'Room is locked. You can join 5 minutes before the session starts.' 
      });
    }

    // Generate Token via Dependency Injection
    const videoRoomService = req.app.locals.videoRoomService;
    const networkCredentials = await videoRoomService.generateNetworkToken();

    res.status(200).json({
      success: true,
      data: networkCredentials
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getVideoToken
};
