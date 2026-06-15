const bookingService = require('../services/BookingService');

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

const getBookedSlots = async (req, res, next) => {
  try {
    const { expertId, date } = req.params;
    const result = await bookingService.getBookedSlots({ expertId, date });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

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
