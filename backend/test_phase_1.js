/**
 * test_phase_1.js
 * Verification test script for Phase 1: Config safety checks, PaymentLog model, and Webhook verification middleware.
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');

// Load environment
dotenv.config();

const PaymentLog = require('./src/models/PaymentLog');
const Booking = require('./src/models/Booking');
const Expert = require('./src/models/Expert');
const User = require('./src/models/User');
const { verifyWebhookSignature } = require('./src/middleware/webhookMiddleware');

const runTests = async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/skillsync';
  console.log(`Connecting to database at ${mongoUri}...`);
  await mongoose.connect(mongoUri);
  console.log('Database connected.');

  // Create temporary test references
  let clientUser, expertUser, expert, booking;

  try {
    console.log('\n--- Test 1: Mongoose PaymentLog Model Integration ---');
    clientUser = await User.create({
      name: 'Test Log Client',
      email: 'log_client@example.com',
      password: 'password123',
      role: 'Client'
    });

    expertUser = await User.create({
      name: 'Test Log Expert User',
      email: 'log_expert@example.com',
      password: 'password123',
      role: 'Expert'
    });

    expert = await Expert.create({
      name: 'Test Log Expert',
      category: 'Technology',
      experience: 4,
      description: 'Expert for payment log testing.',
      hourlyRate: 1200,
      user: expertUser._id
    });

    booking = await Booking.create({
      expert: expert._id,
      user: clientUser._id,
      userName: 'Test Log Client',
      userEmail: 'log_client@example.com',
      userPhone: '+919999999999',
      bookingDate: '2026-06-20',
      slotTime: '12:00',
      status: 'Confirmed'
    });

    const paymentLog = await PaymentLog.create({
      booking: booking._id,
      user: clientUser._id,
      razorpayOrderId: 'order_test_123',
      razorpayPaymentId: 'pay_test_123',
      amount: 120000,
      signature: 'mock_sig_123',
      status: 'captured'
    });

    assert.ok(paymentLog, 'PaymentLog record should be created successfully.');
    assert.strictEqual(paymentLog.amount, 120000, 'Logged amount should match.');
    assert.strictEqual(paymentLog.status, 'captured', 'Status should be captured.');
    console.log('PaymentLog Model test: PASSED');

    console.log('\n--- Test 2: PaymentLog Unique Index Check ---');
    try {
      await PaymentLog.create({
        booking: booking._id,
        user: clientUser._id,
        razorpayOrderId: 'order_test_456',
        razorpayPaymentId: 'pay_test_123', // Duplicate payment ID
        amount: 120000,
        signature: 'mock_sig_456',
        status: 'captured'
      });
      assert.fail('Should fail due to unique constraint on razorpayPaymentId.');
    } catch (err) {
      assert.ok(err.code === 11000, 'Error should be a MongoDB duplicate key error (code 11000).');
      console.log('PaymentLog Unique Index test: PASSED');
    }

    console.log('\n--- Test 3: Webhook Verification Middleware Validation ---');
    // Set custom webhook secret in environment for test run
    process.env.RAZORPAY_WEBHOOK_SECRET = 'secret_test_key_2026';
    const rawPayload = { event: 'payment.captured', data: { id: 'pay_123' } };
    
    // Calculate signature
    const validSignature = crypto
      .createHmac('sha256', 'secret_test_key_2026')
      .update(JSON.stringify(rawPayload))
      .digest('hex');

    // Mock Express request, response, and next
    const reqMockValid = {
      headers: { 'x-razorpay-signature': validSignature },
      body: rawPayload
    };
    
    let isNextCalled = false;
    const nextMock = () => { isNextCalled = true; };
    const resMock = {
      status(code) {
        this.statusCode = code;
        return { json(data) { this.jsonData = data; } };
      }
    };

    verifyWebhookSignature(reqMockValid, resMock, nextMock);
    assert.ok(isNextCalled, 'Next callback should be called for valid signatures.');
    console.log('Webhook valid signature test: PASSED');

    // Test invalid signature
    isNextCalled = false;
    const reqMockInvalid = {
      headers: { 'x-razorpay-signature': 'incorrect_signature_string' },
      body: rawPayload
    };
    
    verifyWebhookSignature(reqMockInvalid, resMock, nextMock);
    assert.strictEqual(isNextCalled, false, 'Next callback should not be called for invalid signatures.');
    assert.strictEqual(resMock.statusCode, 400, 'Should reject invalid signatures with code 400.');
    console.log('Webhook invalid signature test: PASSED');

  } catch (err) {
    console.error('Test Failed with Error:', err);
    process.exit(1);
  } finally {
    console.log('\nCleaning up database records...');
    await User.deleteMany({ email: { $in: ['log_client@example.com', 'log_expert@example.com'] } });
    await Expert.deleteMany({ name: 'Test Log Expert' });
    await Booking.deleteMany({ userEmail: 'log_client@example.com' });
    await PaymentLog.deleteMany({ razorpayPaymentId: 'pay_test_123' });
    await mongoose.disconnect();
    console.log('Teardown complete.');
    process.exit(0);
  }
};

runTests();
