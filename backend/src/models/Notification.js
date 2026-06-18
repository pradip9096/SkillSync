/**
 * @file Notification.js
 * @description Mongoose model for user-facing in-app notifications. Notifications are
 * created by service-layer code and emitted in real time via Socket.io in addition to
 * being stored for later retrieval via the notification REST API.
 *
 * Inputs and outputs:
 *   - Exports: the `Notification` Mongoose model.
 *
 * Dependencies:
 *   - `mongoose` — MongoDB ODM.
 */

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    /** Owner of the notification; indexed for fast per-user queries. */
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    /** Category of the notification, used by the frontend to render an appropriate icon. */
    type: {
      type: String,
      enum: ['SYSTEM', 'BOOKING_UPDATE', 'MESSAGE', 'STRIKE'],
      default: 'SYSTEM',
    },
    /** Short headline shown in the notification list (e.g. "Booking Confirmed"). */
    title: {
      type: String,
      required: true,
    },
    /** Full notification body text. */
    message: {
      type: String,
      required: true,
    },
    /** Whether the user has opened / acknowledged this notification. */
    read: {
      type: Boolean,
      default: false,
    },
    /** Optional deep-link URL the frontend can navigate to when the notification is clicked. */
    link: {
      type: String,
      default: null,
    }
  },
  {
    timestamps: true,
  }
);

// Index to quickly fetch unread notifications for a user
notificationSchema.index({ user: 1, read: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
