process.env.JWT_SECRET = 'test-secret';
process.env.RAZORPAY_KEY_ID = 'test-key-id';
process.env.RAZORPAY_KEY_SECRET = 'test-key-secret';

const request = require('supertest');
const { app } = require('../../../src/app');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const User = require('../../../src/models/User');
const Booking = require('../../../src/models/Booking');
const Expert = require('../../../src/models/Expert');
const jwt = require('jsonwebtoken');

let mongoServer;

jest.mock('razorpay', () => {
  return jest.fn().mockImplementation(() => ({
    orders: {
      create: jest.fn().mockResolvedValue({ id: 'order_mock123', status: 'created' })
    }
  }));
});

jest.setTimeout(60000); // 60s timeout to prevent CI flakiness with MongoMemoryServer

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = mongoServer.getUri();
  
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany();
  }
});

describe('Phase 1 Implementation Acceptance Tests', () => {

  describe('Correlation IDs (Epic 2.1)', () => {
    it('should return a correlationId on 500-level errors', async () => {
      // Trigger a 500 error by mocking an existing service
      const bookingService = require('../../../src/services/BookingService');
      jest.spyOn(bookingService, 'getBookingsByEmail').mockRejectedValue(new Error('Simulated internal failure'));

      // Override NODE_ENV to production to test production error handler
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const user = await User.create({
        name: 'Err User',
        email: 'err@example.com',
        password: 'password123',
        role: 'Client'
      });
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

      const response = await request(app)
        .get('/api/v1/bookings?email=err@example.com')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Internal server error'); // Generic message
      expect(response.body.correlationId).toBeDefined(); // Must contain correlationId
      expect(typeof response.body.correlationId).toBe('string');
      expect(response.body.stack).toBeUndefined(); // Must strip stack trace

      // Restore
      process.env.NODE_ENV = originalEnv;
      jest.restoreAllMocks();
    });
  });

  describe('Mongoose Transactions (Epic 1.1)', () => {
    it('should gracefully abort transaction without writing partial data on failed booking', async () => {
      const user = await User.create({
        name: 'Tx User',
        email: 'tx@example.com',
        password: 'password123',
        role: 'Client'
      });
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

      const expert = await Expert.create({
        name: 'Tx Expert',
        email: 'txexpert@example.com',
        hourlyRate: 1000,
        description: 'Test description',
        experience: 5,
        category: 'Technology'
      });

      // First booking succeeds
      const firstRes = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          expert: expert._id,
          userName: 'Tx User',
          userEmail: 'tx@example.com',
          userPhone: '+919999999999',
          bookingDate: '2030-01-01',
          slotTime: '10:00 AM',
        });
      
      console.log('First booking res:', firstRes.body);

      const initialBookingCount = await Booking.countDocuments();
      expect(initialBookingCount).toBe(1);

      // Second booking for the same slot fails (duplicate key / already booked)
      const response = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          expert: expert._id,
          userName: 'Tx User 2',
          userEmail: 'tx2@example.com',
          userPhone: '+918888888888',
          bookingDate: '2030-01-01',
          slotTime: '10:00 AM',
        });
      
      console.log('Second booking res:', response.body);

      console.log('Second booking res:', response.body);

      expect(response.status).toBe(409); // Duplicate booking yields 409
      expect(response.body.success).toBe(false);

      const finalBookingCount = await Booking.countDocuments();
      // Verify no partial data was written (count should still be 1)
      expect(finalBookingCount).toBe(1);
    });
  });

  describe('API Versioning (Epic 1.3)', () => {
    it('should successfully route via /api/v1 prefix', async () => {
      const response = await request(app).get('/api/v1/experts');
      // Should be 200 OK
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
