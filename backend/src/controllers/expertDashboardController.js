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
const User = require('../models/User');
const ClientReview = require('../models/ClientReview');
const Review = require('../models/Review');

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

    const { page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(Math.max(1, parseInt(limit) || 20), 100);
    const skip = (pageNum - 1) * limitNum;

    // Find all bookings associated with this expert
    const bookings = await Booking.find({ expert: expert._id })
      .populate('user', 'name email phone rating numReviews')
      .sort({ bookingDate: -1, slotTime: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Booking.countDocuments({ expert: expert._id });

    res.status(200).json({
      success: true,
      count: bookings.length,
      total,
      pages: Math.ceil(total / limitNum),
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
      const rate = Number(req.body.hourlyRate);
      if (isNaN(rate) || rate < 100) {
        return res.status(400).json({
          success: false,
          error: 'Hourly rate must be at least 100 rupees'
        });
      }
      expert.hourlyRate = rate;
    }
    if (req.body.description !== undefined) {
      if (req.body.description && req.body.description.length > 5000) {
        return res.status(400).json({
          success: false,
          error: 'Description cannot exceed 5000 characters'
        });
      }
      expert.description = req.body.description;
    }
    if (req.body.profileImage !== undefined) {
      if (req.body.profileImage && req.body.profileImage.length > 1000) {
        return res.status(400).json({
          success: false,
          error: 'Profile image URL cannot exceed 1000 characters'
        });
      }
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

/**
 * @desc    Submit a numerical rating for a client and update their rolling average rating
 * @route   POST /expert-dashboard/bookings/:id/rate-client
 * @access  Private (Expert Only)
 */
const rateClient = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const bookingId = req.params.id;

    // Validate inputs
    if (!rating) {
      return res.status(400).json({ success: false, error: 'Rating is required.' });
    }

    const numericRating = Number(rating);
    if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ success: false, error: 'Rating must be a number between 1 and 5.' });
    }

    // Find the expert profile of the logged-in user
    const expert = await Expert.findOne({ user: req.user._id });
    if (!expert) {
      return res.status(404).json({ success: false, error: 'Expert profile not found for this account' });
    }

    // Verify the booking
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found.' });
    }

    // Ensure the booking belongs to this expert
    if (booking.expert.toString() !== expert._id.toString()) {
      return res.status(401).json({ success: false, error: 'Not authorized to rate this session.' });
    }

    // Ensure the booking is completed
    if (booking.status !== 'Completed') {
      return res.status(400).json({ success: false, error: 'You can only rate completed sessions.' });
    }

    // Ensure the booking has not been client-rated yet
    if (booking.isClientRated) {
      return res.status(400).json({ success: false, error: 'This client has already been rated for this session.' });
    }

    // Find the Client (User) associated with this booking
    if (!booking.user) {
      return res.status(400).json({ success: false, error: 'Cannot rate a session with no registered user account.' });
    }

    const clientUser = await User.findById(booking.user);
    if (!clientUser) {
      return res.status(404).json({ success: false, error: 'Client account not found.' });
    }

    // Create the ClientReview document
    const clientReview = await ClientReview.create({
      client: clientUser._id,
      expert: expert._id,
      expertName: expert.name,
      rating: numericRating,
      comment: comment || undefined,
      booking: bookingId
    });

    /**
     * Calculate new average rating:
     * Formula: New Average = ((Current Average * Current Count) + New Rating) / (Current Count + 1)
     */
    const currentTotal = clientUser.rating * clientUser.numReviews;
    clientUser.numReviews += 1;
    clientUser.rating = (currentTotal + numericRating) / clientUser.numReviews;

    // Save the updated client document
    await clientUser.save();

    // Mark the booking as client-rated
    booking.isClientRated = true;
    await booking.save();

    res.status(200).json({
      success: true,
      data: clientUser,
      review: clientReview
    });
  } catch (error) {
    console.error('API Error in rateClient:', error);
    res.status(500).json({ success: false, error: error.message || 'Server error rating client' });
  }
};

/**
 * @desc    Get dashboard analytics metrics for the logged-in Expert
 * @route   GET /expert-dashboard/analytics
 * @access  Private (Expert Only)
 */
