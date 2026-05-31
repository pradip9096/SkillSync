/**
 * test_phase_3.js
 * Verification test script for Phase 3: Multi-document Transactions and Programmatic Refunds.
 */

// Mock Razorpay module before requiring the controller
const mockRazorpayInstance = {
  orders: {
    create: async (params) => {
      if (global.mockOrderFail) {
        throw new Error('Mock Order Creation Failure');
      }
      return { id: 'order_mock_123', amount: params.amount };
    }
  },
  payments: {
    refund: async (paymentId, payload) => {
      global.refundApiCalled = true;
      global.refundPaymentIdArg = paymentId;
      return { id: 'rfnd_mock_999', amount: payload.amount };
    }
  }
};

function MockRazorpay() {
  return mockRazorpayInstance;
}

require.cache[require.resolve('razorpay')] = {
  exports: MockRazorpay
};

// Require dependencies
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const assert = require('assert');

// Load environment
dotenv.config();

const PaymentLog = require('./src/models/PaymentLog');
const Booking = require('./src/models/Booking');
const Expert = require('./src/models/Expert');
const User = require('./src/models/User');
const { createBooking, updateBookingStatus } = require('./src/controllers/bookingController');

const runTests = async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/skillsync';
  console.log(`Connecting to database at ${mongoUri}...`);
  await mongoose.connect(mongoUri);
  console.log('Database connected.');

  // Clean up any stale records from previous failed runs first
  console.log('Performing pre-test database cleanup...');
  await User.deleteMany({ email: { $in: ['phase3_client@example.com', 'phase3_expert@example.com'] } });
  await Expert.deleteMany({ name: 'Test Phase 3 Expert' });
  await Booking.deleteMany({ userEmail: 'phase3_client@example.com' });
  await PaymentLog.deleteMany({ razorpayOrderId: 'order_refund_test' });
  await PaymentLog.deleteMany({ razorpayPaymentId: 'rfnd_mock_999' });

  // Create temporary test references
  let clientUser, expertUser, expert, booking;

  try {
    console.log('\n--- Test 1: Setup Testing Context ---');
    clientUser = await User.create({
      name: 'Test Phase 3 Client',
      email: 'phase3_client@example.com',
      password: 'password123',
      role: 'Client'
    });

    expertUser = await User.create({
      name: 'Test Phase 3 Expert User',
      email: 'phase3_expert@example.com',
      password: 'password123',
      role: 'Expert'
    });

    expert = await Expert.create({
      name: 'Test Phase 3 Expert',
      category: 'Technology',
      experience: 6,
      description: 'Expert for phase 3 transaction/refund testing.',
      hourlyRate: 2000,
      user: expertUser._id
    });

    console.log('Setup completed.');

    console.log('\n--- Test 2: Mongoose Multi-document Transaction Rolldown ---');
    
    // Enable mock order failure
    global.mockOrderFail = true;

    // Attempt to create booking
    const reqCreate = {
      body: {
        expert: expert._id,
        userName: 'Test Phase 3 Client',
        userEmail: 'phase3_client@example.com',
        userPhone: '+919999999999',
        bookingDate: '2026-07-10',
        slotTime: '15:00',
        notes: 'Transaction test'
      },
      user: clientUser,
      app: {
        get(key) { return null; }
      }
    };

    const resCreate = {
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

    await createBooking(reqCreate, resCreate);

    assert.strictEqual(resCreate.statusCode, 400, 'Creation should fail with 400.');
    assert.strictEqual(resCreate.jsonData.error, 'Mock Order Creation Failure', 'Should return the correct error message.');
    
    // Verify booking is not present in database (proved transaction rolled back!)
    const rolledBackBooking = await Booking.findOne({ userEmail: 'phase3_client@example.com', slotTime: '15:00' });
    assert.strictEqual(rolledBackBooking, null, 'Booking must be rolled back and not exist in database.');
    console.log('Mongoose Multi-document Transaction Rolldown: PASSED');

    console.log('\n--- Test 3: Programmatic Refund Workflow Check ---');
    
    // Create an actual booking to confirm and cancel
    booking = await Booking.create({
      expert: expert._id,
      user: clientUser._id,
      userName: 'Test Phase 3 Client',
      userEmail: 'phase3_client@example.com',
      userPhone: '+919999999999',
      bookingDate: '2026-07-20',
      slotTime: '10:00',
      status: 'Confirmed', // must be Confirmed to trigger a refund
      razorpayOrderId: 'order_refund_test'
    });

    // Write a mock capture log
    const paymentRecord = await PaymentLog.create({
      booking: booking._id,
      user: clientUser._id,
      razorpayOrderId: 'order_refund_test',
      razorpayPaymentId: 'pay_refund_captured_123',
      amount: 200000,
      signature: 'sig_refund_captured_123',
      status: 'captured'
    });

    // Reset tracker variables
    global.refundApiCalled = false;
    global.refundPaymentIdArg = '';
    global.mockOrderFail = false;

    // Trigger Cancelled status change request (session is far in the future, so standard Cancelled applies)
    const reqCancel = {
      params: { id: booking._id.toString() },
      body: { status: 'Cancelled' },
      user: clientUser,
      app: {
        get(key) { return null; }
      }
    };

    const resCancel = {
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

    await updateBookingStatus(reqCancel, resCancel);

    assert.strictEqual(resCancel.statusCode, 200, 'Cancellation should be processed with 200 status.');
    assert.strictEqual(global.refundApiCalled, true, 'Razorpay payments.refund should be programmatically called.');
    assert.strictEqual(global.refundPaymentIdArg, 'pay_refund_captured_123', 'Should refund the captured transaction ID.');

    // Check if new PaymentLog for refunded is written
    const refundLog = await PaymentLog.findOne({ razorpayPaymentId: 'rfnd_mock_999' });
    assert.ok(refundLog, 'Refund record should be logged to the database.');
    assert.strictEqual(refundLog.status, 'refunded', 'Logged status should be refunded.');

    // Verify booking is Cancelled in database
    const cancelledBooking = await Booking.findById(booking._id);
    assert.strictEqual(cancelledBooking.status, 'Cancelled', 'Booking status must be updated to Cancelled.');
    console.log('Programmatic Refund Workflow Check: PASSED');

  } catch (err) {
    console.error('Test Failed with Error:', err);
    process.exit(1);
  } finally {
    console.log('\nCleaning up database records...');
    await User.deleteMany({ email: { $in: ['phase3_client@example.com', 'phase3_expert@example.com'] } });
    await Expert.deleteMany({ name: 'Test Phase 3 Expert' });
    await Booking.deleteMany({ userEmail: 'phase3_client@example.com' });
    await PaymentLog.deleteMany({ razorpayPaymentId: { $in: ['pay_refund_captured_123', 'rfnd_mock_999'] } });
    await mongoose.disconnect();
    console.log('Teardown complete.');
    process.exit(0);
  }
};

runTests();
