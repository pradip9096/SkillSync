/**
 * @file expertDashboardController.js
 * @description Controllers for the Expert Portal to view client bookings, update bios, and block availability.
 * 
 * Purpose: Fulfills the Expert-specific dashboard operations.
 * Inputs: Express request and response objects.
 * Outputs: JSON data payloads.
 * Side Effects: Reads/writes database collections (Expert, Booking, User).
 */

const Expert = require('../models/Expert');
const Booking = require('../models/Booking');

/**
 * @desc    Get all bookings for the logged-in Expert
 * @route   GET /expert-dashboard/bookings
 * @access  Private (Expert Only)
 */
const getExpertBookings = async (req, res) => {
  try {
    const expert = await Expert.findOne({ user: req.user._id });
    if (!expert) {
      return res.status(404).json({
        success: false,
        error: 'Expert profile not found for this user account'
      });
    }

    // Find all bookings associated with this expert
    const bookings = await Booking.find({ expert: expert._id })
      .sort({ bookingDate: -1, slotTime: -1 });

    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Server error retrieving bookings'
    });
  }
};

/**
 * @desc    Get logged-in Expert profile
 * @route   GET /expert-dashboard/profile
 * @access  Private (Expert Only)
 */
const getExpertProfile = async (req, res) => {
  try {
    const expert = await Expert.findOne({ user: req.user._id }).populate('user', 'email name phone');
    if (!expert) {
      return res.status(404).json({
        success: false,
        error: 'Expert profile not found for this user account'
      });
    }

    res.status(200).json({
      success: true,
      data: expert
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Server error retrieving profile'
    });
  }
};

/**
 * @desc    Update Expert profile
 * @route   PUT /expert-dashboard/profile
 * @access  Private (Expert Only)
 */
const updateExpertProfile = async (req, res) => {
  try {
    const expert = await Expert.findOne({ user: req.user._id });
    if (!expert) {
      return res.status(404).json({
        success: false,
        error: 'Expert profile not found for this user account'
      });
    }

    // Update allowed fields
    if (req.body.experience !== undefined) {
      expert.experience = Number(req.body.experience);
    }
    if (req.body.hourlyRate !== undefined) {
      expert.hourlyRate = Number(req.body.hourlyRate);
    }
    if (req.body.description !== undefined) {
      expert.description = req.body.description;
    }
    if (req.body.profileImage !== undefined) {
      expert.profileImage = req.body.profileImage;
    }

    const updatedExpert = await expert.save();

    res.status(200).json({
      success: true,
      data: updatedExpert
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Server error updating profile'
    });
  }
};

/**
 * @desc    Block a time slot as unavailable by creating a placeholder booking
 * @route   POST /expert-dashboard/block-slot
 * @access  Private (Expert Only)
 */
const blockSlot = async (req, res) => {
  try {
    const { bookingDate, slotTime } = req.body;
    
    if (!bookingDate || !slotTime) {
      return res.status(400).json({
        success: false,
        error: 'Please provide bookingDate and slotTime'
      });
    }

    const expert = await Expert.findOne({ user: req.user._id });
    if (!expert) {
      return res.status(404).json({
        success: false,
        error: 'Expert profile not found for this user account'
      });
    }

    // Check if slot is already booked (exclude Cancelled)
    const existingBooking = await Booking.findOne({
      expert: expert._id,
      bookingDate,
      slotTime,
      status: { $ne: 'Cancelled' }
    });

    if (existingBooking) {
      return res.status(400).json({
        success: false,
        error: 'This time slot is already booked or blocked'
      });
    }

    // Create the blocking booking record
    const booking = await Booking.create({
      expert: expert._id,
      user: req.user._id,
      userName: 'Blocked Slot',
      userEmail: req.user.email,
      userPhone: req.user.phone || '+910000000000',
      bookingDate,
      slotTime,
      status: 'Confirmed',
      notes: 'Blocked by Expert'
    });

    // Real-time notification: Broadcast slot booked to client listeners
    const io = req.app.get('io');
    if (io) {
      io.to(expert._id.toString()).emit('slot_booked', { bookingDate, slotTime });
    }

    res.status(201).json({
      success: true,
      data: booking
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Server error blocking slot'
    });
  }
};

/**
 * @desc    Unblock a previously blocked time slot by deleting the placeholder booking
 * @route   POST /expert-dashboard/unblock-slot
 * @access  Private (Expert Only)
 */
const unblockSlot = async (req, res) => {
  try {
    const { bookingDate, slotTime } = req.body;
    
    if (!bookingDate || !slotTime) {
      return res.status(400).json({
        success: false,
        error: 'Please provide bookingDate and slotTime'
      });
    }

    const expert = await Expert.findOne({ user: req.user._id });
    if (!expert) {
      return res.status(404).json({
        success: false,
        error: 'Expert profile not found for this user account'
      });
    }

    // Find the specific blocked booking created by the expert
    const booking = await Booking.findOne({
      expert: expert._id,
      bookingDate,
      slotTime,
      userEmail: req.user.email,
      notes: 'Blocked by Expert'
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Blocked slot record not found'
      });
    }

    await Booking.findByIdAndDelete(booking._id);

    // Real-time notification: Broadcast slot release to client listeners
    const io = req.app.get('io');
    if (io) {
      io.to(expert._id.toString()).emit('slot_released', {
        expertId: expert._id.toString(),
        date: bookingDate,
        slot: slotTime
      });
    }

    res.status(200).json({
      success: true,
      message: 'Slot unblocked successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Server error unblocking slot'
    });
  }
};

module.exports = {
  getExpertBookings,
  getExpertProfile,
  updateExpertProfile,
  blockSlot,
  unblockSlot
};
