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
const Availability = require('../models/Availability');

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

    // Validate that the slot is not in the past (using IST offset +05:30)
    const nowMs = Date.now();
    const slotDateTime = new Date(`${bookingDate}T${slotTime}:00+05:30`);
    const slotMs = slotDateTime.getTime();

    if (Number.isNaN(slotMs) || nowMs >= slotMs) {
      return res.status(400).json({
        success: false,
        error: 'Cannot block slots in the past.'
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
        error: 'This time slot is already booked.'
      });
    }

    // Check if slot is already blocked
    const existingBlock = await Availability.findOne({
      expert: expert._id,
      bookingDate,
      slotTime
    });

    if (existingBlock) {
      return res.status(400).json({
        success: false,
        error: 'This time slot is already blocked.'
      });
    }

    // Create the blocking record in Availability
    const block = await Availability.create({
      expert: expert._id,
      bookingDate,
      slotTime,
      notes: 'Blocked by Expert'
    });

    // Real-time notification: Broadcast slot booked to client listeners
    const io = req.app.get('io');
    if (io) {
      io.to(expert._id.toString()).emit('slot_booked', { bookingDate, slotTime });
    }

    res.status(201).json({
      success: true,
      data: block
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

    // Find the specific blocked slot in Availability
    const block = await Availability.findOne({
      expert: expert._id,
      bookingDate,
      slotTime
    });

    if (!block) {
      return res.status(404).json({
        success: false,
        error: 'Blocked slot record not found'
      });
    }

    await Availability.findByIdAndDelete(block._id);

    // Real-time notification: Broadcast slot release to client listeners
    const io = req.app.get('io');
    if (io) {
      io.to(expert._id.toString()).emit('slot_released', {
        expertId: expert._id.toString(),
        bookingDate,
        slotTime,
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

/**
 * @desc    Upload an image to expert's media gallery
 * @route   POST /expert-dashboard/gallery
 * @access  Private (Expert Only)
 */
const uploadGalleryImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Please upload an image file' });
    }

    const expert = await Expert.findOne({ user: req.user._id });
    if (!expert) {
      return res.status(404).json({ success: false, error: 'Expert profile not found' });
    }

    // Enforce max 5 images
    if (expert.gallery.length >= 5) {
      // Clean up the uploaded file since we are rejecting it
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, '../../../../frontend/public', `/uploads/${req.file.filename}`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return res.status(400).json({ success: false, error: 'Gallery limit reached (max 5 images).' });
    }

    const imagePath = `/uploads/${req.file.filename}`;
    expert.gallery.push(imagePath);
    await expert.save();

    res.status(200).json({
      success: true,
      gallery: expert.gallery
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Server error uploading gallery image'
    });
  }
};

/**
 * @desc    Delete an image from expert's media gallery
 * @route   DELETE /expert-dashboard/gallery/:filename
 * @access  Private (Expert Only)
 */
const deleteGalleryImage = async (req, res) => {
  try {
    const expert = await Expert.findOne({ user: req.user._id });
    if (!expert) {
      return res.status(404).json({ success: false, error: 'Expert profile not found' });
    }

    const filename = req.params.filename;
    const imagePath = `/uploads/${filename}`;

    // Ensure the image exists in their gallery
    if (!expert.gallery.includes(imagePath)) {
      return res.status(404).json({ success: false, error: 'Image not found in gallery' });
    }

    // Remove from array
    expert.gallery = expert.gallery.filter(img => img !== imagePath);
    await expert.save();

    // Optionally delete from disk
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, '../../../../frontend/public', imagePath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.status(200).json({
      success: true,
      gallery: expert.gallery
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Server error deleting gallery image'
    });
  }
};

module.exports = {
  getExpertBookings,
  getExpertProfile,
  updateExpertProfile,
  blockSlot,
  unblockSlot,
  uploadGalleryImage,
  deleteGalleryImage
};
