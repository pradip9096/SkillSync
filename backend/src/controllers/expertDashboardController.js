/**
 * @file expertDashboardController.js
 * @description Express route handler functions for the authenticated expert dashboard.
 * All handlers are thin delegators to `ExpertService` — they extract request data,
 * call the service, and map the result to an HTTP response.
 *
 * Inputs and outputs:
 *   - All handlers receive `(req, res, next)` and write a JSON response.
 *   - Exports: `{ getExpertBookings, getExpertProfile, updateExpertProfile, blockSlot,
 *     unblockSlot, uploadGalleryImage, deleteGalleryImage, rateClient, getExpertAnalytics }`.
 *
 * Side effects:
 *   - `blockSlot` / `unblockSlot` pass the Socket.io instance so the service can emit
 *     `slot_blocked` / `slot_released` events in real time.
 *   - All database mutations are owned by ExpertService; this layer has none.
 *
 * Dependencies:
 *   - `../services/ExpertService` — Singleton service instance for expert business logic.
 */

const expertService = require('../services/ExpertService');

/**
 * Returns a paginated list of bookings assigned to the authenticated expert.
 * This function is async. It awaits `expertService.getExpertBookings`.
 *
 * @async
 * @param {import('express').Request} req - Express request. Query params: `page`, `limit`.
 *   `req.user` is set by `authMiddleware.protect`.
 * @param {import('express').Response} res - Express response. Returns 200 `{ success, ...result }`.
 * @param {import('express').NextFunction} next - Unused; errors are caught and sent directly.
 * @returns {Promise<void>}
 * @route GET /expert-dashboard/bookings
 */
const getExpertBookings = async (req, res, next) => {
  try {
    const result = await expertService.getExpertBookings({
      authUser: req.user,
      page: req.query.page,
      limit: req.query.limit
    });
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, error: error.message || 'Server error retrieving bookings' });
  }
};

/**
 * Returns the authenticated expert's full profile document.
 * This function is async. It awaits `expertService.getExpertProfile`.
 *
 * @async
 * @param {import('express').Request} req - Express request. `req.user` is set by `authMiddleware.protect`.
 * @param {import('express').Response} res - Express response. Returns 200 `{ success, data }`.
 * @param {import('express').NextFunction} next - Unused; errors are caught and sent directly.
 * @returns {Promise<void>}
 * @route GET /expert-dashboard/profile
 */
const getExpertProfile = async (req, res, next) => {
  try {
    const expert = await expertService.getExpertProfile({ authUser: req.user });
    res.status(200).json({ success: true, data: expert });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, error: error.message || 'Server error retrieving profile' });
  }
};

/**
 * Updates the authenticated expert's profile fields (bio, hourlyRate, experience, etc.).
 * This function is async. It awaits `expertService.updateExpertProfile`.
 *
 * @async
 * @param {import('express').Request} req - Express request. Body contains the fields to update.
 * @param {import('express').Response} res - Express response. Returns 200 `{ success, data }`.
 * @param {import('express').NextFunction} next - Unused; errors are caught and sent directly.
 * @returns {Promise<void>}
 * @route PATCH /expert-dashboard/profile
 */
const updateExpertProfile = async (req, res, next) => {
  try {
    const updatedExpert = await expertService.updateExpertProfile({ authUser: req.user, payload: req.body });
    res.status(200).json({ success: true, data: updatedExpert });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, error: error.message || 'Server error updating profile' });
  }
};

/**
 * Blocks a specific time slot so clients cannot book it. Passes the Socket.io instance
 * so the service can emit a real-time event.
 * This function is async. It awaits `expertService.blockSlot`.
 *
 * @async
 * @param {import('express').Request} req - Express request. Body requires `bookingDate` (YYYY-MM-DD)
 *   and `slotTime` (HH:MM).
 * @param {import('express').Response} res - Express response. Returns 201 `{ success, data }`.
 * @param {import('express').NextFunction} next - Unused; errors are caught and sent directly.
 * @returns {Promise<void>}
 * @route POST /expert-dashboard/slots/block
 */
const blockSlot = async (req, res, next) => {
  try {
    const io = req.app.get('io');
    const block = await expertService.blockSlot({ authUser: req.user, payload: req.body, io });
    res.status(201).json({ success: true, data: block });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, error: error.message || 'Server error blocking slot' });
  }
};

