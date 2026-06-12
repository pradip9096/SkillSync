// Ensure necessary environment variables exist
process.env.JWT_SECRET = 'test_secret';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { app } = require('../../src/app');
const Expert = require('../../src/models/Expert');
const User = require('../../src/models/User');
const Booking = require('../../src/models/Booking');
const Review = require('../../src/models/Review');

let mongoServer;

describe('Feature 2.6: Review Aggregation Integration', () => {
  let expertUser, expertProfile;
  let client1, clientToken1;
  let client2, clientToken2;
  let completedBookingId1, completedBookingId2, pendingBookingId;

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

    // Seed Expert
    expertUser = await User.create({
      name: 'Dr. Reviewer',
      email: 'review@expert.com',
      password: 'password123',
      role: 'Expert'
    });
    expertProfile = await Expert.create({
      user: expertUser._id,
      name: expertUser.name,
      category: 'Design',
      experience: 5,
      hourlyRate: 1000,
      description: 'Review expert',
      rating: 1, // Start with 1 to bypass min:1 validator
      numReviews: 0
    });

    // Seed Client 1
    client1 = await User.create({
      name: 'Client One',
      email: 'client1@client.com',
      password: 'password123',
      role: 'Client'
    });
    const loginRes1 = await request(app).post('/auth/login').send({
      email: 'client1@client.com',
      password: 'password123'
    });
    clientToken1 = loginRes1.body.token;

    // Seed Client 2
    client2 = await User.create({
      name: 'Client Two',
      email: 'client2@client.com',
      password: 'password123',
      role: 'Client'
    });
    const loginRes2 = await request(app).post('/auth/login').send({
      email: 'client2@client.com',
      password: 'password123'
    });
    clientToken2 = loginRes2.body.token;

    // Seed Bookings
    const b1 = await Booking.create({
      expert: expertProfile._id,
      user: client1._id,
      userName: client1.name,
      userEmail: client1.email,
      userPhone: '+919876543210',
      bookingDate: '2025-01-01',
      slotTime: '10:00',
      status: 'Completed',
      isRated: false
    });
    completedBookingId1 = b1._id;

    const b2 = await Booking.create({
      expert: expertProfile._id,
      user: client2._id,
      userName: client2.name,
      userEmail: client2.email,
      userPhone: '+919876543211',
      bookingDate: '2025-01-02',
      slotTime: '11:00',
      status: 'Completed',
      isRated: false
    });
    completedBookingId2 = b2._id;

    const b3 = await Booking.create({
      expert: expertProfile._id,
      user: client1._id,
      userName: client1.name,
      userEmail: client1.email,
      userPhone: '+919876543212',
      bookingDate: '2025-01-03',
      slotTime: '12:00',
      status: 'Pending',
      isRated: false
    });
    pendingBookingId = b3._id;
  });

  it('INT-REV-01: Should successfully rate a completed session and update Expert averages', async () => {
    const payload = {
      rating: 5,
      comment: 'Excellent session!',
      bookingId: completedBookingId1
    };

    const response = await request(app)
      .post(`/experts/${expertProfile._id}/rate`)
      .set('Authorization', `Bearer ${clientToken1}`)
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Verify Expert Document Mutated
    const expert = await Expert.findById(expertProfile._id);
    expect(expert.numReviews).toBe(1);
    expect(expert.rating).toBe(5); // (0 * 0 + 5) / 1 = 5

    // Verify Booking mutated
    const booking = await Booking.findById(completedBookingId1);
    expect(booking.isRated).toBe(true);

    // Verify Review Created
    const review = await Review.findOne({ booking: completedBookingId1 });
    expect(review).toBeTruthy();
    expect(review.rating).toBe(5);
  });

  it('INT-REV-02: Should properly calculate rolling average for a second rating', async () => {
    // 1. First rating = 5
    await request(app)
      .post(`/experts/${expertProfile._id}/rate`)
      .set('Authorization', `Bearer ${clientToken1}`)
      .send({ rating: 5, bookingId: completedBookingId1 });

    // 2. Second rating = 3
    const payload2 = {
      rating: 3,
      comment: 'It was okay.',
      bookingId: completedBookingId2
    };

    const response = await request(app)
      .post(`/experts/${expertProfile._id}/rate`)
      .set('Authorization', `Bearer ${clientToken2}`)
      .send(payload2);

    expect(response.status).toBe(200);

    // Verify Expert Document Mutated
    const expert = await Expert.findById(expertProfile._id);
    expect(expert.numReviews).toBe(2);
    expect(expert.rating).toBe(4); // (5 + 3) / 2 = 4

    // Verify Booking mutated
    const booking = await Booking.findById(completedBookingId2);
    expect(booking.isRated).toBe(true);
  });

  it('INT-REV-03: Should reject double-rating the same booking', async () => {
    // 1. First rating
    await request(app)
      .post(`/experts/${expertProfile._id}/rate`)
      .set('Authorization', `Bearer ${clientToken1}`)
      .send({ rating: 5, bookingId: completedBookingId1 });

    // 2. Try to rate again using same booking
    const response = await request(app)
      .post(`/experts/${expertProfile._id}/rate`)
      .set('Authorization', `Bearer ${clientToken1}`)
      .send({ rating: 2, bookingId: completedBookingId1 });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/already been rated/i);

    // Verify Expert averages are NOT inflated
    const expert = await Expert.findById(expertProfile._id);
    expect(expert.numReviews).toBe(1);
    expect(expert.rating).toBe(5);
  });

  it('INT-REV-04: Should reject rating a session that is not Completed', async () => {
    const payload = {
      rating: 4,
      bookingId: pendingBookingId
    };

    const response = await request(app)
      .post(`/experts/${expertProfile._id}/rate`)
      .set('Authorization', `Bearer ${clientToken1}`)
      .send(payload);

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/only rate completed sessions/i);

    // Verify Expert unaffected
    const expert = await Expert.findById(expertProfile._id);
    expect(expert.numReviews).toBe(0);
  });
});
