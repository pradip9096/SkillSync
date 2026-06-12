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
const Message = require('../../src/models/Message');

let mongoServer;

describe('Feature 2.7: Chat Data Persistence Integration', () => {
  let expertUser, expertProfile, expertToken;
  let clientUser, clientToken;
  let hackerUser, hackerToken;
  let chatBookingId;
  let savedMessageId;

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
      name: 'Dr. Chat',
      email: 'chat@expert.com',
      password: 'password123',
      role: 'Expert'
    });
    expertProfile = await Expert.create({
      user: expertUser._id,
      name: expertUser.name,
      category: 'Technology',
      experience: 8,
      hourlyRate: 1500,
      description: 'Chat expert',
      rating: 4.5,
      numReviews: 0
    });
    const expertLogin = await request(app).post('/auth/login').send({
      email: 'chat@expert.com',
      password: 'password123'
    });
    expertToken = expertLogin.body.token;

    // Seed Client
    clientUser = await User.create({
      name: 'Client Talker',
      email: 'talker@client.com',
      password: 'password123',
      role: 'Client'
    });
    const clientLogin = await request(app).post('/auth/login').send({
      email: 'talker@client.com',
      password: 'password123'
    });
    clientToken = clientLogin.body.token;

    // Seed Hacker (unassociated user)
    hackerUser = await User.create({
      name: 'Hacker Dan',
      email: 'hack@hacker.com',
      password: 'password123',
      role: 'Client'
    });
    const hackerLogin = await request(app).post('/auth/login').send({
      email: 'hack@hacker.com',
      password: 'password123'
    });
    hackerToken = hackerLogin.body.token;

    // Seed Booking
    const b1 = await Booking.create({
      expert: expertProfile._id,
      user: clientUser._id,
      userName: clientUser.name,
      userEmail: clientUser.email,
      userPhone: '+919876543210',
      bookingDate: '2025-10-10',
      slotTime: '10:00',
      status: 'Confirmed'
    });
    chatBookingId = b1._id;
  });

  it('INT-CHAT-01: Should securely write a message to the database as a Client', async () => {
    const payload = {
      bookingId: chatBookingId,
      receiverId: expertUser._id,
      content: 'Hello doctor, I have a question about our session.'
    };

    const response = await request(app)
      .post('/messages')
      .set('Authorization', `Bearer ${clientToken}`)
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.content).toBe('Hello doctor, I have a question about our session.');
    expect(response.body.read).toBe(false);

    // Verify DB
    const dbMessages = await Message.find({ bookingId: chatBookingId });
    expect(dbMessages.length).toBe(1);
    expect(dbMessages[0].content).toBe('Hello doctor, I have a question about our session.');
    
    // Save for next test manually
    savedMessageId = dbMessages[0]._id;
  });

  it('INT-CHAT-02: Should reliably retrieve chat history in chronological order as the Expert', async () => {
    // 1. Seed two messages
    await Message.create({
      bookingId: chatBookingId,
      sender: clientUser._id,
      receiver: expertUser._id,
      content: 'Message 1'
    });
    await Message.create({
      bookingId: chatBookingId,
      sender: expertUser._id,
      receiver: clientUser._id,
      content: 'Message 2'
    });

    const response = await request(app)
      .get(`/messages/booking/${chatBookingId}`)
      .set('Authorization', `Bearer ${expertToken}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBe(2);
    // Reverse chronological or chronological depends on controller. 
    // Controller does: messages.reverse(), meaning oldest first (chronological for chat UI)
    expect(response.body[0].content).toBe('Message 1');
    expect(response.body[1].content).toBe('Message 2');
  });

  it('INT-CHAT-03: Should reject unassociated Hacker from fetching chat history', async () => {
    const response = await request(app)
      .get(`/messages/booking/${chatBookingId}`)
      .set('Authorization', `Bearer ${hackerToken}`); // Hacker Token

    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/not authorized/i);
  });

  it('INT-CHAT-04: Should mutate message to read:true when Expert acknowledges it', async () => {
    // Seed unread message from client to expert
    const msg = await Message.create({
      bookingId: chatBookingId,
      sender: clientUser._id,
      receiver: expertUser._id,
      content: 'Please read this',
      read: false
    });

    const response = await request(app)
      .patch(`/messages/booking/${chatBookingId}/read`)
      .set('Authorization', `Bearer ${expertToken}`);

    expect(response.status).toBe(200);
    
    const dbMessage = await Message.findById(msg._id);
    expect(dbMessage.read).toBe(true); // Mutated successfully
  });
});
