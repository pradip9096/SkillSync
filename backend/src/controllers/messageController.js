/**
 * @file messageController.js
 * @description Express route handler functions for the in-session messaging feature.
 * Handles message retrieval (with cursor-based pagination), message sending with HTML
 * sanitization, bulk read-status updates, unread count, and unique conversation listing.
 *
 * Inputs and outputs:
 *   - All handlers are exported as properties of `module.exports` and receive `(req, res, next)`.
 *   - Exports: `{ getMessagesByBooking, sendMessage, markMessagesAsRead, getUnreadCount,
 *     getUniqueConversations }`.
 *
 * Side effects:
 *   - Reads and writes the `Message`, `Booking`, and `Notification` MongoDB collections.
 *   - `sendMessage` emits `new_message` to the booking room and the receiver's global room,
 *     and emits `new_notification` to the receiver's global room via Socket.io.
 *   - HTML content is stripped by `sanitize-html` before persistence to prevent stored XSS.
 *
 * Dependencies:
 *   - `mongoose` — ObjectId validation.
 *   - `sanitize-html` — XSS prevention: strips all HTML tags from message content.
 *   - `../models/Message` — Mongoose Message model.
 *   - `../models/Booking` — Mongoose Booking model (used for authorization checks).
 *   - `../models/Notification` — Lazily required inside `sendMessage`.
 */

const Message = require('../models/Message');
const Booking = require('../models/Booking');
const mongoose = require('mongoose');
const sanitizeHtml = require('sanitize-html');

/**
 * Returns paginated message history for a booking, scoped to all sessions between the
 * same client–expert pair (not just the single booking). Uses cursor-based pagination
 * via `before` (a message `_id`) to support infinite-scroll chat UIs.
 * This function is async. It awaits `Booking.findById`, `Booking.find`, and `Message.find`.
 *
 * @async
 * @param {import('express').Request} req - Express request. `req.params.bookingId` is the booking ID;
 *   optional query: `before` (cursor `_id`), `limit` (default 50).
 * @param {import('express').Response} res - Express response. Returns 200 with a chronological message array.
 * @param {import('express').NextFunction} next - Forwards unexpected errors to the global error handler.
 * @returns {Promise<void>}
 * @throws {403} If the authenticated user is not the client or expert for this booking.
 * @throws {404} If the booking does not exist.
 * @route GET /messages/:bookingId
 */
exports.getMessagesByBooking = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const { before, limit = 50 } = req.query;
    
    // Fetch booking to verify participation
    const booking = await Booking.findById(bookingId).populate('expert');
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const isClient = booking.user && booking.user.toString() === req.user._id.toString();
    const isExpert = booking.expert && booking.expert.user && booking.expert.user.toString() === req.user._id.toString();

    if (!isClient && !isExpert) {
      return res.status(403).json({ message: 'Not authorized to view these messages' });
    }

    // Unify message history by querying messages across all bookings for this client-expert pair
    const clientUserId = booking.user;
    const expertId = booking.expert._id;

    let query = {};
    if (clientUserId) {
      const peerBookings = await Booking.find({
        user: clientUserId,
        expert: expertId
      });
      const peerBookingIds = peerBookings.map(b => b._id);
      query = { bookingId: { $in: peerBookingIds } };
    } else {
      query = { bookingId };
    }

    if (before) {
      query._id = { $lt: before };
    }

    const messages = await Message.find(query)
      .sort({ _id: -1 })
      .limit(parseInt(limit));

    // Reverse to chronological order for the chat UI
    messages.reverse();

    res.status(200).json(messages);
  } catch (error) {
    return next(error);
  }
};

/**
 * Creates a new message after verifying the sender is a participant in the booking.
 * Strips all HTML from `content` via `sanitize-html` before saving, then emits
 * `new_message` to the booking room and receiver's global room, and creates a
 * `Notification` document for the receiver.
 * This function is async. It awaits `Booking.findById`, `Message.create`, and
 * `Notification.create`.
 *
 * @async
 * @param {import('express').Request} req - Express request. Required body: `bookingId`, `receiverId`, `content`.
 * @param {import('express').Response} res - Express response. Returns 201 with the new message document.
 * @param {import('express').NextFunction} next - Forwards unexpected errors to the global error handler.
 * @returns {Promise<void>}
 * @throws {400} If any required field is missing, IDs are invalid, or content exceeds 5000 characters.
 * @throws {403} If the authenticated user is not a participant in the booking.
 * @throws {404} If the booking does not exist.
 * @route POST /messages
 */
