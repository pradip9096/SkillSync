/**
 * Purpose: Defines the API endpoints for booking-related operations, mapping HTTP methods and paths to controller functions.
 * Inputs: Express router and booking controller handlers.
 * Outputs: Configured Express router object.
 * Side Effects: Registers routes with the Express application.
 */

const express = require('express');
const router = express.Router();
const { 
  createBooking, 
  getBookingsByEmail, 
  updateBookingStatus,
  getBookedSlots,
  markAsRated
} = require('../controllers/bookingController');
const { protect } = require('../middleware/authMiddleware');

/**
 * Route: POST /
 * Purpose: Create a new session booking.
 * Access: Private (Requires authentication).
 */
router.post('/', protect, createBooking);

/**
 * Route: GET /
 * Purpose: Retrieve bookings for a specific user via email query parameter.
 * Access: Public.
 */
router.get('/', getBookingsByEmail);

/**
 * Route: PATCH /:id/status
 * Purpose: Update the status of a specific booking (e.g., Confirmed to Completed).
 * Access: Public.
 */
router.patch('/:id/status', updateBookingStatus);

/**
 * Route: PATCH /:id/rate
 * Purpose: Mark a booking as rated to prevent multiple ratings for the same session.
 * Access: Public.
 */
router.patch('/:id/rate', markAsRated);

/**
 * Route: GET /booked-slots/:expertId/:date
 * Purpose: Fetch all booked time slots for a specific expert on a given date.
 * Access: Public.
 */
router.get('/booked-slots/:expertId/:date', getBookedSlots);

module.exports = router;
