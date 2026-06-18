/**
 * @file adminController.js
 * @description Express route handler functions for the Admin Panel. Provides privileged
 * operations restricted to users with the `Admin` role: listing all users and bookings,
 * force-updating booking status (bypassing the time-lock), deleting bookings and experts,
 * creating expert accounts, and resetting late-cancellation penalty strikes.
 *
 * Inputs and outputs:
 *   - All handlers receive `(req, res, next)` from Express and write a JSON response.
 *   - Exports: `{ getAllUsers, getAllBookings, updateBookingStatusByAdmin, deleteBookingByAdmin,
 *     createExpertByAdmin, deleteExpertByAdmin, resetUserPenalties }`.
 *
 * Side effects:
 *   - Reads and writes the `User`, `Expert`, and `Booking` MongoDB collections.
 *   - Emits `slot_released` Socket.io events when a booking is cancelled or deleted, so
 *     connected clients update slot availability without a page refresh.
 *   - Mutually-exclusive multi-document writes use `session.withTransaction()` for atomicity.
 *
 * Dependencies:
 *   - `mongoose` — MongoDB transaction sessions.
 *   - `../models/User` — Mongoose User model.
 *   - `../models/Expert` — Mongoose Expert model.
 *   - `../models/Booking` — Mongoose Booking model.
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const Expert = require('../models/Expert');
const Booking = require('../models/Booking');

/**
 * Returns a paginated list of all registered users, excluding password hashes.
 * This function is async. It awaits a paginated `User.find` and `User.countDocuments`.
 *
 * @async
 * @param {import('express').Request} req - Express request. Accepts `page` and `limit` query params.
 * @param {import('express').Response} res - Express response. Returns `{ success, count, total, pages, data }`.
 * @param {import('express').NextFunction} next - Forwards unexpected errors to the global error handler.
 * @returns {Promise<void>}
 * @route GET /admin/users
 */
const getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(Math.max(1, parseInt(limit) || 20), 100);
    const skip = (pageNum - 1) * limitNum;

    const users = await User.find({})
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await User.countDocuments({});

    res.status(200).json({
      success: true,
      count: users.length,
      total,
      pages: Math.ceil(total / limitNum),
      data: users
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Returns a paginated list of all bookings in the system, populated with client and expert details.
 * This function is async. It awaits a paginated `Booking.find` with nested populates and
 * `Booking.countDocuments`.
 *
 * @async
 * @param {import('express').Request} req - Express request. Accepts `page` and `limit` query params.
 * @param {import('express').Response} res - Express response. Returns `{ success, count, total, pages, data }`.
 * @param {import('express').NextFunction} next - Forwards unexpected errors to the global error handler.
 * @returns {Promise<void>}
 * @route GET /admin/bookings
 */
const getAllBookings = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(Math.max(1, parseInt(limit) || 20), 100);
    const skip = (pageNum - 1) * limitNum;

    const bookings = await Booking.find({})
      .populate('user', 'name email phone')
      .populate({
        path: 'expert',
        select: 'name category user',
        populate: {
          path: 'user',
          select: 'email'
        }
      })
      .sort({ bookingDate: -1, slotTime: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Booking.countDocuments({});

    res.status(200).json({
      success: true,
      count: bookings.length,
      total,
      pages: Math.ceil(total / limitNum),
      data: bookings
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Force-updates a booking's status, bypassing the normal time-lock that prevents clients
 * from cancelling within 2 hours of the session. Sets `bypassTimeLock = true` on the document
 * before saving so the Booking pre-save hook skips the time guard. Emits a `slot_released`
 * Socket.io event when transitioning to a cancelled state.
 * This function is async. It awaits `Booking.findById` and `booking.save`.
 *
 * @async
 * @param {import('express').Request} req - Express request. `req.params.id` is the booking ID;
 *   `req.body.status` must be one of: `Confirmed`, `Pending`, `Completed`, `Cancelled`, `Late Cancellation`.
 * @param {import('express').Response} res - Express response. Returns `{ success, data }` with the updated booking.
 * @param {import('express').NextFunction} next - Forwards unexpected errors to the global error handler.
 * @returns {Promise<void>}
 * @throws {400} If `status` is not a valid value.
 * @throws {404} If the booking does not exist.
 * @route PATCH /admin/bookings/:id/status
 */
const updateBookingStatusByAdmin = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['Confirmed', 'Pending', 'Completed', 'Cancelled', 'Late Cancellation'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid status: Confirmed, Pending, Completed, Cancelled, or Late Cancellation'
      });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    const oldStatus = booking.status;
    booking.status = status;
    
    // Note: Admin updates bypass the model's pre-save time checks for 'Completed' status
    booking.bypassTimeLock = true;
    await booking.save();

    // If cancelled or late cancelled, broadcast socket event so the slot is released immediately in real-time
    const isNewCancelled = ['Cancelled', 'Late Cancellation'].includes(status);
    const isOldCancelled = ['Cancelled', 'Late Cancellation'].includes(oldStatus);
    
    if (isNewCancelled && !isOldCancelled) {
      const io = req.app.get('io');
      if (io) {
        const dateStr = booking.bookingDate;
        io.to(booking.expert.toString()).emit('slot_released', {
          expertId: booking.expert.toString(),
          bookingDate: dateStr,
          slotTime: booking.slotTime,
          date: dateStr,
          slot: booking.slotTime
        });
      }
    }

    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Permanently deletes a booking document and emits a `slot_released` Socket.io event
 * so connected clients free the slot immediately without a page refresh.
 * This function is async. It awaits `Booking.findById` and `Booking.findByIdAndDelete`.
 *
 * @async
 * @param {import('express').Request} req - Express request. `req.params.id` is the booking ID.
 * @param {import('express').Response} res - Express response. Returns `{ success, message }`.
 * @param {import('express').NextFunction} next - Forwards unexpected errors to the global error handler.
 * @returns {Promise<void>}
 * @throws {404} If the booking does not exist.
 * @route DELETE /admin/bookings/:id
 */
const deleteBookingByAdmin = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    const expertId = booking.expert.toString();
    const slotTime = booking.slotTime;
    const dateStr = booking.bookingDate;

    await Booking.findByIdAndDelete(req.params.id);

    // Release slot immediately in real-time UI
    const io = req.app.get('io');
    if (io) {
      io.to(expertId).emit('slot_released', {
        expertId,
        date: dateStr,
        slot: slotTime
      });
    }

    res.status(200).json({
      success: true,
      message: 'Booking deleted and slot released successfully'
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Creates a new Expert account: atomically creates a `User` credential document
 * and an `Expert` profile document inside a single MongoDB transaction.
 * This function is async. It awaits `User.findOne`, `session.withTransaction`,
 * and the transactional `User.create` / `Expert.create` calls.
 *
 * @async
 * @param {import('express').Request} req - Express request. Required body fields:
 *   `email`, `password`, `name`, `phone` (+91 format), `category`, `experience`, `hourlyRate`.
 *   Optional: `description`.
 * @param {import('express').Response} res - Express response. Returns `{ success, data }` with the new Expert.
 * @param {import('express').NextFunction} next - Forwards unexpected errors to the global error handler.
 * @returns {Promise<void>}
 * @throws {400} If any required field is missing, phone format is invalid, hourlyRate < 100, or email already exists.
 * @route POST /admin/experts
 */
const createExpertByAdmin = async (req, res, next) => {
  try {
    const { email, password, name, phone, category, experience, hourlyRate, description } = req.body;

    // Field checks
    if (!email || !password || !name || !phone || !category || !experience || !hourlyRate) {
      return res.status(400).json({
        success: false,
        error: 'Please fill in all fields (email, password, name, phone, category, experience, hourlyRate)'
      });
    }

    // Phone format validation
    if (!/^\+91[6-9][0-9]{9}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        error: 'Phone number must be a valid 10-digit Indian mobile number starting with +91 followed by 10 digits (6-9)'
      });
    }

    // Hourly rate validation
    if (isNaN(hourlyRate) || Number(hourlyRate) < 100) {
      return res.status(400).json({
        success: false,
        error: 'Hourly rate must be at least 100 rupees'
      });
    }

    // Check if account already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        error: 'A user account already exists with this email address'
      });
    }

    // Start Transaction Session
    const session = await mongoose.startSession();
    let createdExpert = null;

    try {
      await session.withTransaction(async () => {
        // Create User credentials
        const [user] = await User.create([{
          email,
          password,
          role: 'Expert',
          name,
          phone
        }], { session });

        // Create Expert details
        const [expert] = await Expert.create([{
          name,
          category,
          experience: Number(experience),
          description: description || '',
          hourlyRate: Number(hourlyRate),
          user: user._id
        }], { session });
        
        createdExpert = expert;
      });
    } catch (transactionError) {
    return next(transactionError);
    } finally {
      await session.endSession();
    }

    res.status(201).json({
      success: true,
      data: createdExpert
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Permanently deletes an Expert profile, the linked User credential document, and all
 * associated Booking documents in a single atomic MongoDB transaction.
 * This function is async. It awaits `Expert.findById` and `session.withTransaction`.
 *
 * @async
 * @param {import('express').Request} req - Express request. `req.params.id` is the Expert document ID.
 * @param {import('express').Response} res - Express response. Returns `{ success, message }`.
 * @param {import('express').NextFunction} next - Forwards unexpected errors to the global error handler.
 * @returns {Promise<void>}
 * @throws {404} If the expert does not exist.
 * @route DELETE /admin/experts/:id
 */
const deleteExpertByAdmin = async (req, res, next) => {
  try {
    const expert = await Expert.findById(req.params.id);
    if (!expert) {
      return res.status(404).json({
        success: false,
        error: 'Expert not found'
      });
    }

    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Delete user account credentials
        if (expert.user) {
          await User.findByIdAndDelete(expert.user, { session });
        }

        // Delete associated bookings
        await Booking.deleteMany({ expert: expert._id }, { session });

        // Delete profile
        await Expert.findByIdAndDelete(req.params.id, { session });
      });
    } catch (transactionError) {
    return next(transactionError);
    } finally {
      await session.endSession();
    }

    res.status(200).json({
      success: true,
      message: 'Expert, associated user account, and bookings deleted successfully'
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Clears a user's late-cancellation strike count and removes any active booking suspension,
 * allowing the user to make new bookings immediately.
 * This function is async. It awaits `User.findById` and `user.save`.
 *
 * @async
 * @param {import('express').Request} req - Express request. `req.params.id` is the User document ID.
 * @param {import('express').Response} res - Express response. Returns `{ success, message, data }` with the updated user.
 * @param {import('express').NextFunction} next - Forwards unexpected errors to the global error handler.
 * @returns {Promise<void>}
 * @throws {404} If the user does not exist.
 * @route POST /admin/users/:id/reset-penalties
 */
const resetUserPenalties = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User account not found'
      });
    }

    user.lateCancellationsCount = 0;
    user.suspendedUntil = null;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Penalties reset and booking suspension lifted successfully.',
      data: user
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getAllUsers,
  getAllBookings,
  updateBookingStatusByAdmin,
  deleteBookingByAdmin,
  createExpertByAdmin,
  deleteExpertByAdmin,
  resetUserPenalties
};
