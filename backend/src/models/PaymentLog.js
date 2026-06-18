/**
 * @file PaymentLog.js
 * @description Mongoose schema and model for Razorpay payment audit records. Each
 * document captures a single payment event (capture, failure, or refund) tied to a
 * booking. The unique index on `razorpayPaymentId` is the idempotency guard in
 * `BookingService.confirmBookingPayment` — a duplicate payment ID causes a unique-key
 * error which the service interprets as a replay and returns the existing booking
 * instead of re-processing.
 *
 * Inputs and outputs:
 *   - Exports: the `PaymentLog` Mongoose model.
 *
 * Side effects:
 *   - Defines a unique index on `razorpayPaymentId` in MongoDB.
 */

const mongoose = require('mongoose');

const paymentLogSchema = new mongoose.Schema({
  /** The booking this payment is associated with. Indexed for fast per-booking lookups. */
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    index: true
  },
  /** The user who made the payment. */
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  /** Razorpay Order ID (e.g. `order_XXXXXX`). Links payment to the original order. */
  razorpayOrderId: {
    type: String,
    required: true
  },
  /** Razorpay Payment ID (e.g. `pay_XXXXXX`). Unique — used as an idempotency key. */
  razorpayPaymentId: {
    type: String,
    required: true,
    unique: true
  },
  /** Payment amount in paise (1 INR = 100 paise). */
  amount: {
    type: Number,
    required: true // in paise
  },
  /** ISO 4217 currency code. Always `INR` for this platform. */
  currency: {
    type: String,
    required: true,
    default: 'INR'
  },
  /** Current lifecycle status of this payment record. */
  status: {
    type: String,
    enum: ['captured', 'failed', 'refunded'],
    default: 'captured'
  },
  /** HMAC-SHA256 signature provided by the Razorpay client, stored for audit purposes. */
  signature: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('PaymentLog', paymentLogSchema);
