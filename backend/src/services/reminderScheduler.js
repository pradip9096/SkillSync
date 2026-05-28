const { ObjectId } = require('mongodb');
const agenda = require('../config/agenda');
const Booking = require('../models/Booking');
const emailService = require('./emailService');
const smsService = require('./smsService');

const sendEmail = (args) => emailService.sendEmail(args);
const sendSMS = (args) => smsService.sendSMS(args);

/**
 * Helper to convert YYYY-MM-DD and HH:mm in IST (+05:30) to a JavaScript Date object.
 */
const parseISTSessionTime = (bookingDate, slotTime) => {
  const session = new Date(`${bookingDate}T${slotTime}:00+05:30`);
  return Number.isNaN(session.getTime()) ? null : session;
};

/**
 * Helper to format slots into clean 12-hour AM/PM format.
 */
const format12Hour = (timeStr) => {
  if (!timeStr) return '';
  const [hourStr, minStr] = timeStr.split(':');
  const hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minStr} ${ampm}`;
};

// ==========================================
// Define Job Handlers
// ==========================================

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
  const formattedTime = format12Hour(booking.slotTime);

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

  await sendSMS({ to: clientPhone, message: clientSms });
  // If the expert has a phone number registered on user object, we can send to it (we'll query if it exists)
  if (booking.expert.user.phone) {
    await sendSMS({ to: booking.expert.user.phone, message: expertSms });
  }
});

agenda.define('send-booking-cancellation', async (job) => {
  const { clientEmail, clientName, clientPhone, expertName, expertEmail, bookingDate, slotTime, status, cancelledBy } = job.attrs.data;
  const formattedTime = format12Hour(slotTime);
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
  await sendSMS({ to: clientPhone, message: clientSms });
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
  const formattedTime = format12Hour(booking.slotTime);
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

  await sendSMS({ to: clientPhone, message: clientSms });
  if (booking.expert.user.phone) {
    await sendSMS({ to: booking.expert.user.phone, message: expertSms });
  }
});

// ==========================================
// Orchestration / Scheduler Helpers
// ==========================================

/**
 * Calculates pre-session trigger times and schedules reminders via Agenda.
 * Sets the resulting job IDs on the booking.
 */
const scheduleSessionReminders = async (booking) => {
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
 * Cancels pending Agenda scheduled jobs for a specific booking.
 */
const cancelScheduledReminders = async (booking) => {
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
