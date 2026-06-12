// Ensure necessary environment variables exist
process.env.JWT_SECRET = 'test_secret';
process.env.RAZORPAY_KEY_ID = 'test_key_id';
process.env.RAZORPAY_KEY_SECRET = 'test_key_secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'test_webhook_secret_123';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const crypto = require('crypto');
const { app } = require('../../src/app');
const Booking = require('../../src/models/Booking');
const Expert = require('../../src/models/Expert');
const User = require('../../src/models/User');

let mongoServer;

describe('Feature 2.4: Webhook State Mutations Integration', () => {
  let expertProfile, clientUser, pendingBookingId;
  const RAZORPAY_ORDER_ID = 'order_webhook_123';

  beforeAll(async () => {
    mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    const uri = mongoServer.getUri();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(uri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    // Clean DB
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany();
    }

    // Seed Data
    const expertUser = await User.create({
      name: 'Dr. Webhook',
      email: 'webhook@expert.com',
      password: 'password123',
      role: 'Expert'
    });
    expertProfile = await Expert.create({
      user: expertUser._id,
      name: expertUser.name,
      category: 'Technology',
      experience: 10,
      hourlyRate: 2000,
      description: 'Webhook Handler'
    });

    clientUser = await User.create({
      name: 'Client Hook',
      email: 'hook@client.com',
      password: 'password123',
      role: 'Client'
    });

    // Directly seed a Pending Booking in MongoDB
    const booking = await Booking.create({
      expert: expertProfile._id,
      user: clientUser._id,
      userName: clientUser.name,
      userEmail: clientUser.email,
      userPhone: '+919876543210',
      bookingDate: '2024-12-25',
      slotTime: '15:00',
      status: 'Pending',
      razorpayOrderId: RAZORPAY_ORDER_ID
    });
    pendingBookingId = booking._id;
  });

  /** Helper to generate valid Razorpay signatures */
  const generateSignature = (payloadObj) => {
    const payloadStr = JSON.stringify(payloadObj);
    return crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(payloadStr)
      .digest('hex');
  };

  it('INT-WEBHOOK-01: Should reject webhook if x-razorpay-signature is missing', async () => {
    const payload = { event: 'order.paid' };

    const response = await request(app)
      .post('/bookings/webhook')
      .send(payload); // No headers

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/Missing webhook signature header/i);

    const booking = await Booking.findById(pendingBookingId);
    expect(booking.status).toBe('Pending'); // Unchanged
  });

  it('INT-WEBHOOK-02: Should reject webhook if x-razorpay-signature is invalid', async () => {
    const payload = { event: 'order.paid' };

    const response = await request(app)
      .post('/bookings/webhook')
      .set('x-razorpay-signature', 'invalid_fake_signature_hash_12345')
      .send(payload);

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/Invalid webhook signature/i);

    const booking = await Booking.findById(pendingBookingId);
    expect(booking.status).toBe('Pending'); // Unchanged
  });

  it('INT-WEBHOOK-03: Should mutate state to Confirmed upon valid payment.captured event', async () => {
    const payload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            order_id: RAZORPAY_ORDER_ID,
            id: 'pay_capture_123'
          }
        }
      }
    };
    const validSignature = generateSignature(payload);

    const response = await request(app)
      .post('/bookings/webhook')
      .set('x-razorpay-signature', validSignature)
      .send(payload);

    // Endpoint returns 200 on successful webhook consumption
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const booking = await Booking.findById(pendingBookingId);
    expect(booking.status).toBe('Confirmed'); // DB safely Mutated!
  });

  it('INT-WEBHOOK-04: Should mutate state to Cancelled upon valid payment.failed event', async () => {
    const payload = {
      event: 'payment.failed',
      payload: {
        payment: {
          entity: {
            order_id: RAZORPAY_ORDER_ID,
            id: 'pay_fail_123'
          }
        }
      }
    };
    const validSignature = generateSignature(payload);

    const response = await request(app)
      .post('/bookings/webhook')
      .set('x-razorpay-signature', validSignature)
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.cancelled).toBe(true);

    const booking = await Booking.findById(pendingBookingId);
    expect(booking.status).toBe('Cancelled'); // DB safely Mutated!
  });
});
