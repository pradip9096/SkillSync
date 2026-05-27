/**
 * test_penalty_system.js
 * Integration test suite for the Strike & Cooldown Suspension System.
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

const { createBooking, updateBookingStatus } = require('./src/controllers/bookingController');
const { resetUserPenalties } = require('./src/controllers/adminController');

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
                // Mock socket
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

  try {
    // Proactively clean up any left-over test fixtures from previous failed runs
    await User.deleteMany({ email: { $in: ['penalty_expert_user@example.com', 'penalty_client_user@example.com'] } });
    await Expert.deleteMany({ name: 'Test Expert' });

    // Setup users & profiles
    testExpertUser = await User.create({
      name: 'Test Expert User',
      email: 'penalty_expert_user@example.com',
      password: 'password123',
      role: 'Expert'
    });

    testExpert = await Expert.create({
      name: 'Test Expert',
      category: 'Design',
      experience: 6,
      description: 'Expert for penalty system testing.',
      hourlyRate: 1200,
      user: testExpertUser._id
    });

    testClientUser = await User.create({
      name: 'Test Client User',
      email: 'penalty_client_user@example.com',
      password: 'password123',
      role: 'Client'
    });

    console.log('Test fixtures created successfully.');

    // Helper to create a test booking
    const createTestBooking = async (shiftMs) => {
      const { bookingDate, slotTime } = getISTStringsForOffset(shiftMs);
      return await Booking.create({
        expert: testExpert._id,
        user: testClientUser._id,
        userName: testClientUser.name,
        userEmail: testClientUser.email,
        userPhone: '+919876543210',
        bookingDate,
        slotTime,
        status: 'Confirmed'
      });
    };

    // --- TEST 1: First late cancellation increments strike count ---
    console.log('\n--- Running TEST 1: First Late Cancellation Strikes Check ---');
    const booking1 = await createTestBooking(1 * 60 * 60 * 1000); // 1 hour in future
    const req1 = {
      params: { id: booking1._id },
      body: { status: 'Late Cancellation' },
      user: testClientUser,
      app: makeMockIoApp()
    };
    const res1 = makeMockRes();

    await updateBookingStatus(req1, res1);

    assert.strictEqual(res1.statusCode, 200);
    assert.strictEqual(res1.data.data.status, 'Late Cancellation');

    let updatedUser = await User.findById(testClientUser._id);
    assert.strictEqual(updatedUser.lateCancellationsCount, 1, 'Expected strikes to be 1');
    assert.strictEqual(updatedUser.suspendedUntil, null, 'User should not be suspended yet');
    console.log('TEST 1 Passed: Strikes count correctly incremented to 1.');

    // --- TEST 2: Second late cancellation increments strikes count to 2 ---
    console.log('\n--- Running TEST 2: Second Late Cancellation Strikes Check ---');
    const booking2 = await createTestBooking(1.2 * 60 * 60 * 1000); // 1.2 hours in future
    const req2 = {
      params: { id: booking2._id },
      body: { status: 'Late Cancellation' },
      user: updatedUser, // pass current user state
      app: makeMockIoApp()
    };
    const res2 = makeMockRes();

    await updateBookingStatus(req2, res2);

    assert.strictEqual(res2.statusCode, 200);

    updatedUser = await User.findById(testClientUser._id);
    assert.strictEqual(updatedUser.lateCancellationsCount, 2, 'Expected strikes to be 2');
    assert.strictEqual(updatedUser.suspendedUntil, null, 'User should not be suspended yet');
    console.log('TEST 2 Passed: Strikes count correctly incremented to 2.');

    // --- TEST 3: Third late cancellation triggers 7-day suspension ---
    console.log('\n--- Running TEST 3: Third Late Cancellation Triggers Cooldown ---');
    const booking3 = await createTestBooking(1.5 * 60 * 60 * 1000); // 1.5 hours in future
    const req3 = {
      params: { id: booking3._id },
      body: { status: 'Late Cancellation' },
      user: updatedUser,
      app: makeMockIoApp()
    };
    const res3 = makeMockRes();

    await updateBookingStatus(req3, res3);

    assert.strictEqual(res3.statusCode, 200);

    updatedUser = await User.findById(testClientUser._id);
    assert.strictEqual(updatedUser.lateCancellationsCount, 0, 'Expected strikes to reset to 0');
    assert.ok(updatedUser.suspendedUntil, 'User should have a suspendedUntil timestamp');
    const diffDays = (updatedUser.suspendedUntil.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    assert.ok(diffDays > 6.9 && diffDays <= 7.0, 'Suspension should be set to 7 days in future');
    console.log('TEST 3 Passed: Third strike correctly triggered a 7-day cooldown suspension and reset strike counter.');

    // --- TEST 4: Suspended user is blocked from creating bookings ---
    console.log('\n--- Running TEST 4: Bookings Blocked for Suspended Users ---');
    const { bookingDate, slotTime } = getISTStringsForOffset(24 * 60 * 60 * 1000); // Tomorrow
    const req4 = {
      body: {
        expert: testExpert._id.toString(),
        userName: 'Test Client User',
        userEmail: 'penalty_client_user@example.com',
        userPhone: '+919876543210',
        bookingDate,
        slotTime,
        notes: 'Trying to book while suspended'
      },
      user: updatedUser,
      headers: {}
    };
    const res4 = makeMockRes();

    await createBooking(req4, res4);

    assert.strictEqual(res4.statusCode, 403, `Expected status 403, got ${res4.statusCode}`);
    assert.ok(res4.data.error.includes('suspended'), 'Expected error explaining suspension block');
    console.log('TEST 4 Passed: Suspended user booking attempt rejected with 403 Forbidden.');

    // --- TEST 5: Admin clears user penalties and suspension ---
    console.log('\n--- Running TEST 5: Admin Resets Penalties and Cooldown ---');
    const req5 = {
      params: { id: testClientUser._id }
    };
    const res5 = makeMockRes();

    await resetUserPenalties(req5, res5);

    assert.strictEqual(res5.statusCode, 200);
    assert.strictEqual(res5.data.data.lateCancellationsCount, 0);
    assert.strictEqual(res5.data.data.suspendedUntil, null);

    updatedUser = await User.findById(testClientUser._id);
    assert.strictEqual(updatedUser.lateCancellationsCount, 0, 'Strikes should be reset to 0');
    assert.strictEqual(updatedUser.suspendedUntil, null, 'Suspension should be lifted (null)');
    console.log('TEST 5 Passed: Admin penalties reset successfully unblocked the client.');

    // --- TEST 6: Booking succeeds after admin lift ---
    console.log('\n--- Running TEST 6: Booking Succeeds After Admin Cooldown Lift ---');
    const req6 = {
      body: {
        expert: testExpert._id.toString(),
        userName: 'Test Client User',
        userEmail: 'penalty_client_user@example.com',
        userPhone: '+919876543210',
        bookingDate,
        slotTime,
        notes: 'Booking after override'
      },
      user: updatedUser,
      headers: {},
      app: makeMockIoApp()
    };
    const res6 = makeMockRes();

    await createBooking(req6, res6);

    assert.strictEqual(res6.statusCode, 201, `Expected status 201, got ${res6.statusCode}`);
    assert.strictEqual(res6.data.success, true);
    console.log('TEST 6 Passed: Client successfully booked session after admin reset.');

  } catch (error) {
    console.error('Test Suite Failed:', error);
    process.exit(1);
  } finally {
    console.log('Cleaning up test fixtures...');
    if (testExpertUser) await User.deleteOne({ _id: testExpertUser._id });
    if (testExpert) await Expert.deleteOne({ _id: testExpert._id });
    if (testClientUser) await User.deleteOne({ _id: testClientUser._id });
    await Booking.deleteMany({ expert: testExpert?._id });

    await mongoose.connection.close();
    console.log('Database connection closed.');
  }
};

runTests();
