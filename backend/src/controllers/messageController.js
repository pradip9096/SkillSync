const Message = require('../models/Message');
const Booking = require('../models/Booking');

/**
 * Fetch all messages for a specific booking.
 * Secures access to only the client or expert involved in the booking.
 */
exports.getMessagesByBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    
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

    const messages = await Message.find({ bookingId }).sort({ createdAt: 1 });
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
      // Emit to a specific booking room for the active chat UI
      io.to(`booking_${bookingId}`).emit('new_message', message);
      // Emit to the receiver's global room for unread badge increment
      io.to(`user_${receiverId}`).emit('new_message', message);
    }

    try {
      const Notification = require('../models/Notification');
      const notif = await Notification.create({
        user: receiverId,
        type: 'MESSAGE',
        title: 'New Message',
        message: 'You have a new message regarding a session.'
      });
      if (io) io.to(`user_${receiverId}`).emit('new_notification', notif);
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

    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [{ sender: userId }, { receiver: userId }]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ["$sender", userId] },
              "$receiver",
              "$sender"
            ]
          },
          lastMessage: { $first: "$$ROOT" },
          bookingId: { $first: "$bookingId" }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "otherUser"
        }
      },
      {
        $unwind: "$otherUser"
      },
      {
        $project: {
          "otherUser.password": 0
        }
      }
    ]);

    // Format to match existing frontend expectations
    const formatted = conversations.map(conv => ({
      _id: conv.bookingId,
      otherUser: conv.otherUser,
      lastMessage: conv.lastMessage
    }));

    res.status(200).json(formatted);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};
