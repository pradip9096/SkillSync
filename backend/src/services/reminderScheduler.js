/**
 * @file reminderScheduler.js
 * @description Agenda.js job definitions and orchestration helpers for all time-sensitive
 * notifications in the booking lifecycle. Defines five job types:
 *   - `cancel-abandoned-booking` — refunds and cancels unpaid pending bookings.
 *   - `send-booking-confirmation` — email + SMS to client and expert on payment confirmation.
 *   - `send-booking-cancellation` — email + SMS to both parties on cancellation.
 *   - `send-session-reminder` — unified 24-hour and 2-hour pre-session reminder job.
 * Exports two orchestration helpers: `scheduleSessionReminders` and `cancelScheduledReminders`.
 *
 * Side effects:
 *   - Defines Agenda job handlers at module load time (side-effectful `agenda.define` calls).
 *   - `cancel-abandoned-booking` may call the Razorpay refund API and write to `PaymentLog`.
 *   - All job handlers send email via `emailService` and SMS via `smsService` (non-fatal on SMS).
 *   - `cancel-abandoned-booking` emits `slot_released` to a Socket.io room via `agenda.io`
 *     (attached to the Agenda instance by `app.js`).
 *   - `scheduleSessionReminders` and `cancelScheduledReminders` read/write the MongoDB
 *     `agendaJobs` collection and persist job IDs back onto the `Booking` document.
 *
 * Dependencies:
 *   - `mongodb` — `ObjectId` for Agenda job cancellation by ID.
 *   - `../config/agenda` — shared Agenda instance.
 *   - `../models/Booking`, `../models/PaymentLog` — Mongoose models.
 *   - `./emailService`, `./smsService` — notification transports.
 *   - `../utils/razorpayClient` — `fetchPayments` and `refundPayment` for abandoned bookings.
 *   - `../utils/timeFormatters` — `formatTime12H` for human-readable time in notification copy.
 */

const { ObjectId } = require('mongodb');
const agenda = require('../config/agenda');
const Booking = require('../models/Booking');
const PaymentLog = require('../models/PaymentLog');
const emailService = require('./emailService');
const smsService = require('./smsService');
const { fetchPayments, refundPayment } = require('../utils/razorpayClient');

const sendEmail = (args) => emailService.sendEmail(args);
const sendSMS = (args) => smsService.sendSMS(args);

/**
 * Sends an SMS and swallows any error so a failed SMS does not abort an Agenda job.
 *
 * @async
 * @param {{ to: string, message: string }} args - Destination phone and message body.
 * @returns {Promise<void>}
 */
const safeSendSMS = async (args) => {
  try {
    await sendSMS(args);
  } catch (err) {
    console.error(`[Scheduler Non-Fatal] SMS delivery failed to ${args.to}:`, err.message);
  }
};

/**
 * Converts a `YYYY-MM-DD` date string and `HH:mm` 24-hour time string in IST (+05:30)
 * to a JavaScript `Date` object in UTC.
 *
 * @param {string} bookingDate - Session date in `YYYY-MM-DD` format.
 * @param {string} slotTime - Session start time in `HH:mm` (24-hour) format.
 * @returns {Date|null} The parsed `Date` object, or `null` if the input is not a valid date.
 */
const parseISTSessionTime = (bookingDate, slotTime) => {
  const session = new Date(`${bookingDate}T${slotTime}:00+05:30`);
  return Number.isNaN(session.getTime()) ? null : session;
};

const { formatTime12H } = require('../utils/timeFormatters');

// ==========================================
// Define Job Handlers
// ==========================================

agenda.define('cancel-abandoned-booking', async (job) => {
  const { bookingId } = job.attrs.data;
  
  try {
    const booking = await Booking.findById(bookingId).populate('expert');
    if (!booking) return;

    if (booking.status === 'Pending') {
      if (booking.razorpayOrderId) {
        const payments = await fetchPayments(booking.razorpayOrderId);
        const capturedPayment = payments.items.find(p => p.status === 'captured');
        
        if (capturedPayment) {
          console.log(`[Scheduler] Abandoned booking ${bookingId} has captured payment ${capturedPayment.id}. Refunding...`);
          await refundPayment(capturedPayment.id, {
            speed: 'optimum'
          });
          
          await PaymentLog.create({
            razorpayPaymentId: capturedPayment.id,
            bookingId: booking._id,
            amount: capturedPayment.amount,
            status: 'refunded_abandoned_booking'
          });
        }
      }

      booking.status = 'Cancelled';
      await booking.save();
      console.log(`[Scheduler] Cancelled abandoned pending booking ${bookingId}`);

      if (agenda.io && booking.expert) {
        agenda.io.to(booking.expert._id.toString()).emit('slot_released', {
          bookingDate: booking.bookingDate,
          slotTime: booking.slotTime
        });
      }
    }
  } catch (error) {
    console.error(`[Scheduler] Error processing cancel-abandoned-booking for ${bookingId}:`, error.message);
    
    // Fallback retry logic: If we have tried less than 3 times, throw error so Agenda retries it
    const failCount = job.attrs.failCount || 0;
    if (failCount < 3) {
      console.log(`[Scheduler] Retrying job (Attempt ${failCount + 1}/3)...`);
      throw error; // Let Agenda's native retry/fail mechanism handle it
    } else {
      console.error(`[Scheduler] Job max retries reached. Abandoning retry for ${bookingId}.`);
    }
  }
});

