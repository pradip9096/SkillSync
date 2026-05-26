/**
 * @file adminController.js
 * @description Administrative controllers to manage system-wide users, experts, and bookings.
 * 
 * Purpose: Provides backend logic for the Admin Panel. All actions are restricted to Admin role.
 * Inputs: Express request and response objects.
 * Outputs: JSON database payloads.
 * Side Effects: Reads/writes database collections (User, Expert, Booking).
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const Expert = require('../models/Expert');
const Booking = require('../models/Booking');

/**
 * @desc    Get all registered users
 * @route   GET /admin/users
 * @access  Private (Admin Only)
 */
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-password').sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Server error fetching users'
    });
  }
};

/**
 * @desc    Get all bookings in the system
 * @route   GET /admin/bookings
 * @access  Private (Admin Only)
 */
const getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({})
      .populate('expert', 'name category')
      .sort({ bookingDate: -1, slotTime: -1 });
    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Server error fetching bookings'
    });
  }
};

/**
 * @desc    Force update any booking status (Admin bypasses standard time lock constraint if needed)
 * @route   PATCH /admin/bookings/:id/status
 * @access  Private (Admin Only)
 */
const updateBookingStatusByAdmin = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Confirmed', 'Pending', 'Completed', 'Cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid status: Confirmed, Pending, Completed, or Cancelled'
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
    await booking.save();

    // If cancelled, broadcast socket event so the slot is released immediately in real-time for clients
    if (status === 'Cancelled' && oldStatus !== 'Cancelled') {
      const io = req.app.get('io');
      if (io) {
        const dateStr = booking.bookingDate;
        io.to(booking.expert.toString()).emit('slot_released', {
          expertId: booking.expert.toString(),
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
    res.status(500).json({
      success: false,
      error: error.message || 'Server error updating booking status'
    });
  }
};

/**
 * @desc    Delete/Cancel a booking completely
 * @route   DELETE /admin/bookings/:id
 * @access  Private (Admin Only)
 */
const deleteBookingByAdmin = async (req, res) => {
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
    res.status(500).json({
      success: false,
      error: error.message || 'Server error deleting booking'
    });
  }
};

/**
 * @desc    Create a new Expert account and profile
 * @route   POST /admin/experts
 * @access  Private (Admin Only)
 */
const createExpertByAdmin = async (req, res) => {
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
    if (!/^\+91[0-9]{10}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        error: 'Phone number must start with +91 followed by 10 digits'
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
      return res.status(500).json({
        success: false,
        error: transactionError.message || 'Server error creating expert transaction'
      });
    } finally {
      await session.endSession();
    }

    res.status(201).json({
      success: true,
      data: createdExpert
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Server error creating expert'
    });
  }
};

/**
 * @desc    Delete an Expert profile and associated User account
 * @route   DELETE /admin/experts/:id
 * @access  Private (Admin Only)
 */
const deleteExpertByAdmin = async (req, res) => {
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
      return res.status(500).json({
        success: false,
        error: transactionError.message || 'Server error executing deletion transaction'
      });
    } finally {
      await session.endSession();
    }

    res.status(200).json({
      success: true,
      message: 'Expert, associated user account, and bookings deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Server error deleting expert'
    });
  }
};

module.exports = {
  getAllUsers,
  getAllBookings,
  updateBookingStatusByAdmin,
  deleteBookingByAdmin,
  createExpertByAdmin,
  deleteExpertByAdmin
};