/**
 * Removes a previously blocked time slot, making it bookable again.
 * This function is async. It awaits `expertService.unblockSlot`.
 *
 * @async
 * @param {import('express').Request} req - Express request. Body requires `bookingDate` and `slotTime`.
 * @param {import('express').Response} res - Express response. Returns 200 `{ success, ...result }`.
 * @param {import('express').NextFunction} next - Unused; errors are caught and sent directly.
 * @returns {Promise<void>}
 * @route DELETE /expert-dashboard/slots/block
 */
const unblockSlot = async (req, res, next) => {
  try {
    const io = req.app.get('io');
    const result = await expertService.unblockSlot({ authUser: req.user, payload: req.body, io });
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, error: error.message || 'Server error unblocking slot' });
  }
};

/**
 * Adds a Multer-processed image to the expert's gallery array (max 5 images).
 * This function is async. It awaits `expertService.uploadGalleryImage`.
 *
 * @async
 * @param {import('express').Request} req - Express request. `req.file` is set by the Multer upload middleware.
 * @param {import('express').Response} res - Express response. Returns 200 `{ success, gallery }`.
 * @param {import('express').NextFunction} next - Unused; errors are caught and sent directly.
 * @returns {Promise<void>}
 * @route POST /expert-dashboard/gallery
 */
const uploadGalleryImage = async (req, res, next) => {
  try {
    const gallery = await expertService.uploadGalleryImage({ authUser: req.user, file: req.file });
    res.status(200).json({ success: true, gallery });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, error: error.message || 'Server error uploading gallery image' });
  }
};

/**
 * Removes an image from the expert's gallery array and deletes the file from disk.
 * This function is async. It awaits `expertService.deleteGalleryImage`.
 *
 * @async
 * @param {import('express').Request} req - Express request. `req.params.filename` is the image filename to delete.
 * @param {import('express').Response} res - Express response. Returns 200 `{ success, gallery }`.
 * @param {import('express').NextFunction} next - Unused; errors are caught and sent directly.
 * @returns {Promise<void>}
 * @route DELETE /expert-dashboard/gallery/:filename
 */
const deleteGalleryImage = async (req, res, next) => {
  try {
    const gallery = await expertService.deleteGalleryImage({ authUser: req.user, filename: req.params.filename });
    res.status(200).json({ success: true, gallery });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, error: error.message || 'Server error deleting gallery image' });
  }
};

/**
 * Submits a post-session rating for a client (only available to experts on completed bookings).
 * This function is async. It awaits `expertService.rateClient`.
 *
 * @async
 * @param {import('express').Request} req - Express request. `req.params.id` is the booking ID;
 *   body requires `rating` (1–5).
 * @param {import('express').Response} res - Express response. Returns 200 `{ success, data, review }`.
 * @param {import('express').NextFunction} next - Unused; errors are caught and sent directly.
 * @returns {Promise<void>}
 * @route POST /expert-dashboard/bookings/:id/rate-client
 */
const rateClient = async (req, res, next) => {
  try {
    const result = await expertService.rateClient({ authUser: req.user, bookingId: req.params.id, payload: req.body });
    res.status(200).json({ success: true, data: result.clientUser, review: result.review });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, error: error.message || 'Server error rating client' });
  }
};

/**
 * Returns aggregate analytics for the authenticated expert's dashboard
 * (total bookings, revenue, upcoming sessions, recent reviews, etc.).
 * This function is async. It awaits `expertService.getExpertAnalytics`.
 *
 * @async
 * @param {import('express').Request} req - Express request. `req.user` is set by `authMiddleware.protect`.
 * @param {import('express').Response} res - Express response. Returns 200 `{ success, analytics }`.
 * @param {import('express').NextFunction} next - Unused; errors are caught and sent directly.
 * @returns {Promise<void>}
 * @route GET /expert-dashboard/analytics
 */
const getExpertAnalytics = async (req, res, next) => {
  try {
    const analytics = await expertService.getExpertAnalytics({ authUser: req.user });
    res.status(200).json({ success: true, analytics });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, error: error.message || 'Server error retrieving analytics data' });
  }
};

module.exports = {
  getExpertBookings,
  getExpertProfile,
  updateExpertProfile,
  blockSlot,
  unblockSlot,
  uploadGalleryImage,
  deleteGalleryImage,
  rateClient,
  getExpertAnalytics
};
