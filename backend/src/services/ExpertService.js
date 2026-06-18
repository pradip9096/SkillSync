/**
 * @file ExpertService.js
 * @description Service layer for all expert-facing dashboard operations. Handles booking
 * lookups, profile management, slot blocking/unblocking, gallery image uploads, client
 * rating, and analytics aggregation. All methods are async and run within the context
 * of a single authenticated expert user.
 *
 * Inputs and outputs:
 *   - Exports: a singleton `ExpertService` instance.
 *
 * Side effects:
 *   - Reads and writes to the `Expert`, `Booking`, `Availability`, `ClientReview`,
 *     `Review`, and `User` MongoDB collections.
 *   - `uploadGalleryImage` and `deleteGalleryImage` read/write image files on disk
 *     at `frontend/public/uploads/`.
 *   - `blockSlot` and `unblockSlot` emit `slot_booked` / `slot_released` Socket.io
 *     events to the expert's room when an `io` instance is provided.
 *   - `rateClient` uses a MongoDB ACID transaction (`session.withTransaction`).
 *
 * Dependencies:
 *   - `mongoose` — session/transaction support.
 *   - `../repositories/*` — all four repository singletons.
 *   - `../models/Availability` — direct model access for `create` and `findByIdAndDelete`.
 *   - `../models/ClientReview` — direct model access for `create` inside transactions.
 *   - `../models/Review` — read-only access for analytics.
 *   - `fs`, `path` — Node.js built-ins for gallery image file management.
 */

const mongoose = require('mongoose');
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

/**
 * Service class encapsulating all expert dashboard business logic.
 * Exported as a singleton — do not instantiate directly.
 */
class ExpertService {
  /**
   * Returns a paginated list of bookings assigned to the authenticated expert.
   * Bookings are sorted newest-first. This function is async. It awaits
   * `ExpertRepository.findOne`, `BookingRepository.find`, and
   * `BookingRepository.countDocuments`.
   *
   * @async
   * @param {{ authUser: object, page?: number, limit?: number }} args
   *   - `authUser`: The authenticated user document (must have `_id`).
   *   - `page`: 1-based page index (default `1`).
   *   - `limit`: Results per page, clamped to [1, 100] (default `20`).
   * @returns {Promise<{ count: number, total: number, pages: number, data: object[] }>}
   *   Paginated result with the booking array and metadata.
   * @throws {Error} 404 if no expert profile is found for `authUser`.
   */
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

  /**
   * Returns the authenticated expert's full profile document, populated with the
   * linked user account (name, email, phone). This function is async. It awaits
   * `ExpertRepository.findOneWithUser`.
   *
   * @async
   * @param {{ authUser: object }} args - `authUser`: The authenticated user document.
   * @returns {Promise<object>} The populated expert document.
   * @throws {Error} 404 if no expert profile is found for `authUser`.
   */
  async getExpertProfile({ authUser }) {
    const expert = await ExpertRepository.findOneWithUser({ user: authUser._id });
    if (!expert) {
      const err = new Error('Expert profile not found for this user account');
      err.status = 404;
      throw err;
    }
    return expert;
  }

  /**
   * Applies a partial update to the authenticated expert's profile. Only the fields
   * present in `payload` are changed. `hourlyRate` must be at least ₹100. Description
   * is capped at 5000 characters. This function is async. It awaits
   * `ExpertRepository.findOne` and `expert.save`.
   *
   * @async
   * @param {{ authUser: object, payload: object }} args
   *   - `authUser`: The authenticated user document.
   *   - `payload`: Partial profile fields (`experience`, `hourlyRate`, `description`,
   *     `profileImage`).
   * @returns {Promise<object>} The updated expert document.
   * @throws {Error} 404 if no expert profile is found.
   * @throws {Error} 400 if `hourlyRate` is below ₹100 or `description` exceeds 5000 chars.
   */
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

  /**
   * Marks a future time slot as blocked (unavailable) for booking. Rejects past slots,
   * slots with existing active bookings, or slots already blocked via `Availability`.
   * Emits `slot_booked` to the expert's Socket.io room on success.
   * This function is async. It awaits repository lookups and `Availability.create`.
   *
   * @async
   * @param {{ authUser: object, payload: { bookingDate: string, slotTime: string }, io?: object }} args
   *   - `authUser`: The authenticated user document.
   *   - `payload.bookingDate`: Date string in `YYYY-MM-DD` format.
   *   - `payload.slotTime`: 24-hour time string in `HH:mm` format.
   *   - `io`: Optional Socket.io server instance for real-time notifications.
   * @returns {Promise<object>} The newly created `Availability` block document.
   * @throws {Error} 400 if fields are missing, slot is in the past, or already booked/blocked.
   * @throws {Error} 404 if no expert profile is found for `authUser`.
   */
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

