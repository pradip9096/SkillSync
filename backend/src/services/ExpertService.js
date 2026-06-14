const BookingRepository = require('../repositories/BookingRepository');
const ExpertRepository = require('../repositories/ExpertRepository');
const AvailabilityRepository = require('../repositories/AvailabilityRepository');
const UserRepository = require('../repositories/UserRepository');

// Mongoose Models
const Availability = require('../models/Availability');
const ClientReview = require('../models/ClientReview');
const Review = require('../models/Review');

const fs = require('fs');
const path = require('path');

class ExpertService {
  async getExpertBookings({ authUser, page = 1, limit = 20 }) {
    const expert = await ExpertRepository.findOne({ user: authUser._id });
    if (!expert) {
      const err = new Error('Expert profile not found for this user account');
      err.status = 404;
      throw err;
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(Math.max(1, parseInt(limit) || 20), 100);
    const skip = (pageNum - 1) * limitNum;

    const query = { expert: expert._id };
    const bookings = await BookingRepository.find(query, {
      populate: { path: 'user', select: 'name email phone rating numReviews' },
      sort: { bookingDate: -1, slotTime: -1 },
      skip,
      limit: limitNum
    });

    const total = await BookingRepository.countDocuments(query);

    return {
      count: bookings.length,
      total,
      pages: Math.ceil(total / limitNum),
      data: bookings
    };
  }

  async getExpertProfile({ authUser }) {
    const expert = await ExpertRepository.findOneWithUser({ user: authUser._id });
    if (!expert) {
      const err = new Error('Expert profile not found for this user account');
      err.status = 404;
      throw err;
    }
    return expert;
  }

  async updateExpertProfile({ authUser, payload }) {
    const expert = await ExpertRepository.findOne({ user: authUser._id });
    if (!expert) {
      const err = new Error('Expert profile not found for this user account');
      err.status = 404;
      throw err;
    }

    if (payload.experience !== undefined) {
      expert.experience = Number(payload.experience);
    }
    if (payload.hourlyRate !== undefined) {
      const rate = Number(payload.hourlyRate);
      if (isNaN(rate) || rate < 100) {
        const err = new Error('Hourly rate must be at least 100 rupees');
        err.status = 400;
        throw err;
      }
      expert.hourlyRate = rate;
    }
    if (payload.description !== undefined) {
      if (payload.description && payload.description.length > 5000) {
        const err = new Error('Description cannot exceed 5000 characters');
        err.status = 400;
        throw err;
      }
      expert.description = payload.description;
    }
    if (payload.profileImage !== undefined) {
      if (payload.profileImage && payload.profileImage.length > 1000) {
        const err = new Error('Profile image URL cannot exceed 1000 characters');
        err.status = 400;
        throw err;
      }
      expert.profileImage = payload.profileImage;
    }

    await expert.save();
    return expert;
  }

  async blockSlot({ authUser, payload, io }) {
    const { bookingDate, slotTime } = payload;
    if (!bookingDate || !slotTime) {
      const err = new Error('Please provide bookingDate and slotTime');
      err.status = 400;
      throw err;
    }

    const nowMs = Date.now();
    const slotDateTime = new Date(`${bookingDate}T${slotTime}:00+05:30`);
    const slotMs = slotDateTime.getTime();

    if (Number.isNaN(slotMs) || nowMs >= slotMs) {
      const err = new Error('Cannot block slots in the past.');
      err.status = 400;
      throw err;
    }

    const expert = await ExpertRepository.findOne({ user: authUser._id });
    if (!expert) {
      const err = new Error('Expert profile not found for this user account');
      err.status = 404;
      throw err;
    }

    const existingBooking = await BookingRepository.findOne({
      expert: expert._id,
      bookingDate,
      slotTime,
      status: { $ne: 'Cancelled' }
    });

    if (existingBooking) {
      const err = new Error('This time slot is already booked.');
      err.status = 400;
      throw err;
    }

    const existingBlock = await AvailabilityRepository.findOne({
      expert: expert._id,
      bookingDate,
      slotTime
    });

    if (existingBlock) {
      const err = new Error('This time slot is already blocked.');
      err.status = 400;
      throw err;
    }

    const block = await Availability.create({
      expert: expert._id,
      bookingDate,
      slotTime,
      notes: 'Blocked by Expert'
    });

    if (io) {
      io.to(expert._id.toString()).emit('slot_booked', { bookingDate, slotTime });
    }

    return block;
  }

  async unblockSlot({ authUser, payload, io }) {
    const { bookingDate, slotTime } = payload;
    if (!bookingDate || !slotTime) {
      const err = new Error('Please provide bookingDate and slotTime');
      err.status = 400;
      throw err;
    }

    const expert = await ExpertRepository.findOne({ user: authUser._id });
    if (!expert) {
      const err = new Error('Expert profile not found for this user account');
      err.status = 404;
      throw err;
    }

    const block = await AvailabilityRepository.findOne({
      expert: expert._id,
      bookingDate,
      slotTime
    });

    if (!block) {
      const err = new Error('Blocked slot record not found');
      err.status = 404;
      throw err;
    }

    await Availability.findByIdAndDelete(block._id);

    if (io) {
      io.to(expert._id.toString()).emit('slot_released', {
        expertId: expert._id.toString(),
        bookingDate,
        slotTime,
        date: bookingDate,
        slot: slotTime
      });
    }

    return { message: 'Slot unblocked successfully' };
  }

  async uploadGalleryImage({ authUser, file }) {
    if (!file) {
      const err = new Error('Please upload an image file');
      err.status = 400;
      throw err;
    }

    const expert = await ExpertRepository.findOne({ user: authUser._id });
    if (!expert) {
      const err = new Error('Expert profile not found');
      err.status = 404;
      throw err;
    }

    if (expert.gallery.length >= 5) {
      const filePath = path.join(__dirname, '../../../../frontend/public', `/uploads/${file.filename}`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      const err = new Error('Gallery limit reached (max 5 images).');
      err.status = 400;
      throw err;
    }

    const imagePath = `/uploads/${file.filename}`;
    expert.gallery.push(imagePath);
    await expert.save();

    return expert.gallery;
  }

  async deleteGalleryImage({ authUser, filename }) {
    const expert = await ExpertRepository.findOne({ user: authUser._id });
    if (!expert) {
      const err = new Error('Expert profile not found');
      err.status = 404;
      throw err;
    }

    const imagePath = `/uploads/${filename}`;
    if (!expert.gallery.includes(imagePath)) {
      const err = new Error('Image not found in gallery');
      err.status = 404;
      throw err;
    }

    expert.gallery = expert.gallery.filter(img => img !== imagePath);
    await expert.save();

    const filePath = path.join(__dirname, '../../../../frontend/public', imagePath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return expert.gallery;
  }

  async rateClient({ authUser, bookingId, payload }) {
    const { rating, comment } = payload;
    if (!rating) {
      const err = new Error('Rating is required.');
      err.status = 400;
      throw err;
    }

    const numericRating = Number(rating);
    if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
      const err = new Error('Rating must be a number between 1 and 5.');
      err.status = 400;
      throw err;
    }

    const expert = await ExpertRepository.findOne({ user: authUser._id });
    if (!expert) {
      const err = new Error('Expert profile not found for this account');
      err.status = 404;
      throw err;
    }

    const booking = await BookingRepository.findById(bookingId);
    if (!booking) {
      const err = new Error('Booking not found.');
      err.status = 404;
      throw err;
    }

    if (booking.expert.toString() !== expert._id.toString()) {
      const err = new Error('Not authorized to rate this session.');
      err.status = 401;
      throw err;
    }

    if (booking.status !== 'Completed') {
      const err = new Error('You can only rate completed sessions.');
      err.status = 400;
      throw err;
    }

    if (booking.isClientRated) {
      const err = new Error('This client has already been rated for this session.');
      err.status = 400;
      throw err;
    }

    if (!booking.user) {
      const err = new Error('Cannot rate a session with no registered user account.');
      err.status = 400;
      throw err;
    }

    const clientUser = await UserRepository.findById(booking.user);
    if (!clientUser) {
      const err = new Error('Client account not found.');
      err.status = 404;
      throw err;
    }

    const session = await mongoose.startSession();
    let clientReview;
    
    try {
      await session.withTransaction(async () => {
        const reviewDocs = await ClientReview.create([{
          client: clientUser._id,
          expert: expert._id,
          expertName: expert.name,
          rating: numericRating,
          comment: comment || undefined,
          booking: bookingId
        }], { session });

        clientReview = reviewDocs[0];

        const currentTotal = clientUser.rating * clientUser.numReviews;
        clientUser.numReviews += 1;
        clientUser.rating = (currentTotal + numericRating) / clientUser.numReviews;

        await UserRepository.save(clientUser, { session });

        booking.isClientRated = true;
        await BookingRepository.save(booking, { session });
      });
    } finally {
      session.endSession();
    }

    return { clientUser, review: clientReview };
  }

  async getExpertAnalytics({ authUser }) {
    const expert = await ExpertRepository.findOne({ user: authUser._id });
    if (!expert) {
      const err = new Error('Expert profile not found');
      err.status = 404;
      throw err;
    }

    const bookings = await BookingRepository.find({ expert: expert._id });
    const blockedSlots = await AvailabilityRepository.find({ expert: expert._id });
    
    const recentReviews = await Review.find({ expert: expert._id })
      .sort({ createdAt: -1 })
      .limit(5);

    let totalBookings = bookings.length;
    let completedCount = 0, confirmedCount = 0, pendingCount = 0, cancelledCount = 0, lateCancelledCount = 0;

    const monthlyTrendsMap = {};
    const weekdayDistribution = Array(7).fill(0);
    const hourlyDistribution = {};
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    bookings.forEach(b => {
      const status = b.status;
      if (status === 'Completed') completedCount++;
      else if (status === 'Confirmed') confirmedCount++;
      else if (status === 'Pending') pendingCount++;
      else if (status === 'Cancelled') cancelledCount++;
      else if (status === 'Late Cancellation') lateCancelledCount++;

      if (status === 'Completed' || status === 'Confirmed') {
        if (b.bookingDate) {
          const parts = b.bookingDate.split('-');
          if (parts.length === 3) {
            const yyyymm = `${parts[0]}-${parts[1]}`;
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
          
          const dateObj = new Date(`${b.bookingDate}T00:00:00`);
          const dayIndex = dateObj.getDay();
          if (!Number.isNaN(dayIndex)) {
            weekdayDistribution[dayIndex]++;
          }
        }

        if (b.slotTime) {
          hourlyDistribution[b.slotTime] = (hourlyDistribution[b.slotTime] || 0) + 1;
        }
      }
    });

    const monthlyTrends = Object.keys(monthlyTrendsMap).sort().map(key => monthlyTrendsMap[key]);
    const weeklyTrends = weekdays.map((day, idx) => ({ day, count: weekdayDistribution[idx] }));
    const hourlyTrends = Object.keys(hourlyDistribution).sort().map(slot => ({ slot, count: hourlyDistribution[slot] }));

    const totalBlockedCount = blockedSlots.length;
    const totalEarnings = completedCount * expert.hourlyRate;
    const divisor = totalBookings + totalBlockedCount;
    const utilizationRate = divisor > 0 ? parseFloat(((completedCount / divisor) * 100).toFixed(1)) : 0;

    return {
      expertId: expert._id,
      hourlyRate: expert.hourlyRate,
      rating: expert.rating,
      numReviews: expert.numReviews,
      counts: {
        totalBookings, completedCount, confirmedCount, pendingCount, cancelledCount, lateCancelledCount, totalBlockedCount
      },
      totalEarnings,
      utilizationRate,
      monthlyTrends,
      weeklyTrends,
      hourlyTrends,
      recentReviews
    };
  }
}

module.exports = new ExpertService();
