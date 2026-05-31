/**
 * test_phase_2.js
 * Verification test script for Phase 2: Webhook Endpoint Integration, Asynchronous Confirmation, and Idempotency Guard.
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const assert = require('assert');
const crypto = require('crypto');

// Load environment
dotenv.config();

const PaymentLog = require('./src/models/PaymentLog');
const Booking = require('./src/models/Booking');
const Expert = require('./src/models/Expert');
const User = require('./src/models/User');
const { handleWebhook, verifyPayment } = require('./src/controllers/bookingController');

const runTests = async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/skillsync';
  console.log(`Connecting to database at ${mongoUri}...`);
  await mongoose.connect(mongoUri);
  console.log('Database connected.');

  // Create temporary test references
  let clientUser, expertUser, expert, booking;

  try {
    console.log('\n--- Test 1: Setup Booking and Webhook Context ---');
    clientUser = await User.create({
      name: 'Test Phase 2 Client',
      email: 'phase2_client@example.com',
      password: 'password123',
      role: 'Client'
    });

    expertUser = await User.create({
      name: 'Test Phase 2 Expert User',
      email: 'phase2_expert@example.com',
      password: 'password123',
      role: 'Expert'
    });

    expert = await Expert.create({
      name: 'Test Phase 2 Expert',
      category: 'Technology',
      experience: 5,
      description: 'Expert for phase 2 webhook testing.',
      hourlyRate: 1500,
      user: expertUser._id
    });

    booking = await Booking.create({
      expert: expert._id,
      user: clientUser._id,
      userName: 'Test Phase 2 Client',
      userEmail: 'phase2_client@example.com',
      userPhone: '+919999999999',
      bookingDate: '2026-06-25',
      slotTime: '14:00',
      status: 'Pending',
      razorpayOrderId: 'order_phase2_test'
    });

    assert.strictEqual(booking.status, 'Pending', 'Initial booking should be Pending.');
    console.log('Setup successfully completed.');

    console.log('\n--- Test 2: Asynchronous Webhook Payment Confirmation ---');
    // Configure webhook secret
    process.env.RAZORPAY_WEBHOOK_SECRET = 'webhook_secret_p2';
    
    const webhookPayload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_phase2_123',
            order_id: 'order_phase2_test'
          }
        }
      }
    };

    // Calculate cryptographic signature from raw body
    const validSignature = crypto
      .createHmac('sha256', 'webhook_secret_p2')
      .update(JSON.stringify(webhookPayload))
      .digest('hex');

    // Mock Express Request
    const reqMock = {
      headers: {
        'x-razorpay-signature': validSignature
      },
      body: webhookPayload,
      app: {
        get(key) {
          if (key === 'io') return null; // Mock Socket.io as null for this test
          return null;
        }
      }
    };

    // Mock Express Response
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

    await handleWebhook(reqMock, resMock);

    assert.strictEqual(resMock.statusCode, 200, 'Webhook response status should be 200.');
    assert.strictEqual(resMock.jsonData.success, true, 'Webhook operation success flag should be true.');

    // Fetch updated booking
    const updatedBooking = await Booking.findById(booking._id);
    assert.strictEqual(updatedBooking.status, 'Confirmed', 'Booking status should be Confirmed asynchronously by Webhook.');

    // Verify Payment Log created
    const log = await PaymentLog.findOne({ razorpayPaymentId: 'pay_phase2_123' });
    assert.ok(log, 'PaymentLog record should have been written to the database.');
    assert.strictEqual(log.razorpayOrderId, 'order_phase2_test', 'PaymentLog Order ID should match.');
    assert.strictEqual(log.amount, 150000, 'Logged amount should match in paise.');
    console.log('Asynchronous Webhook Confirmation: PASSED');

    console.log('\n--- Test 3: Idempotency Locks Protection ---');
    // Reset mock response status
    resMock.statusCode = null;
    resMock.jsonData = null;

    // Call webhook again with the same payload
    await handleWebhook(reqMock, resMock);

    assert.strictEqual(resMock.statusCode, 200, 'Duplicate webhook should be processed successfully with status 200.');
    assert.strictEqual(resMock.jsonData.alreadyProcessed, true, 'Duplicate payload should flag alreadyProcessed as true.');

    // Verify only one Payment Log exists for this payment ID
    const count = await PaymentLog.countDocuments({ razorpayPaymentId: 'pay_phase2_123' });
    assert.strictEqual(count, 1, 'Only one payment log should exist. Duplicate logs prevented.');
    console.log('Idempotency Locks Protection: PASSED');

  } catch (err) {
    console.error('Test Failed with Error:', err);
    process.exit(1);
  } finally {
    console.log('\nCleaning up database records...');
    await User.deleteMany({ email: { $in: ['phase2_client@example.com', 'phase2_expert@example.com'] } });
    await Expert.deleteMany({ name: 'Test Phase 2 Expert' });
    await Booking.deleteMany({ userEmail: 'phase2_client@example.com' });
    await PaymentLog.deleteMany({ razorpayPaymentId: 'pay_phase2_123' });
    await mongoose.disconnect();
    console.log('Teardown complete.');
    process.exit(0);
  }
};

runTests();
