/**
 * Purpose: Mongoose schema and model for verified payment logs.
 * Inputs: None.
 * Outputs: Mongoose model for the 'PaymentLog' collection.
 * Side Effects: Defines a unique index on razorpayPaymentId to prevent double-logging.
 */

const mongoose = require('mongoose');

const paymentLogSchema = new mongoose.Schema({
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  razorpayOrderId: {
    type: String,
    required: true
  },
  razorpayPaymentId: {
    type: String,
    required: true,
    unique: true
  },
  amount: {
    type: Number,
    required: true // in paise
  },
  currency: {
    type: String,
    required: true,
    default: 'INR'
  },
  status: {
    type: String,
    enum: ['captured', 'failed', 'refunded'],
    default: 'captured'
  },
  signature: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('PaymentLog', paymentLogSchema);
