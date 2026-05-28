/**
 * test_reminders.js
 * Integration test suite for the Automated Email/SMS Reminders system using Agenda.js.
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const assert = require('assert');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const agenda = require('./src/config/agenda');
const Booking = require('./src/models/Booking');
const Expert = require('./src/models/Expert');
const User = require('./src/models/User');

const emailService = require('./src/services/emailService');
const smsService = require('./src/services/smsService');
const { createBooking, updateBookingStatus } = require('./src/controllers/bookingController');

// Mock tracking variables
let emailCalls = [];
let smsCalls = [];

// Inject mock spies into email and sms services
const setupSpies = () => {
  emailCalls = [];
  smsCalls = [];
  
  emailService.sendEmail = async (args) => {
    emailCalls.push(args);
    return { messageId: `mock-email-id-${Date.now()}` };
  };

  smsService.sendSMS = async (args) => {
    smsCalls.push(args);
    return { sid: `mock-sms-id-${Date.now()}` };
  };
};

const makeMockRes = () => {
  return {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    }
  };
};

const runTests = async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/skillsync';
  console.log(`Connecting to ${mongoUri}...`);
  await mongoose.connect(mongoUri);
  console.log('Database connected.');

  // Initialize and start Agenda
  await agenda.start();
  console.log('Agenda scheduler started.');

  // Clear existing test data
  await User.deleteMany({ email: { $in: ['reminders_expert@example.com', 'reminders_client@example.com'] } });
  await Expert.deleteMany({ name: 'Test Reminder Expert' });
  await Booking.deleteMany({ userEmail: 'reminders_client@example.com' });
  // Clean up any stray agenda jobs
  await agenda.cancel({ 'data.bookingId': { $exists: true } });

  // Setup spies
  setupSpies();

  let testExpertUser = null;
  let testExpert = null;
  let testClientUser = null;

  try {
    // 1. Create test profiles
    testExpertUser = await User.create({
      name: 'Test Reminder Expert User',
      email: 'reminders_expert@example.com',
      password: 'password123',
      role: 'Expert'
    });

    testExpert = await Expert.create({
      name: 'Test Reminder Expert',
      category: 'Technology',
      experience: 5,
      description: 'Expert for reminder system testing.',
      hourlyRate: 1500,
      user: testExpertUser._id
    });

    testClientUser = await User.create({
      name: 'Test Reminder Client User',
      email: 'reminders_client@example.com',
      password: 'password123',
      role: 'Client',
      phone: '+919999999999'
    });

    // We will set the booking date to tomorrow to allow reminders to be scheduled in the future
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    const bookingDateStr = tomorrow.toISOString().split('T')[0];
    const slotTimeStr = '14:00'; // 2:00 PM

    console.log(`\n--- Running TEST 1: Booking Creation triggers Confirmation & Reminders Queueing ---`);
    const reqCreate = {
      body: {
        expert: testExpert._id.toString(),
        userName: 'Test Reminder Client User',
        userEmail: 'reminders_client@example.com',
        userPhone: '+919999999999',
        bookingDate: bookingDateStr,
        slotTime: slotTimeStr,
        notes: 'Test reminders integration'
      },
      user: testClientUser,
      app: {
        get(key) {
          if (key === 'io') {
            return {
              to() {
                return { emit() {} };
              }
            };
          }
        }
      }
    };
    const resCreate = makeMockRes();

    await createBooking(reqCreate, resCreate);

    assert.strictEqual(resCreate.statusCode, 201, 'Booking creation should succeed.');
    const createdBooking = resCreate.data.data;
    assert.ok(createdBooking, 'Booking data should be returned.');

    // Wait a brief moment for Agenda's immediate task (send-booking-confirmation) to run
    console.log('Waiting 3 seconds for Agenda to run immediate confirmation job...');
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Assert that the confirmation email and SMS was sent
    assert.ok(emailCalls.length >= 2, 'Should send confirmation emails to both client and expert.');
    assert.ok(smsCalls.length >= 1, 'Should send confirmation SMS to client.');

    // Verify confirmation details
    const emailToClient = emailCalls.find(c => c.to === 'reminders_client@example.com');
    assert.ok(emailToClient, 'Client should receive email.');
    assert.ok(emailToClient.subject.includes('Confirmed'), 'Subject should state Confirmed.');

    const emailToExpert = emailCalls.find(c => c.to === 'reminders_expert@example.com');
    assert.ok(emailToExpert, 'Expert should receive email.');
    assert.ok(emailToExpert.subject.includes('Booking'), 'Subject should indicate booking.');

    // Verify schema fields for Agenda Job IDs
    const updatedBookingDoc = await Booking.findById(createdBooking._id);
    assert.ok(updatedBookingDoc.agenda24hJobId, 'Should store agenda24hJobId on the booking.');
    assert.ok(updatedBookingDoc.agenda2hJobId, 'Should store agenda2hJobId on the booking.');

    // Query agenda jobs to verify they are scheduled in the DB
    const jobs = await mongoose.connection.collection('agendaJobs').find({
      'data.bookingId': updatedBookingDoc._id
    }).toArray();

    // We expect two scheduled reminder jobs in the collection
    const reminderJobs = jobs.filter(j => j.name === 'send-session-reminder');
    assert.strictEqual(reminderJobs.length, 2, 'Should schedule two reminder jobs.');
    console.log('TEST 1 Passed: Confirmations sent and reminder jobs scheduled successfully.');

    console.log(`\n--- Running TEST 2: Execute Scheduled Reminder Job manually ---`);
    setupSpies(); // reset spies

    // Run the 2h reminder job directly
    const reminder2hJobData = reminderJobs.find(j => j.data.type === '2h');
    assert.ok(reminder2hJobData, 'Should find 2h scheduled reminder job.');

    // Retrieve Agenda task handler and run it
    const jobInstance = {
      attrs: reminder2hJobData
    };
    await agenda._definitions['send-session-reminder'].fn(jobInstance);

    assert.ok(emailCalls.length >= 2, 'Reminder should email both client and expert.');
    assert.ok(smsCalls.length >= 1, 'Reminder should SMS the client.');
    assert.ok(emailCalls[0].subject.includes('starts in 2 hours'), 'Email subject should indicate start time.');
    console.log('TEST 2 Passed: Reminder execution completes successfully.');

    console.log(`\n--- Running TEST 3: Booking Cancellation Cancels Reminders & Sends Cancellation Alert ---`);
    setupSpies(); // reset spies

    const reqCancel = {
      params: { id: updatedBookingDoc._id.toString() },
      body: { status: 'Cancelled' },
      user: testClientUser,
      app: {
        get(key) {
          if (key === 'io') {
            return {
              to() {
                return { emit() {} };
              }
            };
          }
        }
      }
    };
    const resCancel = makeMockRes();

    await updateBookingStatus(reqCancel, resCancel);

    assert.strictEqual(resCancel.statusCode, 200, 'Cancellation status update should succeed.');

    // Wait a brief moment for Agenda's immediate task (send-booking-cancellation) to run
    console.log('Waiting 3 seconds for Agenda to run immediate cancellation job...');
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Check that cancellation email was sent to both parties
    assert.ok(emailCalls.length >= 2, 'Cancellation email should be sent to both client and expert.');
    const cancelEmailToClient = emailCalls.find(c => c.to === 'reminders_client@example.com');
    assert.ok(cancelEmailToClient.subject.includes('Cancelled'), 'Email subject should indicate Cancelled.');

    // Check that the scheduled jobs are now cancelled/removed from agendaJobs collection
    const activeJobsAfterCancel = await mongoose.connection.collection('agendaJobs').find({
      'data.bookingId': updatedBookingDoc._id,
      name: 'send-session-reminder'
    }).toArray();

    assert.strictEqual(activeJobsAfterCancel.length, 0, 'Scheduled reminders should be cancelled/deleted from the database.');
    console.log('TEST 3 Passed: Pending jobs deleted and cancellation alerts dispatched successfully.');

    console.log('\nAll Reminders Integration Tests PASSED successfully.');
  } catch (err) {
    console.error('Test Suite Failed:', err);
    process.exit(1);
  } finally {
    // Cleanup
    await User.deleteMany({ email: { $in: ['reminders_expert@example.com', 'reminders_client@example.com'] } });
    await Expert.deleteMany({ name: 'Test Reminder Expert' });
    await Booking.deleteMany({ userEmail: 'reminders_client@example.com' });
    await agenda.cancel({ 'data.bookingId': { $exists: true } });
    
    // Stop agenda and disconnect mongoose
    await agenda.stop();
    await mongoose.disconnect();
    console.log('Connections closed.');
    process.exit(0);
  }
};

runTests();