agenda.define('send-booking-confirmation', async (job) => {
  const { bookingId } = job.attrs.data;
  const booking = await Booking.findById(bookingId)
    .populate({
      path: 'expert',
      populate: { path: 'user', select: 'name email' }
    });

  if (!booking || booking.status === 'Cancelled' || booking.status === 'Late Cancellation') {
    console.log(`[Scheduler] Confirmation skipped for booking ${bookingId} (not found or cancelled).`);
    return;
  }

  const clientName = booking.userName;
  const clientEmail = booking.userEmail;
  const clientPhone = booking.userPhone;
  const expertName = booking.expert.name;
  const expertEmail = booking.expert.user.email;
  const formattedTime = formatTime12H(booking.slotTime);

  // Email to Client
  const clientMailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #4CAF50;">Booking Confirmed!</h2>
      <p>Hi ${clientName},</p>
      <p>Your session with <strong>${expertName}</strong> has been successfully booked and confirmed.</p>
      <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;">
      <p><strong>Session Details:</strong></p>
      <ul style="list-style: none; padding-left: 0;">
        <li>📅 <strong>Date:</strong> ${booking.bookingDate}</li>
        <li>⏰ <strong>Time:</strong> ${formattedTime} (IST)</li>
        <li>💵 <strong>Rate:</strong> ₹${booking.expert.hourlyRate}/hr</li>
      </ul>
      ${booking.notes ? `<p><strong>Your Notes:</strong> "${booking.notes}"</p>` : ''}
      <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;">
      <p style="font-size: 12px; color: #777;">Need to make changes? Cancellations must be completed at least 2 hours prior to the session start time to avoid late cancellation penalties.</p>
    </div>
  `;

  // Email to Expert
  const expertMailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #2196F3;">New Booking Confirmed</h2>
      <p>Hi ${expertName},</p>
      <p>You have a new session booked with <strong>${clientName}</strong>.</p>
      <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;">
      <p><strong>Session Details:</strong></p>
      <ul style="list-style: none; padding-left: 0;">
        <li>📅 <strong>Date:</strong> ${booking.bookingDate}</li>
        <li>⏰ <strong>Time:</strong> ${formattedTime} (IST)</li>
      </ul>
      ${booking.notes ? `<p><strong>Client Notes:</strong> "${booking.notes}"</p>` : ''}
      <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;">
      <p>Please log in to your Expert Dashboard to view client details and access the session on time.</p>
    </div>
  `;

  // Dispatch emails
  await sendEmail({
    to: clientEmail,
    subject: `SkillSync Session Confirmed: ${expertName} - ${booking.bookingDate}`,
    html: clientMailHtml,
    text: `Your session with ${expertName} on ${booking.bookingDate} at ${formattedTime} IST is confirmed.`
  });

  await sendEmail({
    to: expertEmail,
    subject: `New SkillSync Booking: ${clientName} - ${booking.bookingDate}`,
    html: expertMailHtml,
    text: `You have a new booking with ${clientName} on ${booking.bookingDate} at ${formattedTime} IST.`
  });

  // Dispatch SMS
  const clientSms = `SkillSync booking confirmed! Session with ${expertName} is scheduled on ${booking.bookingDate} at ${formattedTime} (IST).`;
  const expertSms = `New SkillSync booking! Session with ${clientName} is scheduled on ${booking.bookingDate} at ${formattedTime} (IST).`;

  await safeSendSMS({ to: clientPhone, message: clientSms });
  // If the expert has a phone number registered on user object, we can send to it (we'll query if it exists)
  if (booking.expert.user.phone) {
    await safeSendSMS({ to: booking.expert.user.phone, message: expertSms });
  }
});

