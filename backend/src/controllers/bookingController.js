const bookingService = require('../services/BookingService');

const createBooking = async (req, res) => {
  try {
    const io = req.app.get('io');
    const result = await bookingService.createBooking({
      payload: req.body,
      authUser: req.user,
      io
    });
    res.status(201).json({ success: true, ...result });
  } catch (error) {
    console.error('Error in createBooking:', error);
    res.status(error.status || (error.code === 11000 ? 400 : 500)).json({
      success: false,
      error: error.message || 'Booking creation failed.'
    });
  }
};

const getBookingsByEmail = async (req, res) => {
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
    console.error('API Error:', error);
    res.status(error.status || 500).json({ success: false, error: error.message || 'Server Error' });
  }
};

const updateBookingStatus = async (req, res) => {
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
    console.error('API Error:', error);
    res.status(error.status || 500).json({ success: false, error: error.message || 'Server Error' });
  }
};

const getBookedSlots = async (req, res) => {
  try {
    const { expertId, date } = req.params;
    const result = await bookingService.getBookedSlots({ expertId, date });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('API Error:', error);
    res.status(error.status || 500).json({ success: false, error: error.message || 'Server Error' });
  }
};

const markAsRated = async (req, res) => {
  try {
    const result = await bookingService.markAsRated({
      bookingId: req.params.id,
      authUser: req.user
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('API Error:', error);
    res.status(error.status || 500).json({ success: false, error: error.message || 'Server Error' });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const io = req.app.get('io');
    const result = await bookingService.verifyPayment({
      payload: req.body,
      authUser: req.user,
      io
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Error in verifyPayment:', error);
    res.status(error.status || 500).json({ success: false, error: error.message || 'Server Error' });
  }
};

const handleWebhook = async (req, res) => {
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
    console.error('Error processing Razorpay Webhook event:', error);
    res.status(error.status || 500).json({ success: false, error: error.message || 'Internal Server Error' });
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