const getExpertAnalytics = async (req, res) => {
  try {
    const expert = await Expert.findOne({ user: req.user._id });
    if (!expert) {
      return res.status(404).json({ success: false, error: 'Expert profile not found' });
    }

    // Fetch all bookings for this expert
    const bookings = await Booking.find({ expert: expert._id });
    
    // Fetch all blocked slots for this expert
    const blockedSlots = await Availability.find({ expert: expert._id });

    // Fetch recent reviews for this expert
    const recentReviews = await Review.find({ expert: expert._id })
      .sort({ createdAt: -1 })
      .limit(5);

    // Initial counts
    let totalBookings = bookings.length;
    let completedCount = 0;
    let confirmedCount = 0;
    let pendingCount = 0;
    let cancelledCount = 0;
    let lateCancelledCount = 0;

    // Monthly trends map (YYYY-MM) -> { month, count, revenue }
    const monthlyTrendsMap = {};

    // Weekly distribution map (0-6) -> count
    const weekdayDistribution = Array(7).fill(0);

    // Hourly distribution map (HH:mm) -> count
    const hourlyDistribution = {};

    // Helper: Map day index to name
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    bookings.forEach(b => {
      const status = b.status;
      if (status === 'Completed') completedCount++;
      else if (status === 'Confirmed') confirmedCount++;
      else if (status === 'Pending') pendingCount++;
      else if (status === 'Cancelled') cancelledCount++;
      else if (status === 'Late Cancellation') lateCancelledCount++;

      // Process only Completed/Confirmed sessions for trends & distribution
      if (status === 'Completed' || status === 'Confirmed') {
        // Monthly trend
        if (b.bookingDate) {
          const parts = b.bookingDate.split('-'); // YYYY-MM-DD
          if (parts.length === 3) {
            const yyyymm = `${parts[0]}-${parts[1]}`;
            // Let's get month display name
            const dateObj = new Date(`${b.bookingDate}T00:00:00`);
            const monthName = dateObj.toLocaleString('default', { month: 'short', year: 'numeric' });
            
            if (!monthlyTrendsMap[yyyymm]) {
              monthlyTrendsMap[yyyymm] = { month: monthName, count: 0, revenue: 0 };
            }
            monthlyTrendsMap[yyyymm].count += 1;
            if (status === 'Completed') {
              monthlyTrendsMap[yyyymm].revenue += expert.hourlyRate;
            }
          }
        }

        // Day of week distribution
        if (b.bookingDate) {
          const dateObj = new Date(`${b.bookingDate}T00:00:00`);
          const dayIndex = dateObj.getDay();
          if (!Number.isNaN(dayIndex)) {
            weekdayDistribution[dayIndex]++;
          }
        }

        // Time slot distribution
        if (b.slotTime) {
          hourlyDistribution[b.slotTime] = (hourlyDistribution[b.slotTime] || 0) + 1;
        }
      }
    });

    // Format Monthly Trends: Sort keys chronologically
    const monthlyTrends = Object.keys(monthlyTrendsMap)
      .sort()
      .map(key => monthlyTrendsMap[key]);

    // Format Weekly distribution
    const weeklyTrends = weekdays.map((day, idx) => ({
      day,
      count: weekdayDistribution[idx]
    }));

    // Format Hourly distribution
    const hourlyTrends = Object.keys(hourlyDistribution)
      .sort()
      .map(slot => ({
        slot,
        count: hourlyDistribution[slot]
      }));

    // General stats
    const totalBlockedCount = blockedSlots.length;
    const totalEarnings = completedCount * expert.hourlyRate;
    
    // Utilization rate: Completed / (All Bookings + Blocked slots)
    const divisor = totalBookings + totalBlockedCount;
    const utilizationRate = divisor > 0 
      ? parseFloat(((completedCount / divisor) * 100).toFixed(1)) 
      : 0;

    res.status(200).json({
      success: true,
      analytics: {
        expertId: expert._id,
        hourlyRate: expert.hourlyRate,
        rating: expert.rating,
        numReviews: expert.numReviews,
        counts: {
          totalBookings,
          completedCount,
          confirmedCount,
          pendingCount,
          cancelledCount,
          lateCancelledCount,
          totalBlockedCount
        },
        totalEarnings,
        utilizationRate,
        monthlyTrends,
        weeklyTrends,
        hourlyTrends,
        recentReviews
      }
    });
  } catch (error) {
    console.error('API Error in getExpertAnalytics:', error);
    res.status(500).json({ success: false, error: 'Server error retrieving analytics data' });
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
