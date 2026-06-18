/**
 * @file Message.js
 * @description Mongoose model for in-session chat messages between a client and an expert.
 * Messages are scoped to a booking but the history query in `messageController` spans
 * all bookings for the same client–expert pair to provide a unified chat thread.
 *
 * Inputs and outputs:
 *   - Exports: the `Message` Mongoose model.
 *
 * Dependencies:
 *   - `mongoose` — MongoDB ODM.
 */

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    /** Reference to the booking session this message belongs to; indexed for fast chat history queries. */
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true,
    },
    /** User who sent the message. */
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    /** User who should receive the message (used to filter unread counts). */
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    /** Sanitized plain-text content (HTML stripped by `sanitize-html` before save). */
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    /** Whether the receiver has read this message; used for unread badge counts. */
    read: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index to quickly fetch unread messages for a specific user
messageSchema.index({ receiver: 1, read: 1 });
// Index to quickly sort messages within a booking thread
messageSchema.index({ bookingId: 1, createdAt: 1 });
// Index to quickly fetch conversations between two users
messageSchema.index({ sender: 1, receiver: 1 });

module.exports = mongoose.model('Message', messageSchema);
