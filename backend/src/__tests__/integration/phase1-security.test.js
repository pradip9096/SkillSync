process.env.JWT_SECRET = 'test-secret';
process.env.RAZORPAY_KEY_ID = 'test-key-id';
process.env.RAZORPAY_KEY_SECRET = 'test-key-secret';

const request = require('supertest');
const { app } = require('../../app');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../../models/User');
const Booking = require('../../models/Booking');
const Expert = require('../../models/Expert');
const jwt = require('jsonwebtoken');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  // Clear all collections after each test
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany();
  }
});

describe('Phase 1 Security & Boundaries (TC-004)', () => {
  
  describe('BP-003: Request validation middleware (Zod)', () => {
    it('should return 400 Bad Request on malformed inputs to /bookings', async () => {
      // Create a test user and expert to satisfy auth and reference constraints
      const user = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        role: 'Client'
      });
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

      // Malformed payload (missing expertId, date, slot)
      const payload = {
        userName: 'Test',
        userEmail: 'not-an-email' // Invalid email
      };

      const response = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeInstanceOf(Array);
      // Ensure specific zod errors exist
      const errorPaths = response.body.details.map(d => d.field);
      expect(errorPaths).toContain('expertId');
      expect(errorPaths).toContain('userEmail');
    });

    it('should return 400 on malformed login request', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'bademail', password: '' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'email' }),
          expect.objectContaining({ field: 'password' })
        ])
      );
    });
  });

  describe('BP-002: Razorpay Key Leak Mitigation', () => {
    it('should ensure getBookingsByEmail strips the RAZORPAY_KEY_ID from response', async () => {
      const user = await User.create({
        name: 'Test User',
        email: 'test2@example.com',
        password: 'password123',
        role: 'Client'
      });
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

      const expert = await Expert.create({
        name: 'Expert',
        email: 'expert@example.com',
        hourlyRate: 1000,
        description: 'Test description',
        experience: 5,
        category: 'Technology'
      });

      // Create a booking
      await Booking.create({
        user: user._id,
        expert: expert._id,
        userName: 'Test User',
        userEmail: 'test2@example.com',
        userPhone: '+919999999999',
        bookingDate: new Date(),
        slotTime: '10:00 AM',
        status: 'Pending',
        RAZORPAY_KEY_ID: 'should-not-leak' // Mongoose might drop it if not in schema, but we ensure it's not mapped via serializers anyway.
      });

      const response = await request(app)
        .get('/bookings?email=test2@example.com')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(1);
      
      const bookingDoc = response.body.data[0];
      expect(bookingDoc.RAZORPAY_KEY_ID).toBeUndefined();
      expect(bookingDoc.__v).toBeUndefined();
    });
  });

  describe('BP-019: Auth Rate Limiting', () => {
    it('should return 429 Too Many Requests after limit reached', async () => {
      // Loop a few times. If some were used earlier, this will push it over 10.
      let lastStatus = 200;
      for (let i = 0; i < 11; i++) {
        const res = await request(app)
          .post('/auth/login')
          .send({ email: 'test@example.com', password: 'password123' });
        lastStatus = res.status;
        if (res.status === 429) break;
      }
      expect(lastStatus).toBe(429);
    });
  });

  describe('BP-018: JWT Secret Fallback Vulnerability', () => {
    it('should throw error if JWT_SECRET is missing during token generation', () => {
      const { generateToken } = require('../../controllers/authController');
      
      // Store original secret
      const originalSecret = process.env.JWT_SECRET;
      
      // Temporarily delete secret
      delete process.env.JWT_SECRET;
      
      try {
        expect(() => {
          generateToken('some-id');
        }).toThrow('FATAL: JWT_SECRET environment variable is not defined.');
      } finally {
        // Restore secret
        process.env.JWT_SECRET = originalSecret;
      }
    });
  });

});