  /**
   * Removes an existing `Availability` block record, making the slot available again.
   * Emits `slot_released` to the expert's Socket.io room on success.
   * This function is async. It awaits repository lookups and `Availability.findByIdAndDelete`.
   *
   * @async
   * @param {{ authUser: object, payload: { bookingDate: string, slotTime: string }, io?: object }} args
   *   - `authUser`: The authenticated user document.
   *   - `payload.bookingDate`: Date string in `YYYY-MM-DD` format.
   *   - `payload.slotTime`: 24-hour time string in `HH:mm` format.
   *   - `io`: Optional Socket.io server instance for real-time notifications.
   * @returns {Promise<{ message: string }>} Success confirmation message.
   * @throws {Error} 400 if fields are missing.
   * @throws {Error} 404 if no expert profile or block record is found.
   */
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

  /**
   * Appends a new image to the expert's gallery array (max 5 images). If the gallery is
   * already at capacity, the uploaded file is deleted from disk before throwing.
   * This function is async. It awaits `ExpertRepository.findOne` and `expert.save`.
   *
   * @async
   * @param {{ authUser: object, file?: object }} args
   *   - `authUser`: The authenticated user document.
   *   - `file`: Multer file object (`file.filename` used to build the image path).
   * @returns {Promise<string[]>} The updated gallery array of image path strings.
   * @throws {Error} 400 if no file is provided or the gallery limit of 5 is exceeded.
   * @throws {Error} 404 if no expert profile is found.
   */
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

  /**
   * Removes an image from the expert's gallery array and deletes the corresponding file
   * from `frontend/public/uploads/` if it exists on disk.
   * This function is async. It awaits `ExpertRepository.findOne` and `expert.save`.
   *
   * @async
   * @param {{ authUser: object, filename: string }} args
   *   - `authUser`: The authenticated user document.
   *   - `filename`: The filename portion of the image (e.g. `photo.jpg`), without the
   *     `/uploads/` prefix.
   * @returns {Promise<string[]>} The updated gallery array after removal.
   * @throws {Error} 404 if no expert profile is found or the image is not in the gallery.
   */
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

  /**
   * Submits a 1–5 star rating for the client of a completed booking. Idempotency is
   * enforced via `booking.isClientRated`. The review creation and the rolling average
   * update on the user document are wrapped in a MongoDB ACID transaction.
   * This function is async. It awaits repository lookups and `session.withTransaction`.
   *
   * @async
   * @param {{ authUser: object, bookingId: string, payload: { rating: number|string, comment?: string } }} args
   *   - `authUser`: The authenticated expert user document.
   *   - `bookingId`: The MongoDB ObjectId string of the booking to rate.
   *   - `payload.rating`: Numeric rating 1–5 (accepts string, coerced with `Number()`).
   *   - `payload.comment`: Optional free-text review comment.
   * @returns {Promise<{ clientUser: object, review: object }>} The updated client user and the
   *   new `ClientReview` document.
   * @throws {Error} 400 if rating is missing, out of range, session is not completed, or already rated.
   * @throws {Error} 401 if the booking does not belong to this expert.
   * @throws {Error} 404 if expert profile, booking, or client account is not found.
   */
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

  /**
   * Aggregates and returns a comprehensive analytics snapshot for the authenticated expert.
   * Computes booking counts by status, monthly revenue trends, weekday and hourly
   * session distributions, total earnings (INR), utilization rate, and the 5 most
   * recent client reviews. This function is async. It awaits `ExpertRepository.findOne`,
   * `BookingRepository.find`, `AvailabilityRepository.find`, and `Review.find`.
   *
   * @async
   * @param {{ authUser: object }} args - `authUser`: The authenticated user document.
   * @returns {Promise<object>} Analytics object containing `expertId`, `hourlyRate`,
   *   `rating`, `numReviews`, `counts`, `totalEarnings`, `utilizationRate`,
   *   `monthlyTrends`, `weeklyTrends`, `hourlyTrends`, and `recentReviews`.
   * @throws {Error} 404 if no expert profile is found.
   */
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