exports.sendMessage = async (req, res, next) => {
  try {
    const { bookingId, receiverId, content } = req.body;

    if (!bookingId || !receiverId || !content) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (!mongoose.Types.ObjectId.isValid(bookingId) || !mongoose.Types.ObjectId.isValid(receiverId)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }

    if (content.length > 5000) {
      return res.status(400).json({ message: 'Message content exceeds 5000 characters limit' });
    }

    // Verify participation
    const booking = await Booking.findById(bookingId).populate('expert');
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const isClient = booking.user && booking.user.toString() === req.user._id.toString();
    const isExpert = booking.expert && booking.expert.user && booking.expert.user.toString() === req.user._id.toString();

    if (!isClient && !isExpert) {
      return res.status(403).json({ message: 'Not authorized to send messages for this booking' });
    }

    if (!bookingId || !receiverId || !content) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const sanitizedContent = sanitizeHtml(content, {
      allowedTags: [], // Strip all HTML tags
      allowedAttributes: {}
    });

    const message = await Message.create({
      bookingId,
      sender: req.user._id,
      receiver: receiverId,
      content: sanitizedContent
    });

    // Real-time broadcast
    const io = req.app.get('io');
    if (io) {
      const messagePayload = message.toJSON();
      // Emit to a specific booking room for the active chat UI
      io.to(`booking_${bookingId}`).emit('new_message', messagePayload);
      // Emit to the receiver's global room for unread badge increment
      io.to(`user_${receiverId}`).emit('new_message', messagePayload);
    }

    try {
      const Notification = require('../models/Notification');
      const notif = await Notification.create({
        user: receiverId,
        type: 'MESSAGE',
        title: 'New Message',
        message: 'You have a new message regarding a session.'
      });
      if (io) io.to(`user_${receiverId}`).emit('new_notification', notif.toJSON());
    } catch (err) {
      console.error('Error creating message notification:', err);
    }

    res.status(201).json(message);
  } catch (error) {
    return next(error);
  }
};

/**
 * Bulk-marks all unread messages addressed to the authenticated user across the entire
 * client–expert session history (not just the single booking) as `read: true`.
 * This function is async. It awaits `Booking.findById`, `Booking.find`, and `Message.updateMany`.
 *
 * @async
 * @param {import('express').Request} req - Express request. `req.params.bookingId` is the booking ID.
 * @param {import('express').Response} res - Express response. Returns 200 `{ message: 'Messages marked as read' }`.
 * @param {import('express').NextFunction} next - Forwards unexpected errors to the global error handler.
 * @returns {Promise<void>}
 * @throws {403} If the authenticated user is not a participant in the booking.
 * @throws {404} If the booking does not exist.
 * @route PATCH /messages/:bookingId/read
 */
exports.markMessagesAsRead = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    
    // Verify participation
    const booking = await Booking.findById(bookingId).populate('expert');
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const isClient = booking.user && booking.user.toString() === req.user._id.toString();
    const isExpert = booking.expert && booking.expert.user && booking.expert.user.toString() === req.user._id.toString();

    if (!isClient && !isExpert) {
      return res.status(403).json({ message: 'Not authorized to modify messages for this booking' });
    }

    const clientUserId = booking.user;
    const expertId = booking.expert._id;

    let peerBookingIds = [bookingId];
    if (clientUserId) {
      const peerBookings = await Booking.find({
        user: clientUserId,
        expert: expertId
      });
      peerBookingIds = peerBookings.map(b => b._id);
    }

    await Message.updateMany(
      { bookingId: { $in: peerBookingIds }, receiver: req.user._id, read: false },
      { $set: { read: true } }
    );

    res.status(200).json({ message: 'Messages marked as read' });
  } catch (error) {
    return next(error);
  }
};