agenda.define('send-booking-cancellation', async (job) => {
  const { clientEmail, clientName, clientPhone, expertName, expertEmail, bookingDate, slotTime, status, cancelledBy } = job.attrs.data;
  const formattedTime = formatTime12H(slotTime);
  const cancelTypeStr = status === 'Late Cancellation' ? 'Late Cancellation (within 2-hour window)' : 'Cancelled';

  // Email to Client
  const clientMailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #f44336;">Session Cancelled</h2>
      <p>Hi ${clientName},</p>
      <p>Your session scheduled with <strong>${expertName}</strong> on <strong>${bookingDate}</strong> at <strong>${formattedTime} (IST)</strong> has been cancelled.</p>
      <p><strong>Cancellation Type:</strong> ${cancelTypeStr}</p>
      ${status === 'Late Cancellation' ? '<p style="color: #ff9800; font-weight: bold;">Note: As this cancellation occurred within the 2-hour window, a late cancellation strike has been recorded. Accumulating 3 strikes results in a 7-day scheduling suspension.</p>' : ''}
    </div>
  `;

  // Email to Expert
  const expertMailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #f44336;">Session Cancelled</h2>
      <p>Hi ${expertName},</p>
      <p>Your session scheduled with <strong>${clientName}</strong> on <strong>${bookingDate}</strong> at <strong>${formattedTime} (IST)</strong> has been cancelled by the ${cancelledBy || 'system'}.</p>
      <p>Your slot has been released and is now open for other bookings.</p>
    </div>
  `;

  await sendEmail({
    to: clientEmail,
    subject: `SkillSync Session Cancelled: ${expertName} - ${bookingDate}`,
    html: clientMailHtml,
    text: `Your session with ${expertName} on ${bookingDate} at ${formattedTime} IST has been cancelled.`
  });

  await sendEmail({
    to: expertEmail,
    subject: `SkillSync Cancellation Alert: ${clientName} - ${bookingDate}`,
    html: expertMailHtml,
    text: `Your session with ${clientName} on ${bookingDate} at ${formattedTime} IST has been cancelled.`
  });

  const clientSms = `SkillSync cancellation alert: Your session with ${expertName} on ${bookingDate} at ${formattedTime} IST has been cancelled (${cancelTypeStr}).`;
  await safeSendSMS({ to: clientPhone, message: clientSms });
});

