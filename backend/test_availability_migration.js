/**
 * test_availability_migration.js
 * Integration test for the Availability schema migration and associated controllers.
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
const Availability = require('./src/models/Availability');

const { getBookedSlots, createBooking } = require('./src/controllers/bookingController');
const { blockSlot, unblockSlot } = require('./src/controllers/expertDashboardController');

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

  let testExpertUser = null;
  let testExpert = null;
  let testClientUser = null;
  let createdBookingId = null;

  try {
    // 1. Create a test Expert User
    testExpertUser = await User.create({
      name: 'Test Expert User',
      email: 'test_expert_user_unique@example.com',
      password: 'password123',
      role: 'Expert'
    });

    // 2. Create a test Expert Profile
    testExpert = await Expert.create({
      name: 'Test Expert',
      category: 'Technology',
      experience: 5,
      description: 'Expert for migration integration testing.',
      hourlyRate: 1500, // in Rupee symbol currency
      user: testExpertUser._id
    });

    // 3. Create a test Client User
    testClientUser = await User.create({
      name: 'Test Client User',
      email: 'test_client_user_unique@example.com',
      password: 'password123',
      role: 'Client'
    });

    console.log('Test fixtures created successfully.');

    const bookingDate = '2026-06-15';
    const slotTime = '14:00';

    // TEST 1: Block a slot using blockSlot controller
    console.log('\n--- Running TEST 1: Block Slot ---');
    const blockReq = {
      body: { bookingDate, slotTime },
      user: testExpertUser,
      app: {
        get(key) {
          if (key === 'io') {
            return {
              to(room) {
                return {
                  emit(event, data) {
                    console.log(`Socket.io Event Emitted: '${event}' to room '${room}' with data:`, data);
                  }
                };
              }
            };
          }
        }
      }
    };
    const blockRes = makeMockRes();

    await blockSlot(blockReq, blockRes);

    assert.strictEqual(blockRes.statusCode, 201, 'blockSlot should return status code 201');
    assert.strictEqual(blockRes.data.success, true, 'blockSlot response success should be true');

    // Verify it was created in Availability collection
    const blockRecord = await Availability.findOne({
      expert: testExpert._id,
      bookingDate,
      slotTime
    });
    assert.ok(blockRecord, 'Availability record should exist in the database');
    assert.strictEqual(blockRecord.notes, 'Blocked by Expert', 'Availability notes should default to Blocked by Expert');
    console.log('TEST 1 Passed: Slot successfully blocked and saved in Availability collection.');

    // TEST 2: Verify block appears in getBookedSlots
    console.log('\n--- Running TEST 2: Check getBookedSlots ---');
    const slotsReq = {
      params: {
        expertId: testExpert._id.toString(),
        date: bookingDate
      }
    };
    const slotsRes = makeMockRes();

    await getBookedSlots(slotsReq, slotsRes);

    assert.strictEqual(slotsRes.statusCode, 200, 'getBookedSlots should return status code 200');
    assert.strictEqual(slotsRes.data.success, true, 'getBookedSlots response success should be true');
    const matchedSlot = slotsRes.data.data.find(s => s.slotTime === slotTime);
    assert.ok(matchedSlot, 'Blocked slot should be listed in booked slots list');
    assert.strictEqual(matchedSlot.userName, 'Blocked Slot', 'userName should be "Blocked Slot"');
    assert.strictEqual(matchedSlot.notes, 'Blocked by Expert', 'notes should be "Blocked by Expert"');
    console.log('TEST 2 Passed: getBookedSlots returns the block conforming to the frontend contract.');

    // TEST 3: Attempting to book the blocked slot must fail
    console.log('\n--- Running TEST 3: Prevent Booking Blocked Slot ---');
    const bookReq = {
      body: {
        expert: testExpert._id.toString(),
        userName: 'Client Bob',
        userEmail: testClientUser.email,
        userPhone: '+919876543210',
        bookingDate,
        slotTime,
        notes: 'Trying to book a blocked slot'
      },
      user: testClientUser,
      headers: {},
      app: {
        get(key) {
          if (key === 'io') {
            return {
              to() { return { emit() {} }; }
            };
          }
        }
      }
    };
    const bookRes = makeMockRes();

    await createBooking(bookReq, bookRes);

    assert.strictEqual(bookRes.statusCode, 400, 'createBooking should reject blocked slot with 400 Bad Request');
    assert.strictEqual(bookRes.data.success, false, 'createBooking success should be false');
    assert.ok(bookRes.data.error.includes('blocked'), 'Error message should mention the slot is blocked');
    console.log('TEST 3 Passed: Booking a blocked slot was correctly rejected.');

    // TEST 4: Unblock the slot using unblockSlot controller
    console.log('\n--- Running TEST 4: Unblock Slot ---');
    const unblockReq = {
      body: { bookingDate, slotTime },
      user: testExpertUser,
      app: {
        get(key) {
          if (key === 'io') {
            return {
              to(room) {
                return {
                  emit(event, data) {
                    console.log(`Socket.io Event Emitted: '${event}' to room '${room}' with data:`, data);
                  }
                };
              }
            };
          }
        }
      }
    };
    const unblockRes = makeMockRes();

    await unblockSlot(unblockReq, unblockRes);

    assert.strictEqual(unblockRes.statusCode, 200, 'unblockSlot should return status code 200');
    assert.strictEqual(unblockRes.data.success, true, 'unblockSlot response success should be true');

    // Verify it was deleted from Availability collection
    const checkDeletedBlock = await Availability.findOne({
      expert: testExpert._id,
      bookingDate,
      slotTime
    });
    assert.strictEqual(checkDeletedBlock, null, 'Availability record should be deleted');
    console.log('TEST 4 Passed: Slot successfully unblocked and removed from Availability collection.');

    // TEST 5: Create a standard booking for the now open slot
    console.log('\n--- Running TEST 5: Book Standard Slot ---');
    const standardBookRes = makeMockRes();
    await createBooking(bookReq, standardBookRes);

    assert.strictEqual(standardBookRes.statusCode, 201, 'createBooking should return status code 201');
    assert.strictEqual(standardBookRes.data.success, true, 'createBooking success should be true');
    createdBookingId = standardBookRes.data.data._id;

    // Verify booking is in the Booking collection
    const bookingRecord = await Booking.findById(createdBookingId);
    assert.ok(bookingRecord, 'Booking record should exist in the database');
    assert.strictEqual(bookingRecord.userName, 'Client Bob', 'Booking userName matches');
    console.log('TEST 5 Passed: Standard booking created successfully after unblocking.');

    console.log('\nAll integration tests passed successfully!');

  } catch (err) {
    console.error('Integration test failed with error:');
    console.error(err);
    process.exitCode = 1;
  } finally {
    console.log('\nCleaning up test fixtures...');
    if (createdBookingId) {
      await Booking.deleteOne({ _id: createdBookingId });
    }
    if (testExpert) {
      await Expert.deleteOne({ _id: testExpert._id });
    }
    if (testExpertUser) {
      await User.deleteOne({ _id: testExpertUser._id });
    }
    if (testClientUser) {
      await User.deleteOne({ _id: testClientUser._id });
    }
    await mongoose.connection.close();
    console.log('Database connection closed.');
  }
};

runTests();
