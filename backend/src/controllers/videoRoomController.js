/**
 * @file videoRoomController.js
 * @description Express route handler for WebRTC video room token provisioning.
 * Enforces participant authorization and a 5-minute pre-session time-lock before
 * issuing Twilio ICE/STUN/TURN credentials via the injected `videoRoomService`.
 *
 * Inputs and outputs:
 *   - Exports: `{ getVideoToken }`.
 *
 * Side effects:
 *   - Reads the `Booking` MongoDB collection.
 *   - Calls `videoRoomService.generateNetworkToken()` (Twilio Network Traversal Service API).
 *
 * Dependencies:
 *   - `../models/Booking` — Mongoose Booking model.
 *   - `app.locals.videoRoomService` — Injected via DI in `app.js`; can be overridden
 *     with a test stub in `e2e-server.js` to avoid Twilio charges during automation.
 */

const Booking = require('../models/Booking');

/**
 * Parses a booking's date and slot time into a `Date` object anchored to IST (+05:30).
 * The explicit `+05:30` offset prevents the JavaScript runtime's local timezone from
 * shifting the resulting timestamp, which would break the time-lock calculation.
 *
 * @param {string} bookingDate - Date string in `YYYY-MM-DD` format.
 * @param {string} slotTime - Time string in `HH:MM` (24-hour) format.
 * @returns {Date|null} Parsed `Date` object, or `null` if either input is invalid.
 */
const parseISTSessionTime = (bookingDate, slotTime) => {
  const session = new Date(`${bookingDate}T${slotTime}:00+05:30`);
  return Number.isNaN(session.getTime()) ? null : session;
};

/**
 * Issues Twilio ICE/STUN/TURN network credentials for a WebRTC peer-to-peer video session.
 * Enforces two access guards: (1) only the booking's client or expert may call this endpoint;
 * (2) the current time must be within 5 minutes of or past the scheduled session start time
 * (parsed in IST) to prevent early token issuance. The `videoRoomService` is resolved from
 * `req.app.locals` to support test stubs via dependency injection.
 * This function is async. It awaits `Booking.findById` and `videoRoomService.generateNetworkToken`.
 *
 * @async
 * @param {import('express').Request} req - Express request. `req.params.id` is the booking ID;
 *   `req.user._id` is set by `authMiddleware.protect`.
 * @param {import('express').Response} res - Express response. Returns 200 `{ success, data }` with ICE servers.
 * @param {import('express').NextFunction} next - Forwards unexpected errors to the global error handler.
 * @returns {Promise<void>}
 * @throws {403} If the user is not a participant, or if the session start is more than 5 minutes away.
 * @throws {404} If the booking does not exist.
 * @throws {500} If `bookingDate` / `slotTime` form an unparseable date string.
 * @route GET /api/v1/bookings/:id/video-token
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
