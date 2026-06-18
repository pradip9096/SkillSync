/**
 * @file ProcessedWebhook.js
 * @description Mongoose model that records successfully processed webhook events for
 * idempotency. Before processing any incoming webhook, `BookingService.handleWebhook`
 * checks this collection; if the `eventId` + `provider` pair already exists, the
 * event is silently dropped to prevent double-payment or double-confirmation bugs.
 * Documents auto-expire after 30 days via a MongoDB TTL index on `createdAt`.
 *
 * Inputs and outputs:
 *   - Exports: the `ProcessedWebhook` Mongoose model.
 *
 * Dependencies:
 *   - `mongoose` — MongoDB ODM.
 */

const mongoose = require('mongoose');

const processedWebhookSchema = new mongoose.Schema({
  /** Unique identifier for the event from the payment provider (e.g. Razorpay payment ID). */
  eventId: {
    type: String,
    required: true
  },
  /** Payment provider name (e.g. `'razorpay'`); combined with `eventId` in a unique index. */
  provider: {
    type: String,
    required: true
  },
  /** Timestamp used by the MongoDB TTL index to auto-delete records after 30 days. */
  createdAt: {
    type: Date,
    default: Date.now,
    expires: '30d'
  }
});

processedWebhookSchema.index({ eventId: 1, provider: 1 }, { unique: true });

module.exports = mongoose.model('ProcessedWebhook', processedWebhookSchema);
