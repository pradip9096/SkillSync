/**
 * test_late_cancellation.js
 * Integration test suite for the Cancellation Window Policy Lock feature.
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const assert = require('assert');

// Load env variables
dotenv.config({ path: path.join(__dirname, '.env') });

const Expert = require('./src/models/Expert');
const User = require('./src/models/User');
const Booking = require('./src/models/Booking');

const { updateBookingStatus } = require('./src/controllers/bookingController');
const { updateBookingStatusByAdmin } = require('./src/controllers/adminController');

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

const getISTStringsForOffset = (shiftMs) => {
  const localEpoch = Date.now() + shiftMs;
  // Offset to IST (+05:30)
  const istEpoch = localEpoch + 5.5 * 60 * 60 * 1000;
  const istDate = new Date(istEpoch);
  const dateStr = istDate.toISOString().split('T')[0];
  const hours = String(istDate.getUTCHours()).padStart(2, '0');
  const minutes = String(istDate.getUTCMinutes()).padStart(2, '0');
  return {
    bookingDate: dateStr,
    slotTime: `${hours}:${minutes}`
  };
};

const makeMockIoApp = () => {
  return {
    get(key) {
      if (key === 'io') {
        return {
          to(room) {
            return {
              emit(event, data) {
                console.log(`[Socket.io Event] Emitted '${event}' to room '${room}' with data:`, data);
              }
            };
          }
        };
      }
    }
  };
};

const runTests = async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/skillsync';
  console.log(`Connecting to ${mongoUri}...`);
  await mongoose.connect(mongoUri);
  console.log('Database connected.');

  let testExpertUser = null;
  let testExpert = null;
  let testClientUser = null;
  let testAdminUser = null;

  try {
    // Setup users & profiles
    testExpertUser = await User.create({
      name: 'Test Expert User',
      email: 'cancel_expert_user@example.com',
      password: 'password123',
      role: 'Expert'
    });

    testExpert = await Expert.create({
      name: 'Test Expert',
      category: 'Design',
      experience: 6,
      description: 'Expert for cancellation policy testing.',
      hourlyRate: 1200,
      user: testExpertUser._id
    });

    testClientUser = await User.create({
      name: 'Test Client User',
      email: 'cancel_client_user@example.com',
      password: 'password123',
      role: 'Client'
    });

    testAdminUser = await User.create({
      name: 'Test Admin User',
      email: 'cancel_admin_user@example.com',
      password: 'password123',
      role: 'Admin'
    });

    console.log('Test fixtures created successfully.');

    // Helper to create a test booking
    const createTestBooking = async (shiftMs) => {
      const { bookingDate, slotTime } = getISTStringsForOffset(shiftMs);
      const booking = await Booking.create({
        expert: testExpert._id,
        user: testClientUser._id,
        userName: testClientUser.name,
        userEmail: testClientUser.email,
        userPhone: '+919876543210',
        bookingDate,
        slotTime,
        status: 'Confirmed'
      });
      return booking;
    };

    // --- TEST 1: Cancel booking outside 2 hours (standard) ---
    console.log('\n--- Running TEST 1: Cancel Booking Outside 2-Hour Window (Standard) ---');
    // Tomorrow (24 hours) is definitely outside 2 hours
    const booking1 = await createTestBooking(24 * 60 * 60 * 1000);
    const req1 = {
      params: { id: booking1._id },
      body: { status: 'Cancelled' },
      user: testClientUser,
      app: makeMockIoApp()
    };
    const res1 = makeMockRes();

    await updateBookingStatus(req1, res1);

    assert.strictEqual(res1.statusCode, 200, `Expected status 200, got ${res1.statusCode}`);
    assert.strictEqual(res1.data.success, true);
    assert.strictEqual(res1.data.data.status, 'Cancelled', 'Expected status to be Cancelled');
    console.log('TEST 1 Passed: Standard cancellation outside 2 hours succeeded.');

    // --- TEST 2: Standard cancel booking within 2 hours (should fail) ---
    console.log('\n--- Running TEST 2: Standard Cancel Within 2-Hour Window (Should Fail) ---');
    // 1.5 hours in the future
    const booking2 = await createTestBooking(1.5 * 60 * 60 * 1000);
    const req2 = {
      params: { id: booking2._id },
      body: { status: 'Cancelled' },
      user: testClientUser,
      app: makeMockIoApp()
    };
    const res2 = makeMockRes();

    await updateBookingStatus(req2, res2);

    assert.strictEqual(res2.statusCode, 400, `Expected status 400, got ${res2.statusCode}`);
    assert.ok(res2.data.error.includes('late cancellations'), 'Error message should explain late cancellation requirements');
    console.log('TEST 2 Passed: Standard cancellation within 2 hours rejected successfully.');

    // --- TEST 3: Late cancel booking within 2 hours (should succeed) ---
    console.log('\n--- Running TEST 3: Late Cancel Within 2-Hour Window (Should Succeed) ---');
    const req3 = {
      params: { id: booking2._id },
      body: { status: 'Late Cancellation' },
      user: testClientUser,
      app: makeMockIoApp()
    };
    const res3 = makeMockRes();

    await updateBookingStatus(req3, res3);

    assert.strictEqual(res3.statusCode, 200, `Expected status 200, got ${res3.statusCode}`);
    assert.strictEqual(res3.data.data.status, 'Late Cancellation', 'Expected status to be Late Cancellation');
    console.log('TEST 3 Passed: Late cancellation within 2 hours succeeded.');

    // --- TEST 4: Late cancel booking outside 2 hours (should auto-downgrade to standard Cancelled) ---
    console.log('\n--- Running TEST 4: Late Cancel Outside 2-Hour Window (Should Auto-Downgrade) ---');
    const booking4 = await createTestBooking(24 * 60 * 60 * 1000);
    const req4 = {
      params: { id: booking4._id },
      body: { status: 'Late Cancellation' },
      user: testClientUser,
      app: makeMockIoApp()
    };
    const res4 = makeMockRes();

    await updateBookingStatus(req4, res4);

    assert.strictEqual(res4.statusCode, 200, `Expected status 200, got ${res4.statusCode}`);
    assert.strictEqual(res4.data.data.status, 'Cancelled', 'Expected status to be downgraded to Cancelled');
    console.log('TEST 4 Passed: Late cancellation request outside 2 hours automatically downgraded to standard Cancelled.');

    // --- TEST 5: Cancel booking in the past (should fail) ---
    console.log('\n--- Running TEST 5: Cancel Past Booking (Should Fail) ---');
    // 1 hour ago
    const booking5 = await createTestBooking(-1 * 60 * 60 * 1000);
    const req5 = {
      params: { id: booking5._id },
      body: { status: 'Cancelled' },
      user: testClientUser,
      app: makeMockIoApp()
    };
    const res5 = makeMockRes();

    await updateBookingStatus(req5, res5);

    assert.strictEqual(res5.statusCode, 400, `Expected status 400, got ${res5.statusCode}`);
    assert.ok(res5.data.error.includes('already passed'), 'Expected past session error message');
    console.log('TEST 5 Passed: Past session cancellation correctly rejected.');

    // --- TEST 6: Admin override past cancellation (should succeed) ---
    console.log('\n--- Running TEST 6: Admin Bypasses Past Booking Cancellation Lock ---');
    const req6 = {
      params: { id: booking5._id },
      body: { status: 'Cancelled' },
      user: testAdminUser,
      app: makeMockIoApp()
    };
    const res6 = makeMockRes();

    await updateBookingStatusByAdmin(req6, res6);

    assert.strictEqual(res6.statusCode, 200, `Expected status 200, got ${res6.statusCode}`);
    assert.strictEqual(res6.data.data.status, 'Cancelled', 'Expected admin override status to be Cancelled');
    console.log('TEST 6 Passed: Admin successfully bypassed constraints on past booking.');

    console.log('\nAll late cancellation integration tests passed successfully!');

  } catch (error) {
    console.error('Test Suite Failed:', error);
    process.exit(1);
  } finally {
    console.log('Cleaning up test fixtures...');
    if (testExpertUser) await User.deleteOne({ _id: testExpertUser._id });
    if (testExpert) await Expert.deleteOne({ _id: testExpert._id });
    if (testClientUser) await User.deleteOne({ _id: testClientUser._id });
    if (testAdminUser) await User.deleteOne({ _id: testAdminUser._id });
    await Booking.deleteMany({ expert: testExpert?._id });

    await mongoose.connection.close();
    console.log('Database connection closed.');
  }
};

runTests();
