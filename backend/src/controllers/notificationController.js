const Notification = require('../models/Notification');

/**
 * Get all notifications for the authenticated user.
 */
exports.getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.status(200).json(notifications);
  } catch (error) {
    return next(error);
  }
};

/**
 * Mark a specific notification as read.
 */
exports.markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findOneAndUpdate(
      { _id: id, user: req.user._id },
      { $set: { read: true } },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.status(200).json(notification);
  } catch (error) {
    return next(error);
  }
};

/**
 * Mark all notifications as read for the authenticated user.
 */
exports.markAllAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, read: false },
      { $set: { read: true } }
    );
    res.status(200).json({ message: 'All notifications marked as read' });
  } catch (error) {
    return next(error);
  }
};

/**
 * Get total unread notification count for the current user.
 */
exports.getUnreadCount = async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({ user: req.user._id, read: false });
    res.status(200).json({ count });
  } catch (error) {
    return next(error);
  }
};
