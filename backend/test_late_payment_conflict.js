/**
 * test_late_payment_conflict.js
 * Verification test script for late payment conflict resolution and automatic refunds.
 */

// Mock Razorpay module
const mockRazorpayInstance = {
  payments: {
    refund: async (paymentId, payload) => {
      global.refundApiCalled = true;
      global.refundPaymentIdArg = paymentId;
      return { id: 'rfnd_conflict_mock_123', amount: payload.amount };
    }
  }
};

function MockRazorpay() {
  return mockRazorpayInstance;
}

require.cache[require.resolve('razorpay')] = {
  exports: MockRazorpay
};

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const assert = require('assert');

// Load environment
dotenv.config();

const PaymentLog = require('./src/models/PaymentLog');
const Booking = require('./src/models/Booking');
const Expert = require('./src/models/Expert');
const User = require('./src/models/User');
const { verifyPayment } = require('./src/controllers/bookingController');

const runTests = async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/skillsync';
  console.log(`Connecting to database at ${mongoUri}...`);
  await mongoose.connect(mongoUri);
  console.log('Database connected.');

  // Clean up
  await User.deleteMany({ email: { $in: ['conflict_c1@example.com', 'conflict_c2@example.com', 'conflict_e@example.com'] } });
  await Expert.deleteMany({ name: 'Test Conflict Expert' });
  await Booking.deleteMany({ userEmail: { $in: ['conflict_c1@example.com', 'conflict_c2@example.com'] } });
  await PaymentLog.deleteMany({ razorpayPaymentId: 'pay_conflict_123' });

  let client1, client2, expertUser, expert, booking1, booking2;

  try {
    console.log('\n--- Test 1: Setup Testing Context ---');
    client1 = await User.create({
      name: 'Client 1 (Late Buyer)',
      email: 'conflict_c1@example.com',
      password: 'password123',
      role: 'Client'
    });

    client2 = await User.create({
      name: 'Client 2 (Quick Buyer)',
      email: 'conflict_c2@example.com',
      password: 'password123',
      role: 'Client'
    });

    expertUser = await User.create({
      name: 'Expert User',
      email: 'conflict_e@example.com',
      password: 'password123',
      role: 'Expert'
    });

    expert = await Expert.create({
      name: 'Test Conflict Expert',
      category: 'Technology',
      experience: 5,
      description: 'Expert for testing late payment conflicts.',
      hourlyRate: 1000,
      user: expertUser._id
    });

    // 1. Create first booking (expired/cancelled)
    booking1 = await Booking.create({
      expert: expert._id,
      user: client1._id,
      userName: 'Client 1',
      userEmail: 'conflict_c1@example.com',
      userPhone: '+919999999999',
      bookingDate: '2026-08-10',
      slotTime: '11:00',
      status: 'Cancelled', // Simulated expiration
      razorpayOrderId: 'order_conflict_123'
    });

    // 2. Create second booking (takes the slot)
    booking2 = await Booking.create({
      expert: expert._id,
      user: client2._id,
      userName: 'Client 2',
      userEmail: 'conflict_c2@example.com',
      userPhone: '+918888888888',
      bookingDate: '2026-08-10',
      slotTime: '11:00',
      status: 'Confirmed', // Confirmed booking occupying the slot
      razorpayOrderId: 'order_conflict_456'
    });

    console.log('Setup successfully completed.');

    console.log('\n--- Test 2: Verify Payment for Cancelled Booking with Slot Conflict ---');
    
    // Reset spy variables
    global.refundApiCalled = false;
    global.refundPaymentIdArg = '';

    const reqMock = {
      body: {
        bookingId: booking1._id.toString(),
        razorpayPaymentId: 'pay_conflict_123',
        razorpayOrderId: 'order_conflict_123',
        razorpaySignature: 'valid_sig_check'
      },
      user: client1,
      app: {
        get(key) { return null; }
      }
    };

    // Override signature check in verifyPayment for test simplicity
    process.env.RAZORPAY_KEY_SECRET = 'q6b9PELyNv7q4DNX2rGNEX9V';
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    hmac.update('order_conflict_123|pay_conflict_123');
    reqMock.body.razorpaySignature = hmac.digest('hex');

    const resMock = {
      statusCode: null,
      jsonData: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.jsonData = data;
        return this;
      }
    };

    await verifyPayment(reqMock, resMock);

    assert.strictEqual(resMock.statusCode, 409, 'Should return 409 Conflict status.');
    assert.strictEqual(resMock.jsonData.success, false, 'Success should be false.');
    assert.strictEqual(resMock.jsonData.error.includes('already booked'), true, 'Error message should explain slot was already booked.');

    // Verify first booking remains Cancelled
    const updatedBooking1 = await Booking.findById(booking1._id);
    assert.strictEqual(updatedBooking1.status, 'Cancelled', 'First booking must remain Cancelled.');

    // Verify PaymentLog is logged with status 'refunded'
    const log = await PaymentLog.findOne({ razorpayPaymentId: 'pay_conflict_123' });
    assert.ok(log, 'PaymentLog record must be written.');
    assert.strictEqual(log.status, 'refunded', 'Logged status should be refunded.');

    // Verify automatic refund was triggered
    assert.strictEqual(global.refundApiCalled, true, 'Automatic Razorpay refund should be triggered.');
    assert.strictEqual(global.refundPaymentIdArg, 'pay_conflict_123', 'Should refund the correct payment ID.');
    console.log('Late Payment Conflict & Auto-Refund: PASSED');

  } catch (err) {
    console.error('Test Failed with Error:', err);
    process.exit(1);
  } finally {
    console.log('\nCleaning up database records...');
    await User.deleteMany({ email: { $in: ['conflict_c1@example.com', 'conflict_c2@example.com', 'conflict_e@example.com'] } });
    await Expert.deleteMany({ name: 'Test Conflict Expert' });
    await Booking.deleteMany({ userEmail: { $in: ['conflict_c1@example.com', 'conflict_c2@example.com'] } });
    await PaymentLog.deleteMany({ razorpayPaymentId: 'pay_conflict_123' });
    await mongoose.disconnect();
    console.log('Teardown complete.');
    process.exit(0);
  }
};

runTests();
