// Ensure necessary environment variables exist before requiring app.js
process.env.JWT_SECRET = 'test_secret';
process.env.RAZORPAY_KEY_ID = 'test_key_id';
process.env.RAZORPAY_KEY_SECRET = 'test_key_secret';
process.env.NODE_ENV = 'test';

// Mock Razorpay SDK to simulate external success and failures
const mockOrdersCreate = jest.fn();
jest.mock('razorpay', () => {
  return jest.fn().mockImplementation(() => {
    return {
      orders: {
        create: mockOrdersCreate
      }
    };
  });
});

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { app } = require('../../src/app');
const Booking = require('../../src/models/Booking');
const Expert = require('../../src/models/Expert');
const User = require('../../src/models/User');
const Availability = require('../../src/models/Availability');

let mongoServer;

describe('Feature 2.2: Booking Transaction Rollbacks Integration', () => {
  let expertUser, expertProfile, clientUser, clientToken;

  // Setup: Start Memory Server and connect Mongoose
  beforeAll(async () => {
    mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    const uri = mongoServer.getUri();
    
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(uri);
  });

  // Setup: Seed database before EACH test
  beforeEach(async () => {
    jest.clearAllMocks();

    // Clean DB
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany();
    }

    // Ensure indexes are built to test unique constraint in Race Condition
    await Booking.createIndexes();

    // 1. Create an Expert User and Profile
    expertUser = await User.create({
      name: 'Dr. Jane',
      email: 'jane@expert.com',
      password: 'password123',
      role: 'Expert'
    });
    expertProfile = await Expert.create({
      user: expertUser._id,
      name: expertUser.name,
      category: 'Technology',
      experience: 5,
      hourlyRate: 1500,
      description: 'Expert in Node.js'
    });

    // 2. Create a Client User
    clientUser = await User.create({
      name: 'Client Bob',
      email: 'bob@client.com',
      password: 'password123',
      role: 'Client'
    });

    // Login client to get token
    const loginRes = await request(app).post('/auth/login').send({
      email: 'bob@client.com',
      password: 'password123'
    });
    clientToken = loginRes.body.token;
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  // INT-BOOK-01
  it('INT-BOOK-01: Should successfully create booking and persist when Razorpay succeeds', async () => {
    // Mock Razorpay success
    mockOrdersCreate.mockResolvedValueOnce({ id: 'order_123', amount: 150000 });

    const payload = {
      expert: expertProfile._id,
      userName: 'Client Bob',
      userEmail: 'bob@client.com',
      userPhone: '+919876543210',
      bookingDate: '2024-12-01',
      slotTime: '10:00'
    };

    const response = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${clientToken}`)
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.razorpayOrderId).toBe('order_123');

    // DB Assertion
    const bookings = await Booking.find();
    expect(bookings.length).toBe(1);
    expect(bookings[0].razorpayOrderId).toBe('order_123');
  });

  // INT-BOOK-02
  it('INT-BOOK-02: Should rollback MongoDB transaction completely if Razorpay throws an error', async () => {
    // Mock Razorpay failure
    mockOrdersCreate.mockRejectedValueOnce(new Error('Razorpay Network Failure'));

    const payload = {
      expert: expertProfile._id,
      userName: 'Client Bob',
      userEmail: 'bob@client.com',
      userPhone: '+919876543210',
      bookingDate: '2024-12-02',
      slotTime: '11:00'
    };

    const response = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${clientToken}`)
      .send(payload);

    expect(response.status).toBe(400); // Controller catches and returns 400
    expect(response.body.success).toBe(false);

    // DB Assertion (Transaction must abort)
    const bookings = await Booking.find();
    expect(bookings.length).toBe(0); // Phantom booking avoided!
  });

  // INT-BOOK-03
  it('INT-BOOK-03: Should reject booking and rollback if slot is explicitly blocked in Availability collection', async () => {
    // Seed blocked slot
    await Availability.create({
      expert: expertProfile._id,
      bookingDate: '2024-12-03',
      slotTime: '12:00'
    });

    const payload = {
      expert: expertProfile._id,
      userName: 'Client Bob',
      userEmail: 'bob@client.com',
      userPhone: '+919876543210',
      bookingDate: '2024-12-03',
      slotTime: '12:00'
    };

    const response = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${clientToken}`)
      .send(payload);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toMatch(/blocked by the expert/i);

    // DB Assertion
    const bookings = await Booking.find();
    expect(bookings.length).toBe(0);
  });

  // INT-BOOK-04
  it('INT-BOOK-04: Should gracefully handle race conditions (simultaneous bookings to same slot)', async () => {
    mockOrdersCreate.mockResolvedValue({ id: 'order_race', amount: 150000 });

    const payload1 = {
      expert: expertProfile._id,
      userName: 'Client Bob 1',
      userEmail: 'bob1@client.com',
      userPhone: '+919876543210',
      bookingDate: '2024-12-04',
      slotTime: '14:00'
    };

    const payload2 = {
      expert: expertProfile._id,
      userName: 'Client Bob 2',
      userEmail: 'bob2@client.com',
      userPhone: '+919876543210',
      bookingDate: '2024-12-04', // SAME SLOT
      slotTime: '14:00'
    };

    // Fire identical requests simultaneously
    const [res1, res2] = await Promise.all([
      request(app).post('/bookings').set('Authorization', `Bearer ${clientToken}`).send(payload1),
      request(app).post('/bookings').set('Authorization', `Bearer ${clientToken}`).send(payload2)
    ]);

    // One must succeed, one must fail
    const statuses = [res1.status, res2.status].sort();
    expect(statuses[0]).toBe(201); // First succeeds
    expect(statuses[1]).toBe(400); // Second is caught by transaction conflict

    // DB Assertion
    const bookings = await Booking.find();
    expect(bookings.length).toBe(1); // Only ONE was written
  });
});
