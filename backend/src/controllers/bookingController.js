/**
 * @file bookingController.js
 * @description Thin Express route handler functions for the session booking domain. Each handler
 * delegates all business logic to `BookingService` and maps the result to an HTTP response.
 *
 * Inputs and outputs:
 *   - All handlers receive `(req, res, next)` from Express and write a JSON response.
 *   - Exports: `{ createBooking, getBookingsByEmail, updateBookingStatus, getBookedSlots,
 *     markAsRated, verifyPayment, handleWebhook }`.
 *
 * Side effects:
 *   - Reads the Socket.io instance from `req.app.get('io')` and passes it to BookingService
 *     so real-time `slot_booked` / `slot_released` events are emitted from the service layer.
 *   - All database mutations are owned by BookingService; this layer has none.
 *
 * Dependencies:
 *   - `../services/BookingService` — Singleton service instance owning booking business logic.
 */

const bookingService = require('../services/BookingService');

/**
 * Creates a new booking and initiates the Razorpay payment order.
 * This function is async. It awaits `bookingService.createBooking`.
 *
 * @async
 * @param {import('express').Request} req - Express request. Body is the booking payload;
 *   `req.user` is set by `authMiddleware.protect`.
 * @param {import('express').Response} res - Express response. Returns 201 `{ success, ...result }`
 *   including `orderId` and `amount` for the client-side Razorpay checkout.
 * @param {import('express').NextFunction} next - Forwards errors to the global error handler.
 * @returns {Promise<void>}
 * @route POST /bookings
 */
const createBooking = async (req, res, next) => {
  try {
    const io = req.app.get('io');
    const result = await bookingService.createBooking({
      payload: req.body,
      authUser: req.user,
      io
    });
    res.status(201).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

/**
 * Returns a paginated list of bookings for a given email address.
 * Authorization is enforced in BookingService (users may only query their own bookings
 * unless they are an Admin).
 * This function is async. It awaits `bookingService.getBookingsByEmail`.
 *
 * @async
 * @param {import('express').Request} req - Express request. Query params: `email`, `page`, `limit`.
 *   `req.user` is set by `authMiddleware.protect`.
 * @param {import('express').Response} res - Express response. Returns 200 `{ success, ...result }`.
 * @param {import('express').NextFunction} next - Forwards errors to the global error handler.
 * @returns {Promise<void>}
 * @route GET /bookings
 */
const getBookingsByEmail = async (req, res, next) => {
  try {
    const { email, page, limit } = req.query;
    const result = await bookingService.getBookingsByEmail({
      email,
      authUser: req.user,
      page,
      limit
    });
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

/**
 * Updates a booking's status (e.g. cancellation, completion). Emits real-time socket
 * events via the `io` instance when a slot is released.
 * This function is async. It awaits `bookingService.updateBookingStatus`.
 *
 * @async
 * @param {import('express').Request} req - Express request. `req.params.id` is the booking ID;
 *   `req.body.status` is the new status string.
 * @param {import('express').Response} res - Express response. Returns 200 `{ success, data }`.
 * @param {import('express').NextFunction} next - Forwards errors to the global error handler.
 * @returns {Promise<void>}
 * @route PATCH /bookings/:id/status
 */
const updateBookingStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const io = req.app.get('io');
    const result = await bookingService.updateBookingStatus({
      bookingId: req.params.id,
      status,
      authUser: req.user,
      io
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Returns all booked and blocked time slots for a given expert on a given date.
 * Used by the frontend booking calendar to render unavailable slots.
 * This function is async. It awaits `bookingService.getBookedSlots`.
 *
 * @async
 * @param {import('express').Request} req - Express request. `req.params.expertId` and `req.params.date` (YYYY-MM-DD).
 * @param {import('express').Response} res - Express response. Returns 200 `{ success, data }` with an array of slot strings.
 * @param {import('express').NextFunction} next - Forwards errors to the global error handler.
 * @returns {Promise<void>}
 * @route GET /bookings/slots/:expertId/:date
 */
const getBookedSlots = async (req, res, next) => {
  try {
    const { expertId, date } = req.params;
    const result = await bookingService.getBookedSlots({ expertId, date });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Marks a booking as having been rated by the client, preventing duplicate review submissions.
 * This function is async. It awaits `bookingService.markAsRated`.
 *
 * @async
 * @param {import('express').Request} req - Express request. `req.params.id` is the booking ID;
 *   `req.user` is set by `authMiddleware.protect`.
 * @param {import('express').Response} res - Express response. Returns 200 `{ success, data }`.
 * @param {import('express').NextFunction} next - Forwards errors to the global error handler.
 * @returns {Promise<void>}
 * @route PATCH /bookings/:id/mark-rated
 */
const markAsRated = async (req, res, next) => {
  try {
    const result = await bookingService.markAsRated({
      bookingId: req.params.id,
      authUser: req.user
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Verifies a Razorpay payment signature and confirms the booking after successful payment.
 * Emits a real-time `slot_booked` event on success.
 * This function is async. It awaits `bookingService.verifyPayment`.
 *
 * @async
 * @param {import('express').Request} req - Express request. Body contains Razorpay response fields
 *   (`razorpay_payment_id`, `razorpay_order_id`, `razorpay_signature`).
 * @param {import('express').Response} res - Express response. Returns 200 `{ success, data }` with the confirmed booking.
 * @param {import('express').NextFunction} next - Forwards errors to the global error handler.
 * @returns {Promise<void>}
 * @route POST /bookings/verify-payment
 */
const verifyPayment = async (req, res, next) => {
  try {
    const io = req.app.get('io');
    const result = await bookingService.verifyPayment({
      payload: req.body,
      authUser: req.user,
      io
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Handles inbound Razorpay webhook events (e.g. `payment.captured`, `payment.failed`).
 * Always returns HTTP 200 for known/handled events to suppress Razorpay retry storms;
 * returns 400 only for idempotency guard hits (already-processed payments).
 * This function is async. It awaits `bookingService.handleWebhook`.
 *
 * @async
 * @param {import('express').Request} req - Express request. `req.body` is the parsed Razorpay event payload;
 *   HMAC signature has already been verified by `webhookMiddleware.verifyWebhookSignature`.
 * @param {import('express').Response} res - Express response. Returns 200 or 400 JSON.
 * @param {import('express').NextFunction} next - Forwards unexpected errors to the global error handler.
 * @returns {Promise<void>}
 * @route POST /bookings/webhook
 */
const handleWebhook = async (req, res, next) => {
  try {
    const io = req.app.get('io');
    const result = await bookingService.handleWebhook({
      event: req.body.event,
      payload: req.body.payload,
      headers: req.headers,
      io
    });
    if (result.error) {
      return res.status(200).json({ success: false, error: result.error }); // Return 200 for known errors to avoid retries if we intentionally drop it, except 500
    }
    if (result.alreadyProcessed) {
      return res.status(400).json({ success: false, error: 'Payment already processed for this order' });
    }
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createBooking,
  getBookingsByEmail,
  updateBookingStatus,
  getBookedSlots,
  markAsRated,
  verifyPayment,
  handleWebhook
};