/**
 * Returns the total number of unread messages addressed to the authenticated user.
 * Used by the frontend to render the unread badge in the navbar.
 * This function is async. It awaits `Message.countDocuments`.
 *
 * @async
 * @param {import('express').Request} req - Express request. `req.user._id` from `authMiddleware.protect`.
 * @param {import('express').Response} res - Express response. Returns 200 `{ count }`.
 * @param {import('express').NextFunction} next - Forwards unexpected errors to the global error handler.
 * @returns {Promise<void>}
 * @route GET /messages/unread/count
 */
exports.getUnreadCount = async (req, res, next) => {
  try {
    const count = await Message.countDocuments({ receiver: req.user._id, read: false });
    res.status(200).json({ count });
  } catch (error) {
    return next(error);
  }
};

/**
 * Returns a deduplicated list of conversations for the authenticated user, one entry per
 * unique counterpart (client or expert), ordered by most recent activity. Uses a MongoDB
 * aggregation on the Message collection to find the last message per booking, then merges
 * with booking data for participant info.
 * This function is async. It awaits `Expert.findOne`, `Booking.find`, and `Message.aggregate`.
 *
 * @async
 * @param {import('express').Request} req - Express request. `req.user` (with `role`) from `authMiddleware.protect`.
 * @param {import('express').Response} res - Express response. Returns 200 with a sorted conversation array.
 * @param {import('express').NextFunction} next - Forwards unexpected errors to the global error handler.
 * @returns {Promise<void>}
 * @route GET /messages/conversations
 */
exports.getUniqueConversations = async (req, res, next) => {
  try {
    const userId = req.user._id;
    let bookings = [];

    // 1. Fetch bookings based on user role
    if (req.user.role === 'Expert') {
      const Expert = require('../models/Expert');
      const expertProfile = await Expert.findOne({ user: userId });
      if (expertProfile) {
        bookings = await Booking.find({ expert: expertProfile._id })
          .populate('user', 'name email _id')
          .sort({ createdAt: -1 });
      }
    } else {
      bookings = await Booking.find({ user: userId })
        .populate({
          path: 'expert',
          populate: { path: 'user', select: 'name email _id' }
        })
        .sort({ createdAt: -1 });
    }

    // 2. Format and group by participant to eliminate duplicates
    const bookingIds = bookings.map(b => b._id);
    
    const lastMessagesAgg = await Message.aggregate([
      { $match: { bookingId: { $in: bookingIds } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: '$bookingId', lastMessage: { $first: '$$ROOT' } } }
    ]);
    const lastMessageMap = new Map(lastMessagesAgg.map(item => [item._id.toString(), item.lastMessage]));

    const conversationsMap = new Map();

    for (const booking of bookings) {
      let otherUser = null;
      if (req.user.role === 'Expert') {
        otherUser = booking.user;
      } else {
        otherUser = booking.expert ? booking.expert.user : null;
      }

      if (!otherUser) continue;

      const lastMessage = lastMessageMap.get(booking._id.toString()) || null;
      const activityDate = lastMessage ? new Date(lastMessage.createdAt) : new Date(booking.createdAt);

      const otherUserIdStr = otherUser._id.toString();
      const existing = conversationsMap.get(otherUserIdStr);

      // Keep only the conversation session with the most recent activity
      if (!existing || activityDate > existing.activityDate) {
        conversationsMap.set(otherUserIdStr, {
          _id: booking._id,
          otherUser: {
            _id: otherUser._id,
            name: otherUser.name || booking.userName, // Fallback for clients
            email: otherUser.email
          },
          lastMessage: lastMessage,
          activityDate: activityDate
        });
      }
    }

    // Convert map values to array, sort by activityDate descending, and remove activityDate property
    const sortedConversations = Array.from(conversationsMap.values())
      .sort((a, b) => b.activityDate - a.activityDate)
      .map(item => {
        const { activityDate, ...rest } = item;
        return rest;
      });

    res.status(200).json(sortedConversations);
  } catch (error) {
    return next(error);
  }
};
