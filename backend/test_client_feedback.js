/**
 * test_client_feedback.js
 * Integration test suite for the Two-Sided P2P Feedback System.
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
const ClientReview = require('./src/models/ClientReview');

const { rateClient } = require('./src/controllers/expertDashboardController');

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

const runTests = async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/skillsync';
  console.log(`Connecting to ${mongoUri}...`);
  await mongoose.connect(mongoUri);
  console.log('Database connected.');

  let hostExpertUser = null;
  let hostExpert = null;
  let otherExpertUser = null;
  let otherExpert = null;
  let testClientUser = null;

  try {
    // Proactively clean up any left-over test fixtures from previous failed runs
    await User.deleteMany({ email: { $in: ['feedback_expert@example.com', 'other_expert@example.com', 'feedback_client@example.com'] } });
    await Expert.deleteMany({ name: { $in: ['Host Expert', 'Other Expert'] } });
    await ClientReview.deleteMany({});

    // Setup users & profiles
    hostExpertUser = await User.create({
      name: 'Host Expert User',
      email: 'feedback_expert@example.com',
      password: 'password123',
      role: 'Expert'
    });

    hostExpert = await Expert.create({
      name: 'Host Expert',
      category: 'Technology',
      experience: 5,
      description: 'Host expert for client rating testing.',
      hourlyRate: 1500,
      user: hostExpertUser._id
    });

    otherExpertUser = await User.create({
      name: 'Other Expert User',
      email: 'other_expert@example.com',
      password: 'password123',
      role: 'Expert'
    });

    otherExpert = await Expert.create({
      name: 'Other Expert',
      category: 'Technology',
      experience: 8,
      description: 'Other expert for client rating testing.',
      hourlyRate: 2000,
      user: otherExpertUser._id
    });

    testClientUser = await User.create({
      name: 'Test Client',
      email: 'feedback_client@example.com',
      password: 'password123',
      role: 'Client',
      rating: 5.0,
      numReviews: 0
    });

    console.log('Seeded test environment users and profiles.');

    // -------------------------------------------------------------
    // Test Case 1: Reject rating a client on a Confirmed booking (not completed)
    // -------------------------------------------------------------
    console.log('\nRunning Test Case 1: Reject client rating on non-completed booking...');
    const pastSlot1 = getISTStringsForOffset(-3 * 60 * 60 * 1000); // 3 hours ago
    const booking1 = await Booking.create({
      expert: hostExpert._id,
      user: testClientUser._id,
      userName: testClientUser.name,
      userEmail: testClientUser.email,
      userPhone: '+919876543210',
      bookingDate: pastSlot1.bookingDate,
      slotTime: pastSlot1.slotTime,
      status: 'Confirmed'
    });

    const req1 = {
      body: { rating: 4, comment: 'Good client.' },
      params: { id: booking1._id.toString() },
      user: hostExpertUser
    };
    const res1 = makeMockRes();

    await rateClient(req1, res1);
    assert.strictEqual(res1.statusCode, 400);
    assert.match(res1.data.error, /only rate completed sessions/);
    console.log('✔ Test Case 1 Passed.');

    // -------------------------------------------------------------
    // Test Case 2: Reject rating if requested by a non-host Expert
    // -------------------------------------------------------------
    console.log('\nRunning Test Case 2: Reject client rating from non-host expert...');
    // Set booking status to Completed manually for testing
    booking1.status = 'Completed';
    await booking1.save();

    const req2 = {
      body: { rating: 4, comment: 'Good client.' },
      params: { id: booking1._id.toString() },
      user: otherExpertUser // Different expert
    };
    const res2 = makeMockRes();

    await rateClient(req2, res2);
    assert.strictEqual(res2.statusCode, 401);
    assert.match(res2.data.error, /Not authorized to rate/);
    console.log('✔ Test Case 2 Passed.');

    // -------------------------------------------------------------
    // Test Case 3: Allow rating from host Expert & verify ratings update
    // -------------------------------------------------------------
    console.log('\nRunning Test Case 3: Allow rating from host expert & check averages...');
    const req3 = {
      body: { rating: 4, comment: 'Punctual and focused.' },
      params: { id: booking1._id.toString() },
      user: hostExpertUser
    };
    const res3 = makeMockRes();

    await rateClient(req3, res3);
    assert.strictEqual(res3.statusCode, 200);
    assert.strictEqual(res3.data.success, true);

    // Verify rating document was created
    const createdReview = await ClientReview.findOne({ booking: booking1._id });
    assert.ok(createdReview);
    assert.strictEqual(createdReview.rating, 4);
    assert.strictEqual(createdReview.comment, 'Punctual and focused.');

    // Verify client user average was updated
    const updatedClient = await User.findById(testClientUser._id);
    // Initial was 5.0 rating with 0 reviews.
    // New average: ((5.0 * 0) + 4) / 1 = 4.0
    assert.strictEqual(updatedClient.numReviews, 1);
    assert.strictEqual(updatedClient.rating, 4.0);

    // Verify booking is marked as client-rated
    const updatedBooking1 = await Booking.findById(booking1._id);
    assert.strictEqual(updatedBooking1.isClientRated, true);
    console.log('✔ Test Case 3 Passed.');

    // -------------------------------------------------------------
    // Test Case 4: Reject double rating the same booking
    // -------------------------------------------------------------
    console.log('\nRunning Test Case 4: Block double rating the same booking...');
    const req4 = {
      body: { rating: 5, comment: 'Try to rate again.' },
      params: { id: booking1._id.toString() },
      user: hostExpertUser
    };
    const res4 = makeMockRes();

    await rateClient(req4, res4);
    assert.strictEqual(res4.statusCode, 400);
    assert.match(res4.data.error, /already been rated/);
    console.log('✔ Test Case 4 Passed.');

    // -------------------------------------------------------------
    // Test Case 5: Verify rolling average math with a second completed booking
    // -------------------------------------------------------------
    console.log('\nRunning Test Case 5: Verify rolling average with a second session...');
    const pastSlot2 = getISTStringsForOffset(-2 * 60 * 60 * 1000); // 2 hours ago
    const booking2 = await Booking.create({
      expert: hostExpert._id,
      user: testClientUser._id,
      userName: testClientUser.name,
      userEmail: testClientUser.email,
      userPhone: '+919876543210',
      bookingDate: pastSlot2.bookingDate,
      slotTime: pastSlot2.slotTime,
      status: 'Completed'
    });

    const req5 = {
      body: { rating: 5, comment: 'Exceptional dialogue!' },
      params: { id: booking2._id.toString() },
      user: hostExpertUser
    };
    const res5 = makeMockRes();

    await rateClient(req5, res5);
    assert.strictEqual(res5.statusCode, 200);

    // Check rolling average:
    // Existing average was 4.0 with 1 review.
    // New review: 5 rating.
    // New average: ((4.0 * 1) + 5) / 2 = 4.5
    const finalClient = await User.findById(testClientUser._id);
    assert.strictEqual(finalClient.numReviews, 2);
    assert.strictEqual(finalClient.rating, 4.5);
    console.log('✔ Test Case 5 Passed.');

    // -------------------------------------------------------------
    // Test Case 6: Reject invalid rating limits
    // -------------------------------------------------------------
    console.log('\nRunning Test Case 6: Verify rating validation rules...');
    const pastSlot3 = getISTStringsForOffset(-1 * 60 * 60 * 1000); // 1 hour ago
    const booking3 = await Booking.create({
      expert: hostExpert._id,
      user: testClientUser._id,
      userName: testClientUser.name,
      userEmail: testClientUser.email,
      userPhone: '+919876543210',
      bookingDate: pastSlot3.bookingDate,
      slotTime: pastSlot3.slotTime,
      status: 'Completed'
    });

    // Case A: rating too high (6)
    const req6A = {
      body: { rating: 6 },
      params: { id: booking3._id.toString() },
      user: hostExpertUser
    };
    const res6A = makeMockRes();
    await rateClient(req6A, res6A);
    assert.strictEqual(res6A.statusCode, 400);

    // Case B: rating too low (0)
    const req6B = {
      body: { rating: 0 },
      params: { id: booking3._id.toString() },
      user: hostExpertUser
    };
    const res6B = makeMockRes();
    await rateClient(req6B, res6B);
    assert.strictEqual(res6B.statusCode, 400);
    console.log('✔ Test Case 6 Passed.');

    console.log('\nAll 6 Feedback Integration Tests PASSED successfully.');
  } finally {
    // Teardown connections and files
    await User.deleteMany({ email: { $in: ['feedback_expert@example.com', 'other_expert@example.com', 'feedback_client@example.com'] } });
    await Expert.deleteMany({ name: { $in: ['Host Expert', 'Other Expert'] } });
    await ClientReview.deleteMany({});
    await Booking.deleteMany({ userEmail: 'feedback_client@example.com' });
    await mongoose.disconnect();
    console.log('Database disconnected.');
  }
};

runTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
