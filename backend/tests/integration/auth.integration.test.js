// Ensure necessary environment variables exist before requiring app.js
process.env.JWT_SECRET = 'test_secret';
process.env.RAZORPAY_KEY_ID = 'test_key_id';
process.env.RAZORPAY_KEY_SECRET = 'test_key_secret';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { app } = require('../../src/app');
const User = require('../../src/models/User');

let mongoServer;

describe('Feature 2.1: Auth & Session Management Integration', () => {

  // Setup: Start Memory Server and connect Mongoose
  beforeAll(async () => {
    mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    const uri = mongoServer.getUri();
    
    // Disconnect if already connected (avoid Mongoose errors)
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    
    await mongoose.connect(uri);
  });

  // Setup: Drop database between tests
  afterEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany();
    }
  });

  // Teardown: Disconnect and stop server
  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  // INT-AUTH-01: Security Constraints
  it('INT-AUTH-01: Should block GET /api/auth/profile when no JWT Bearer Token is provided', async () => {
    const response = await request(app).get('/auth/profile');
    
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Not authorized, no token provided');
    
    // Assert DB unchanged
    const users = await User.find();
    expect(users.length).toBe(0);
  });

  // INT-AUTH-02: Schema Integrity Constraints
  it('INT-AUTH-02: Should fail to register when missing required payload field (e.g. password)', async () => {
    const payload = {
      name: 'Integration User',
      email: 'integration@test.com'
      // Password explicitly missing
    };

    const response = await request(app)
      .post('/auth/register')
      .send(payload);

    expect(response.status).toBe(400);
    // Mongoose validation error should be caught and returned
    expect(response.body.success).toBe(false);

    // Assert DB unchanged
    const users = await User.find();
    expect(users.length).toBe(0);
  });

  // INT-AUTH-03: Referential/Unique Integrity Constraints
  it('INT-AUTH-03: Should fail to register if email already exists', async () => {
    // Seed database directly
    const user = new User({
      name: 'Existing User',
      email: 'duplicate@test.com',
      password: 'password123'
    });
    await user.save();

    const payload = {
      name: 'New User',
      email: 'duplicate@test.com',
      password: 'newpassword123'
    };

    const response = await request(app)
      .post('/auth/register')
      .send(payload);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);

    // Assert DB unchanged (still 1 user)
    const users = await User.find();
    expect(users.length).toBe(1);
  });

  // INT-AUTH-04: Golden Path Registration
  it('INT-AUTH-04: Should register successfully and securely hash password', async () => {
    const payload = {
      name: 'Golden User',
      email: 'golden@test.com',
      password: 'strongpassword123'
    };

    const response = await request(app)
      .post('/auth/register')
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.token).toBeDefined();

    // Verify DB Native Persistance
    const dbUser = await User.findOne({ email: 'golden@test.com' }).select('+password');
    expect(dbUser).toBeTruthy();
    expect(dbUser.name).toBe('Golden User');
    expect(dbUser.password).not.toBe('strongpassword123'); // Ensure it was hashed
  });

  // INT-AUTH-05: Golden Path Login
  it('INT-AUTH-05: Should login successfully and generate valid JWT', async () => {
    // Seed
    const user = await User.create({
      name: 'Login User',
      email: 'login@test.com',
      password: 'loginpassword123' // Hooks will hash it
    });

    const payload = {
      email: 'login@test.com',
      password: 'loginpassword123'
    };

    const response = await request(app)
      .post('/auth/login')
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.token).toBeDefined();
    expect(response.body.user.email).toBe('login@test.com');
  });

  // INT-AUTH-06: Golden Path Profile Update
  it('INT-AUTH-06: Should update profile properly mutating database', async () => {
    // Seed
    const user = await User.create({
      name: 'Old Name',
      email: 'update@test.com',
      password: 'updatepassword123'
    });

    // Login to get token
    const loginRes = await request(app).post('/auth/login').send({
      email: 'update@test.com',
      password: 'updatepassword123'
    });
    const token = loginRes.body.token;

    // Mutate Profile
    const updateRes = await request(app)
      .put('/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Golden Name' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.success).toBe(true);

    // Verify Database Mutation
    const dbUser = await User.findById(user._id);
    expect(dbUser.name).toBe('New Golden Name');
  });
});