agenda.define('send-session-reminder', async (job) => {
  const { bookingId, type } = job.attrs.data;
  const booking = await Booking.findById(bookingId)
    .populate({
      path: 'expert',
      populate: { path: 'user', select: 'name email' }
    });

  // Only dispatch if the booking is still active/confirmed
  if (!booking || booking.status !== 'Confirmed') {
    console.log(`[Scheduler] Reminder skipped for booking ${bookingId} (status is: ${booking ? booking.status : 'Deleted'}).`);
    return;
  }

  const clientName = booking.userName;
  const clientEmail = booking.userEmail;
  const clientPhone = booking.userPhone;
  const expertName = booking.expert.name;
  const expertEmail = booking.expert.user.email;
  const formattedTime = formatTime12H(booking.slotTime);
  const timeDesc = type === '24h' ? '24 hours' : '2 hours';

  // Email template
  const mailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #ff9800;">Upcoming Session Reminder (${timeDesc})</h2>
      <p>Hi there,</p>
      <p>This is a reminder that the session between <strong>${clientName}</strong> and expert <strong>${expertName}</strong> starts in <strong>${timeDesc}</strong>.</p>
      <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;">
      <p><strong>Session Details:</strong></p>
      <ul style="list-style: none; padding-left: 0;">
        <li>📅 <strong>Date:</strong> ${booking.bookingDate}</li>
        <li>⏰ <strong>Time:</strong> ${formattedTime} (IST)</li>
      </ul>
      <p>Please ensure you are online and ready at the session start time.</p>
    </div>
  `;

  // Email to both
  await sendEmail({
    to: clientEmail,
    subject: `Upcoming SkillSync Session: ${expertName} starts in ${timeDesc}`,
    html: mailHtml,
    text: `Reminder: Your session with ${expertName} starts in ${timeDesc} (${booking.bookingDate} at ${formattedTime} IST).`
  });

  await sendEmail({
    to: expertEmail,
    subject: `Upcoming SkillSync Session: ${clientName} starts in ${timeDesc}`,
    html: mailHtml,
    text: `Reminder: Your session with ${clientName} starts in ${timeDesc} (${booking.bookingDate} at ${formattedTime} IST).`
  });

  // SMS alerts
  const clientSms = `SkillSync Reminder: Your session with ${expertName} starts in ${timeDesc} (${formattedTime} IST).`;
  const expertSms = `SkillSync Reminder: Your session with ${clientName} starts in ${timeDesc} (${formattedTime} IST).`;

  await safeSendSMS({ to: clientPhone, message: clientSms });
  if (booking.expert.user.phone) {
    await safeSendSMS({ to: booking.expert.user.phone, message: expertSms });
  }
});

// ==========================================
// Orchestration / Scheduler Helpers
// ==========================================

/**
 * Schedules a 24-hour and a 2-hour pre-session reminder for the given booking.
 * Skips reminders whose trigger time has already passed. Persists the resulting
 * Agenda job IDs (`agenda24hJobId`, `agenda2hJobId`) on the booking document.
 * This function is async. It awaits `agenda.schedule` and `booking.save`.
 *
 * @async
 * @param {object} booking - A Mongoose `Booking` document with `bookingDate`, `slotTime`,
 *   `_id`, `agenda24hJobId`, and `agenda2hJobId` fields.
 * @returns {Promise<void>} Resolves once reminders are scheduled and the booking is saved.
 */
const scheduleSessionReminders = async (booking) => {
  if (!agenda || !agenda._collection) {
    console.warn('[Scheduler Warning] Agenda database collection is not ready. Skipping scheduling session reminders.');
    return;
  }

  const sessionTime = parseISTSessionTime(booking.bookingDate, booking.slotTime);
  if (!sessionTime) {
    console.error(`[Scheduler] Could not parse session time for booking ${booking._id}`);
    return;
  }

  const now = Date.now();
  const time24h = new Date(sessionTime.getTime() - 24 * 60 * 60 * 1000);
  const time2h = new Date(sessionTime.getTime() - 2 * 60 * 60 * 1000);

  let job24h = null;
  let job2h = null;

  // Schedule 24h reminder if the target time is in the future
  if (time24h.getTime() > now) {
    job24h = await agenda.schedule(time24h, 'send-session-reminder', {
      bookingId: booking._id,
      type: '24h'
    });
    console.log(`[Scheduler] Queued 24h reminder for ${time24h.toISOString()}`);
  }

  // Schedule 2h reminder if the target time is in the future
  if (time2h.getTime() > now) {
    job2h = await agenda.schedule(time2h, 'send-session-reminder', {
      bookingId: booking._id,
      type: '2h'
    });
    console.log(`[Scheduler] Queued 2h reminder for ${time2h.toISOString()}`);
  }

  // Update booking with the Agenda job IDs so they can be referenced or cancelled
  booking.agenda24hJobId = job24h ? job24h.attrs._id.toString() : null;
  booking.agenda2hJobId = job2h ? job2h.attrs._id.toString() : null;
  await booking.save();
};

/**
 * Cancels pending Agenda reminder jobs for a booking using the stored job IDs.
 * Errors on individual job cancellations are logged but do not halt processing.
 * This function is async. It awaits `agenda.cancel` for each job ID present.
 *
 * @async
 * @param {object} booking - A Mongoose `Booking` document with optional `agenda24hJobId`
 *   and `agenda2hJobId` string fields.
 * @returns {Promise<void>} Resolves once all available jobs have been cancelled.
 */
const cancelScheduledReminders = async (booking) => {
  if (!agenda || !agenda._collection) {
    console.warn('[Scheduler Warning] Agenda database collection is not ready. Skipping cancellation of scheduled reminders.');
    return;
  }

  let cancelledCount = 0;

  if (booking.agenda24hJobId) {
    try {
      const res = await agenda.cancel({ _id: new ObjectId(booking.agenda24hJobId) });
      cancelledCount += res;
    } catch (err) {
      console.error(`[Scheduler] Failed to cancel 24h job ${booking.agenda24hJobId}:`, err.message);
    }
  }

  if (booking.agenda2hJobId) {
    try {
      const res = await agenda.cancel({ _id: new ObjectId(booking.agenda2hJobId) });
      cancelledCount += res;
    } catch (err) {
      console.error(`[Scheduler] Failed to cancel 2h job ${booking.agenda2hJobId}:`, err.message);
    }
  }

  console.log(`[Scheduler] Cancelled ${cancelledCount} pending reminder jobs for booking ${booking._id}.`);
};

module.exports = {
  scheduleSessionReminders,
  cancelScheduledReminders
};
