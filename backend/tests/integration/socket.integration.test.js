// Ensure necessary environment variables exist
process.env.JWT_SECRET = 'test_secret';
process.env.RAZORPAY_KEY_ID = 'test_key_id';
process.env.RAZORPAY_KEY_SECRET = 'test_key_secret';
process.env.NODE_ENV = 'test';

// Mock Razorpay SDK to simulate external success
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
const { app, server } = require('../../src/app');
const ioClient = require('socket.io-client');
const Booking = require('../../src/models/Booking');
const Expert = require('../../src/models/Expert');
const User = require('../../src/models/User');

let mongoServer;
let clientSocket;
let testPort;

describe('Feature 2.3: Socket.io Real-Time Synchronization', () => {
  let expertUser, expertProfile, clientUser, clientToken;

  // Setup DB, Start HTTP Server, and Connect Socket Client
  beforeAll(async () => {
    // 1. Start MongoDB Replica Set
    mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    const uri = mongoServer.getUri();
    
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(uri);

    // 2. Start HTTP Server on ephemeral port (required for WebSockets)
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        testPort = server.address().port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    // Stop server
    await new Promise((resolve) => server.close(resolve));
    
    // Disconnect DB
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    // Clean DB
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany();
    }

    // Seed Data
    expertUser = await User.create({
      name: 'Dr. Realtime',
      email: 'realtime@expert.com',
      password: 'password123',
      role: 'Expert'
    });
    expertProfile = await Expert.create({
      user: expertUser._id,
      name: expertUser.name,
      category: 'Technology',
      experience: 10,
      hourlyRate: 2000,
      description: 'Socket.io Master'
    });

    clientUser = await User.create({
      name: 'Client Alice',
      email: 'alice@client.com',
      password: 'password123',
      role: 'Client'
    });

    // Login client to get token for Handshake
    const loginRes = await request(app).post('/auth/login').send({
      email: 'alice@client.com',
      password: 'password123'
    });
    clientToken = loginRes.body.token;

    // Connect WebSocket Client
    clientSocket = ioClient(`http://127.0.0.1:${testPort}`, {
      auth: { token: clientToken },
      reconnectionDelay: 0,
      forceNew: true
    });

    // Wait for connection to establish
    await new Promise((resolve, reject) => {
      clientSocket.on('connect', resolve);
      clientSocket.on('connect_error', reject);
    });

    // Join the Expert's room
    clientSocket.emit('join_expert_room', expertProfile._id.toString());

    // Small delay to ensure the server processed the room join
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  afterEach(() => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  it('INT-SOCK-01: Should emit slot_booked event natively when booking succeeds', async () => {
    mockOrdersCreate.mockResolvedValueOnce({ id: 'order_ws', amount: 200000 });

    const payload = {
      expert: expertProfile._id,
      userName: 'Client Alice',
      userEmail: 'alice@client.com',
      userPhone: '+919876543210',
      bookingDate: '2024-12-10',
      slotTime: '09:00'
    };

    // Set up WebSocket listener BEFORE making the HTTP request
    const eventPromise = new Promise((resolve) => {
      clientSocket.once('slot_booked', (data) => {
        resolve(data);
      });
    });

    // Execute HTTP request
    const response = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${clientToken}`)
      .send(payload);

    expect(response.status).toBe(201);

    // Assert that the WebSocket event was received with correct payload
    const eventData = await eventPromise;
    expect(eventData).toBeDefined();
    expect(eventData.bookingDate).toBe('2024-12-10');
    expect(eventData.slotTime).toBe('09:00');
  });

  it('INT-SOCK-02: Should NOT emit slot_booked event if database transaction rolls back', async () => {
    // Mock Razorpay Failure to force rollback
    mockOrdersCreate.mockRejectedValueOnce(new Error('Payment Failed'));

    const payload = {
      expert: expertProfile._id,
      userName: 'Client Alice',
      userEmail: 'alice@client.com',
      userPhone: '+919876543210',
      bookingDate: '2024-12-11',
      slotTime: '10:00'
    };

    // Track if event was erroneously fired
    let eventFired = false;
    clientSocket.once('slot_booked', () => {
      eventFired = true;
    });

    // Execute HTTP request
    const response = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${clientToken}`)
      .send(payload);

    expect(response.status).toBe(400);

    // Wait an arbitrary small amount of time to ensure no event arrived
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(eventFired).toBe(false);
  });

  it('INT-SOCK-03: Should emit slot_released natively when a session is cancelled', async () => {
    // Manually create a confirmed booking in the DB
    const booking = await Booking.create({
      expert: expertProfile._id,
      user: clientUser._id,
      userName: 'Client Alice',
      userEmail: 'alice@client.com',
      userPhone: '+919876543210',
      bookingDate: '2027-12-15',
      slotTime: '14:00',
      status: 'Pending',
      razorpayOrderId: 'order_ws_cancel'
    });

    const eventPromise = new Promise((resolve) => {
      clientSocket.once('slot_released', (data) => {
        resolve(data);
      });
    });

    // Execute HTTP request to Cancel as the client
    const response = await request(app)
      .patch(`/bookings/${booking._id}/status`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ status: 'Cancelled' });

    expect(response.status).toBe(200);

    // Assert that the WebSocket event was received
    const eventData = await eventPromise;
    expect(eventData).toBeDefined();
    expect(eventData.bookingDate).toBe('2027-12-15');
    expect(eventData.slotTime).toBe('14:00');
  });

  it('INT-SOCK-04: Should emit new_notification to the specific user when status changes', async () => {
    // Manually create a confirmed booking in the DB
    const booking = await Booking.create({
      expert: expertProfile._id,
      user: clientUser._id,
      userName: 'Client Alice',
      userEmail: 'alice@client.com',
      userPhone: '+919876543210',
      bookingDate: '2027-12-16',
      slotTime: '15:00',
      status: 'Pending',
      razorpayOrderId: 'order_ws_notif'
    });

    // Join the Client's personal notification room (setup in socket implementation)
    clientSocket.emit('join_user_room', clientUser._id.toString());
    await new Promise((resolve) => setTimeout(resolve, 50)); // let room join settle

    const notifPromise = new Promise((resolve) => {
      clientSocket.once('new_notification', (data) => resolve(data));
    });

    // Cancel the booking which triggers notification to the client
    const response = await request(app)
      .patch(`/bookings/${booking._id}/status`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ status: 'Cancelled' });

    expect(response.status).toBe(200);

    const eventData = await notifPromise;
    expect(eventData).toBeDefined();
    expect(eventData.title).toBe('Booking Cancelled');
    expect(eventData.type).toBe('BOOKING_UPDATE');
  });
});

