/**
 * @file notificationController.js
 * @description Express route handler functions for the in-app notification system.
 * Provides retrieval, read-state management, and unread count for user notifications.
 *
 * Inputs and outputs:
 *   - All handlers are exported as properties of `module.exports` and receive `(req, res, next)`.
 *   - Exports: `{ getNotifications, markAsRead, markAllAsRead, getUnreadCount }`.
 *
 * Side effects:
 *   - Reads and writes the `Notification` MongoDB collection.
 *
 * Dependencies:
 *   - `../models/Notification` — Mongoose Notification model.
 */

const Notification = require('../models/Notification');

/**
 * Returns up to 50 notifications for the authenticated user, sorted newest first.
 * This function is async. It awaits `Notification.find`.
 *
 * @async
 * @param {import('express').Request} req - Express request. `req.user._id` from `authMiddleware.protect`.
 * @param {import('express').Response} res - Express response. Returns 200 with a notification array.
 * @param {import('express').NextFunction} next - Forwards unexpected errors to the global error handler.
 * @returns {Promise<void>}
 * @route GET /notifications
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
 * Sets `read: true` on a single notification. Uses `findOneAndUpdate` with a combined
 * `_id + user` filter to prevent users from marking another user's notifications as read.
 * This function is async. It awaits `Notification.findOneAndUpdate`.
 *
 * @async
 * @param {import('express').Request} req - Express request. `req.params.id` is the notification ID.
 * @param {import('express').Response} res - Express response. Returns 200 with the updated notification.
 * @param {import('express').NextFunction} next - Forwards unexpected errors to the global error handler.
 * @returns {Promise<void>}
 * @throws {404} If the notification does not exist or does not belong to the authenticated user.
 * @route PATCH /notifications/:id/read
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
 * Bulk-marks all unread notifications belonging to the authenticated user as `read: true`.
 * This function is async. It awaits `Notification.updateMany`.
 *
 * @async
 * @param {import('express').Request} req - Express request. `req.user._id` from `authMiddleware.protect`.
 * @param {import('express').Response} res - Express response. Returns 200 `{ message: 'All notifications marked as read' }`.
 * @param {import('express').NextFunction} next - Forwards unexpected errors to the global error handler.
 * @returns {Promise<void>}
 * @route PATCH /notifications/read-all
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
 * Returns the count of unread notifications for the authenticated user.
 * Used by the frontend notification bell badge.
 * This function is async. It awaits `Notification.countDocuments`.
 *
 * @async
 * @param {import('express').Request} req - Express request. `req.user._id` from `authMiddleware.protect`.
 * @param {import('express').Response} res - Express response. Returns 200 `{ count }`.
 * @param {import('express').NextFunction} next - Forwards unexpected errors to the global error handler.
 * @returns {Promise<void>}
 * @route GET /notifications/unread/count
 */
exports.getUnreadCount = async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({ user: req.user._id, read: false });
    res.status(200).json({ count });
  } catch (error) {
    return next(error);
  }
};
