/**
 * Purpose: Defines the API endpoints for booking-related operations, mapping HTTP methods and paths to controller functions.
 * Inputs: Express router and booking controller handlers.
 * Outputs: Configured Express router object.
 * Side Effects: Registers routes with the Express application.
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { 
  createBooking, 
  getBookingsByEmail, 
  updateBookingStatus,
  getBookedSlots,
  markAsRated
} = require('../controllers/bookingController');
const { protect } = require('../middleware/authMiddleware');
const { validateParams } = require('../middleware/validationMiddleware');

const bookingRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Limit each IP to 5 booking attempts per minute
  message: { success: false, error: 'Too many booking attempts. Please try again after a minute.' }
});

/**
 * Route: POST /
 * Purpose: Create a new session booking.
 * Access: Private (Requires authentication).
 */
router.post('/', protect, bookingRateLimiter, createBooking);

/**
 * Route: GET /
 * Purpose: Retrieve bookings for a specific user via email query parameter.
 * Access: Private (Requires authentication).
 */
router.get('/', protect, getBookingsByEmail);

/**
 * Route: PATCH /:id/status
 * Purpose: Update the status of a specific booking (e.g., Confirmed to Completed).
 * Access: Private (Requires authentication).
 */
router.patch('/:id/status', protect, validateParams(['id']), updateBookingStatus);

/**
 * Route: PATCH /:id/rate
 * Purpose: Mark a booking as rated to prevent multiple ratings for the same session.
 * Access: Private (Requires authentication).
 */
router.patch('/:id/rate', protect, validateParams(['id']), markAsRated);

/**
 * Route: GET /booked-slots/:expertId/:date
 * Purpose: Fetch all booked time slots for a specific expert on a given date.
 * Access: Public.
 */
router.get('/booked-slots/:expertId/:date', validateParams(['expertId']), getBookedSlots);

module.exports = router;
