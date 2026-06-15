const mongoose = require('mongoose');
const { createOrder, refundPayment } = require('../utils/razorpayClient');
const crypto = require('crypto');
const agenda = require('../config/agenda');
const { BOOKING_STATUS, isValidTransition } = require('../constants/bookingStatus');
const { isValidIndianPhone } = require('../utils/phoneUtils');
const { formatTime12H } = require('../utils/timeFormatters');
const { scheduleSessionReminders, cancelScheduledReminders } = require('./reminderScheduler'); // Ensure this points correctly. It's in src/services
const { serializeBookingDTO } = require('../utils/serializers');

const BookingRepository = require('../repositories/BookingRepository');
const ExpertRepository = require('../repositories/ExpertRepository');
const AvailabilityRepository = require('../repositories/AvailabilityRepository');
const UserRepository = require('../repositories/UserRepository');

// Mongoose Models for those not fully converted to repositories yet, but we will use Repositories where applicable.
const ProcessedWebhook = require('../models/ProcessedWebhook');
const PaymentLog = require('../models/PaymentLog');
const Notification = require('../models/Notification');

// Razorpay client initialized in utils/razorpayClient.js

class BookingService {
  async createBooking({ payload, authUser, io }) {
    const { expert, userName, userEmail, userPhone, bookingDate, slotTime, notes } = payload;
    
    if (userPhone && !isValidIndianPhone(userPhone)) {
      const err = new Error('Please provide a valid Indian phone number');
      err.statusCode = 400;
      throw err;
    }
    
    if (!expert || !mongoose.Types.ObjectId.isValid(expert)) {
      const err = new Error('Invalid or missing expert identifier');
      err.statusCode = 400;
      throw err;
    }

    let userRef = null;
    let profileUpdated = false;

    if (authUser) {
      userRef = authUser._id;
      if (!authUser.name && userName) {
        authUser.name = userName;
        profileUpdated = true;
      }
      if (!authUser.phone && userPhone) {
        authUser.phone = userPhone;
        profileUpdated = true;
      }
    }

    if (authUser && authUser.suspendedUntil && Date.now() < authUser.suspendedUntil.getTime()) {
      const suspendedDateStr = new Date(authUser.suspendedUntil).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata'
      });
      const err = new Error(`Your booking privileges are temporarily suspended due to repeated late cancellations. Access will be restored on ${suspendedDateStr} IST.`);
      err.statusCode = 403;
      throw err;
    }

    if (authUser && authUser.role !== 'Client') {
      const err = new Error(`${authUser.role === 'Admin' ? 'Administrators' : 'Experts'} are not permitted to book expert sessions. Please use a Client account.`);
      err.statusCode = 403;
      throw err;
    }

    const expertProfile = await ExpertRepository.findByIdWithUser(expert);
    if (!expertProfile) {
      const err = new Error('Expert profile not found.');
      err.statusCode = 404;
      throw err;
    }

    if (expertProfile.user) {
      const expertUserId = expertProfile.user._id.toString();
      const expertEmail = expertProfile.user.email;

      if ((authUser && expertUserId === authUser._id.toString()) ||
          (userEmail && userEmail.toLowerCase().trim() === expertEmail.toLowerCase().trim())) {
        const err = new Error('You cannot book a session with yourself.');
        err.statusCode = 400;
        throw err;
      }
    }

    const bookingId = new mongoose.Types.ObjectId();
    let order;

    try {
      const amount = Math.round(expertProfile.hourlyRate * 100);
      order = await createOrder({
        amount,
        currency: 'INR',
        receipt: bookingId.toString()
      });
    } catch (rzpErr) {
      const err = new Error('Payment gateway error: ' + rzpErr.message);
      err.statusCode = 400;
      throw err;
    }

    const session = await mongoose.startSession();
    let bookingData;

    try {
      await session.withTransaction(async () => {
        if (profileUpdated && authUser) {
          await UserRepository.save(authUser, { session });
        }

        const existingBooking = await BookingRepository.findOne({ 
          expert, 
          bookingDate, 
          slotTime,
          status: { $nin: ['Cancelled', 'Late Cancellation'] }
        }, { session });
        
        if (existingBooking) {
          const err = new Error('This time slot is already booked.');
          err.code = 11000;
          throw err;
        }

        const existingBlock = await AvailabilityRepository.findOne({
          expert,
          bookingDate,
          slotTime
        }, { session });

        if (existingBlock) {
          const err = new Error('This time slot is blocked by the expert.');
          err.statusCode = 400;
          throw err;
        }

        const booking = BookingRepository.createInstance({
          _id: bookingId,
          expert,
          user: userRef,
          userName,
          userEmail,
          userPhone,
          bookingDate,
          slotTime,
          notes,
          status: 'Pending',
          razorpayOrderId: order.id
        });
        await BookingRepository.save(booking, { session });

        bookingData = booking;
      });
    } finally {
      session.endSession();
    }

    try {
      if (agenda && agenda._collection) {
        await agenda.schedule('in 5 minutes', 'cancel-abandoned-booking', { bookingId: bookingData._id });
      } else {
        console.warn('[Scheduler Warning] Agenda database collection is not ready. Skipping cleanup job scheduling.');
      }
    } catch (schedErr) {
      console.error('[Scheduler Error] Failed to schedule cleanup job:', schedErr.message);
    }

    if (io) {
      io.to(expert).emit('slot_booked', { bookingDate, slotTime });
    }

    return {
      data: bookingData,
      razorpayOrderId: order.id,
      amount: order.amount,
      keyId: process.env.RAZORPAY_KEY_ID
    };
  }

  async getBookingsByEmail({ email, authUser, page = 1, limit = 20 }) {
    if (!email) {
      const err = new Error('Please provide an email');
      err.statusCode = 400;
      throw err;
    }

    if (authUser.role !== 'Admin' && authUser.email.toLowerCase().trim() !== email.toLowerCase().trim()) {
      const err = new Error('Not authorized to view bookings for this email address.');
      err.statusCode = 403;
      throw err;
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(Math.max(1, parseInt(limit) || 20), 100);
    const skip = (pageNum - 1) * limitNum;

    const query = { 
      userEmail: email,
      notes: { $ne: 'Blocked by Expert' }
    };

    const bookings = await BookingRepository.find(query, {
      populate: { path: 'expert', select: 'name category hourlyRate' },
      sort: { bookingDate: -1, slotTime: -1 },
      skip,
      limit: limitNum
    });

    const total = await BookingRepository.countDocuments(query);

    return {
      count: bookings.length,
      total,
      pages: Math.ceil(total / limitNum),
      data: bookings.map(serializeBookingDTO)
    };
  }

  async updateBookingStatus({ bookingId, status, authUser, io }) {
    const booking = await BookingRepository.findById(bookingId);
    if (!booking) {
      const err = new Error('Booking not found');
      err.statusCode = 404;
      throw err;
    }

    const isAdmin = authUser.role === 'Admin';
    const isClientOwner = (booking.user && booking.user.toString() === authUser._id.toString()) || 
                          (booking.userEmail && booking.userEmail.toLowerCase().trim() === authUser.email.toLowerCase().trim());
    
    let isExpertOwner = false;
    if (authUser.role === 'Expert') {
      const expertProfile = await ExpertRepository.findOne({ user: authUser._id });
      isExpertOwner = expertProfile && booking.expert.toString() === expertProfile._id.toString();
    }

    if (!isAdmin && !isClientOwner && !isExpertOwner) {
      const err = new Error('Not authorized to modify the status of this booking.');
      err.statusCode = 403;
      throw err;
    }

    let normalizedStatus = String(status || '').trim();

    if (!isValidTransition(booking.status, normalizedStatus)) {
      // Special override for admins fixing stuck statuses if necessary, otherwise reject
      if (!isAdmin) {
        const err = new Error(`Invalid status transition from ${booking.status} to ${normalizedStatus}`);
        err.statusCode = 400;
        throw err;
      }
    }
    
    if (normalizedStatus === 'Completed') {
      const nowMs = Date.now();
      const sessionTime = new Date(`${booking.bookingDate}T${booking.slotTime}:00+05:30`);
      const sessionMs = sessionTime.getTime();

      if (Number.isNaN(sessionMs)) {
        const err = new Error('Invalid booking date or slot time. Cannot verify session end time.');
        err.statusCode = 400;
        throw err;
      }

      if (nowMs < sessionMs + 60 * 60 * 1000) {
        const err = new Error(`Time-lock violation: This session is scheduled for ${booking.bookingDate} ${booking.slotTime} IST and cannot be completed yet until the hour has passed.`);
        err.statusCode = 400;
        throw err;
      }
    }

    if ((normalizedStatus === 'Cancelled' || normalizedStatus === 'Late Cancellation') && !isAdmin) {
      const nowMs = Date.now();
      const sessionTime = new Date(`${booking.bookingDate}T${booking.slotTime}:00+05:30`);
      const sessionMs = sessionTime.getTime();

      if (Number.isNaN(sessionMs)) {
        const err = new Error('Invalid booking date or slot time. Cannot verify cancellation policy.');
        err.statusCode = 400;
        throw err;
      }

      if (nowMs >= sessionMs) {
        const err = new Error('Cannot cancel a session that has already passed.');
        err.statusCode = 400;
        throw err;
      }

      const twoHoursInMs = 2 * 60 * 60 * 1000;
      const isWithinTwoHours = (sessionMs - nowMs) <= twoHoursInMs;

      if (isWithinTwoHours) {
        if (normalizedStatus === 'Cancelled') {
          const err = new Error('Cancellations within 2 hours of the scheduled time must be processed as late cancellations. Please confirm to cancel late.');
          err.statusCode = 400;
          throw err;
        }
      } else {
        if (normalizedStatus === 'Late Cancellation') {
          normalizedStatus = 'Cancelled';
        }
      }
    }

    if (normalizedStatus === 'Late Cancellation') {
      const cancellingUser = await UserRepository.findById(authUser._id);
      if (cancellingUser) {
        cancellingUser.lateCancellationsCount = (cancellingUser.lateCancellationsCount || 0) + 1;
        if (cancellingUser.lateCancellationsCount >= 3) {
          cancellingUser.suspendedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          cancellingUser.lateCancellationsCount = 0;
        }
        await UserRepository.save(cancellingUser);
      }
    }

    if (normalizedStatus === 'Cancelled' && booking.status === 'Confirmed') {
      const paymentRecord = await PaymentLog.findOne({ booking: booking._id, status: 'captured' });
      
      if (paymentRecord) {
        try {
          const refund = await refundPayment(paymentRecord.razorpayPaymentId, {
            amount: paymentRecord.amount,
            notes: { reason: 'Client cancelled session outside penalty window.' }
          });

          await PaymentLog.create({
            booking: booking._id,
            user: booking.user,
            razorpayOrderId: booking.razorpayOrderId,
            razorpayPaymentId: refund.id,
            amount: paymentRecord.amount,
            signature: 'SYSTEM_REFUND',
            status: 'refunded'
          });
          
        } catch (rzpRefundErr) {
          console.error('[Refund Error]', rzpRefundErr.message);
          const err = new Error('Failed to process refund. Cancellation aborted. Please contact support.');
          err.statusCode = 502;
          throw err;
        }
      }
    }

    booking.status = normalizedStatus;
    await BookingRepository.save(booking);

    try {
      let message = `Your session for ${booking.bookingDate} at ${formatTime12H(booking.slotTime)} was updated to ${normalizedStatus}.`;
      let type = 'BOOKING_UPDATE';
      
      if (normalizedStatus === 'Late Cancellation') {
        type = 'STRIKE';
        message = `Your session was cancelled late, resulting in a penalty strike.`;
      }

      if (booking.user) {
        const notif = await Notification.create({
          user: booking.user,
          type,
          title: `Booking ${normalizedStatus}`,
          message
        });
        if (io) io.to(`user_${booking.user.toString()}`).emit('new_notification', notif.toJSON());
      }
      
      const expertProfile = await ExpertRepository.findById(booking.expert);
      if (expertProfile && expertProfile.user) {
        const notif = await Notification.create({
          user: expertProfile.user,
          type,
          title: `Session ${normalizedStatus}`,
          message
        });
        if (io) io.to(`user_${expertProfile.user.toString()}`).emit('new_notification', notif.toJSON());
      }
    } catch (err) {
      console.error('Error creating notification:', err);
    }

    if (normalizedStatus === 'Cancelled' || normalizedStatus === 'Late Cancellation') {
      try {
        await cancelScheduledReminders(booking);
        
        const expertProfile = await ExpertRepository.findByIdWithUser(booking.expert);
        if (expertProfile && expertProfile.user) {
          if (agenda && agenda._collection) {
            await agenda.now('send-booking-cancellation', {
              clientEmail: booking.userEmail,
              clientName: booking.userName,
              clientPhone: booking.userPhone,
              expertName: expertProfile.name,
              expertEmail: expertProfile.user.email,
              bookingDate: booking.bookingDate,
              slotTime: booking.slotTime,
              status: normalizedStatus,
              cancelledBy: authUser ? (authUser.role === 'Admin' ? 'Administrator' : authUser.role === 'Expert' ? 'Expert' : 'Client') : 'System'
            });
          }
        }
      } catch (schedErr) {
        console.error('[Scheduler Error]', schedErr.message);
      }

      if (io) {
        io.to(booking.expert.toString()).emit('slot_released', { 
          bookingDate: booking.bookingDate, 
          slotTime: booking.slotTime 
        });
      }
    }

    return booking;
  }

  async getBookedSlots({ expertId, date }) {
    const bookings = await BookingRepository.find({ 
      expert: expertId, 
      bookingDate: date,
      status: { $nin: ['Cancelled', 'Late Cancellation'] }
    }, { lean: true });

    const blocks = await AvailabilityRepository.find({
      expert: expertId,
      bookingDate: date
    });
    
    return [
      ...bookings.map(b => ({ slotTime: b.slotTime })),
      ...blocks.map(a => ({
        slotTime: a.slotTime,
        userName: 'Blocked Slot',
        notes: a.notes || 'Blocked by Expert'
      }))
    ];
  }

  async markAsRated({ bookingId, authUser }) {
    const booking = await BookingRepository.findById(bookingId);

    if (!booking) {
      const err = new Error('Booking not found');
      err.statusCode = 404;
      throw err;
    }

    const isAdmin = authUser.role === 'Admin';
    const isClientOwner = (booking.user && booking.user.toString() === authUser._id.toString()) || 
                          (booking.userEmail && booking.userEmail.toLowerCase().trim() === authUser.email.toLowerCase().trim());

    if (!isAdmin && !isClientOwner) {
      const err = new Error('Not authorized to rate this session.');
      err.statusCode = 403;
      throw err;
    }

    booking.isRated = true;
    await BookingRepository.save(booking);
    return booking;
  }

  async confirmBookingPayment({ bookingId, razorpayPaymentId, razorpayOrderId, razorpaySignature, io }) {
    const existingLog = await PaymentLog.findOne({ razorpayPaymentId });
    if (existingLog) {
      const booking = await BookingRepository.findByIdWithExpert(bookingId);
      return { success: true, alreadyProcessed: true, booking };
    }

    const booking = await BookingRepository.findByIdWithExpert(bookingId);
    if (!booking) throw new Error('Booking not found');

    if (booking.status === 'Confirmed') {
      return { success: true, alreadyProcessed: true, booking };
    }

    if (booking.status === 'Cancelled') {
      const conflictingBooking = await BookingRepository.findOne({
        expert: booking.expert._id || booking.expert,
        bookingDate: booking.bookingDate,
        slotTime: booking.slotTime,
        status: { $nin: ['Cancelled', 'Late Cancellation'] },
        _id: { $ne: booking._id }
      });

      if (conflictingBooking) {
        const log = new PaymentLog({
          booking: booking._id,
          user: booking.user,
          razorpayOrderId,
          razorpayPaymentId,
          amount: Math.round(booking.expert.hourlyRate * 100),
          signature: razorpaySignature,
          status: 'refunded'
        });
        await log.save();

        try {
          await refundPayment(razorpayPaymentId, {
            amount: Math.round(booking.expert.hourlyRate * 100),
            notes: { reason: 'Automatic refund: Slot was booked by another user during late payment.' }
          });
        } catch (refundErr) {
          console.error(refundErr.message);
        }

        return { success: false, conflict: true, booking };
      }
    }

    const log = new PaymentLog({
      booking: booking._id,
      user: booking.user,
      razorpayOrderId,
      razorpayPaymentId,
      amount: Math.round(booking.expert.hourlyRate * 100),
      signature: razorpaySignature,
      status: 'captured'
    });
    
    try {
      await log.save();
    } catch (err) {
      if (err.code === 11000) {
        const updatedBooking = await BookingRepository.findByIdWithExpert(booking._id);
        return { success: true, booking: updatedBooking };
      }
      throw err;
    }

    booking.status = 'Confirmed';
    await BookingRepository.save(booking);

    try {
      const expertProfileForNotif = await ExpertRepository.findById(booking.expert._id || booking.expert);
      if (expertProfileForNotif && expertProfileForNotif.user) {
        const notif = await Notification.create({
          user: expertProfileForNotif.user,
          type: 'BOOKING_UPDATE',
          title: 'New Booking Request',
          message: `${booking.userName} booked a session with you on ${booking.bookingDate} at ${formatTime12H(booking.slotTime)}.`
        });
        if (io) io.to(`user_${expertProfileForNotif.user.toString()}`).emit('new_notification', notif.toJSON());
      }
    } catch (err) {
      console.error(err);
    }

    try {
      if (agenda && agenda._collection) {
        await agenda.now('send-booking-confirmation', { bookingId: booking._id });
        await scheduleSessionReminders(booking);
      }
    } catch (schedErr) {
      console.error(schedErr.message);
    }

    if (io && booking.expert) {
      io.to((booking.expert._id || booking.expert).toString()).emit('slot_booked', { 
        bookingDate: booking.bookingDate, 
        slotTime: booking.slotTime 
      });
    }

    return { success: true, booking };
  }

  async verifyPayment({ payload, authUser, io }) {
    const { bookingId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = payload;

    if (!bookingId || !razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
      const err = new Error('Missing payment verification details');
      err.statusCode = 400;
      throw err;
    }

    const booking = await BookingRepository.findByIdWithExpert(bookingId);
    if (!booking) {
      const err = new Error('Booking not found');
      err.statusCode = 404;
      throw err;
    }

    if (booking.user && authUser && booking.user.toString() !== authUser._id.toString()) {
      const err = new Error('Unauthorized to verify this booking');
      err.statusCode = 403;
      throw err;
    }

    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    hmac.update(razorpayOrderId + '|' + razorpayPaymentId);
    const generatedSignature = hmac.digest('hex');

    const expectedBuffer = Buffer.from(generatedSignature, 'utf-8');
    const receivedBuffer = Buffer.from(razorpaySignature, 'utf-8');
    
    if (expectedBuffer.length !== receivedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) {
      const err = new Error('Invalid payment signature. Verification failed.');
      err.statusCode = 400;
      throw err;
    }

    const result = await this.confirmBookingPayment({
      bookingId, razorpayPaymentId, razorpayOrderId, razorpaySignature, io
    });

    if (result.conflict) {
      const err = new Error('This time slot was already booked by another user because the payment window expired. Your payment has been automatically refunded.');
      err.statusCode = 409;
      throw err;
    }

    return result.booking;
  }

  async handleWebhook({ event, payload, headers, io }) {
    const eventId = headers['x-razorpay-event-id'];
    if (eventId) {
      try {
        await ProcessedWebhook.create({ eventId, provider: 'razorpay' });
      } catch (err) {
        if (err.code === 11000) {
          console.log(`[Webhook Idempotency] Duplicate webhook caught and ignored for event: ${eventId}`);
          return { success: true, ignored: true };
        }
        throw err;
      }
    }

    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentEntity = payload.payment.entity;
      const razorpayOrderId = paymentEntity.order_id;
      const razorpayPaymentId = paymentEntity.id;
      const signatureHeader = headers['x-razorpay-signature'];

      const booking = await BookingRepository.findOne({ razorpayOrderId });
      if (!booking) {
        const err = new Error('Associated booking not found');
        err.statusCode = 404; // Return something that won't retry too aggressively if not found
        throw err;
      }

      const result = await this.confirmBookingPayment({
        bookingId: booking._id,
        razorpayPaymentId,
        razorpayOrderId,
        razorpaySignature: signatureHeader,
        io
      });

      return { success: true, alreadyProcessed: !!result.alreadyProcessed };
    }

    if (event === 'payment.failed') {
      const paymentEntity = payload.payment.entity;
      const razorpayOrderId = paymentEntity.order_id;

      const booking = await BookingRepository.findOne({ razorpayOrderId });
      if (booking && booking.status === 'Pending') {
        booking.status = 'Cancelled';
        await BookingRepository.save(booking);

        try {
          await cancelScheduledReminders(booking);
        } catch (err) {
          console.error(err.message);
        }

        if (io && booking.expert) {
          io.to(booking.expert.toString()).emit('slot_released', {
            bookingDate: booking.bookingDate,
            slotTime: booking.slotTime
          });
        }
      }
      return { success: true, cancelled: true };
    }

    return { success: true, ignored: true };
  }
}

module.exports = new BookingService();
