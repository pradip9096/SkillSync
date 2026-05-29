const Message = require('../models/Message');
const Booking = require('../models/Booking');
const mongoose = require('mongoose');

/**
 * Fetch all messages for a specific booking.
 * Secures access to only the client or expert involved in the booking.
 */
exports.getMessagesByBooking = async (req, res) => {
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

    const query = { bookingId };
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
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

/**
 * Send a new message.
 * Emits a real-time event if socket is available.
 */
exports.sendMessage = async (req, res) => {
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

    const message = await Message.create({
      bookingId,
      sender: req.user._id,
      receiver: receiverId,
      content
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
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

/**
 * Mark all messages in a booking as read for the current user.
 */
exports.markMessagesAsRead = async (req, res) => {
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

    await Message.updateMany(
      { bookingId, receiver: req.user._id, read: false },
      { $set: { read: true } }
    );

    res.status(200).json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

/**
 * Get total unread message count for the current user.
 */
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Message.countDocuments({ receiver: req.user._id, read: false });
    res.status(200).json({ count });
  } catch (error) {
    console.error('Error fetching unread message count:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

/**
 * Fetch unique conversations for the current user, grouped by the other participant.
 */
exports.getUniqueConversations = async (req, res) => {
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

    // 2. Format the conversations array and optimize Message fetch
    const formatted = [];
    const bookingIds = bookings.map(b => b._id);
    
    const lastMessagesAgg = await Message.aggregate([
      { $match: { bookingId: { $in: bookingIds } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: '$bookingId', lastMessage: { $first: '$$ROOT' } } }
    ]);
    const lastMessageMap = new Map(lastMessagesAgg.map(item => [item._id.toString(), item.lastMessage]));

    for (const booking of bookings) {
      let otherUser = null;
      if (req.user.role === 'Expert') {
        otherUser = booking.user;
      } else {
        otherUser = booking.expert ? booking.expert.user : null;
      }

      if (!otherUser) continue;

      const lastMessage = lastMessageMap.get(booking._id.toString()) || null;

      formatted.push({
        _id: booking._id,
        otherUser: {
          _id: otherUser._id,
          name: otherUser.name || booking.userName, // Fallback for clients
          email: otherUser.email
        },
        lastMessage: lastMessage
      });
    }

    res.status(200).json(formatted);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};
