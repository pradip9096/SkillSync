// Ensure necessary environment variables exist
process.env.JWT_SECRET = 'test_secret';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { app } = require('../../src/app');
const Availability = require('../../src/models/Availability');
const Expert = require('../../src/models/Expert');
const User = require('../../src/models/User');

let mongoServer;

describe('Feature 2.5: Availability DB Constraints Integration', () => {
  let expertUser, expertProfile, expertToken;
  let clientUser, clientToken;

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

    // Force unique index creation
    await Availability.createIndexes();

    // Seed Data
    expertUser = await User.create({
      name: 'Dr. Availability',
      email: 'avail@expert.com',
      password: 'password123',
      role: 'Expert'
    });
    expertProfile = await Expert.create({
      user: expertUser._id,
      name: expertUser.name,
      category: 'Finance',
      experience: 10,
      hourlyRate: 2000,
      description: 'Expert in Scheduling'
    });

    clientUser = await User.create({
      name: 'Client Scheduler',
      email: 'sched@client.com',
      password: 'password123',
      role: 'Client'
    });

    // Login expert to get token
    const expertLoginRes = await request(app).post('/auth/login').send({
      email: 'avail@expert.com',
      password: 'password123'
    });
    expertToken = expertLoginRes.body.token;

    // Login client to get token
    const clientLoginRes = await request(app).post('/auth/login').send({
      email: 'sched@client.com',
      password: 'password123'
    });
    clientToken = clientLoginRes.body.token;
  });

  it('INT-AVAIL-01: Should successfully block a slot when valid payload is sent as Expert', async () => {
    const payload = {
      bookingDate: '2027-01-01',
      slotTime: '10:00'
    };

    const response = await request(app)
      .post('/expert-dashboard/block-slot')
      .set('Authorization', `Bearer ${expertToken}`)
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    const blocks = await Availability.find({ expert: expertProfile._id });
    expect(blocks.length).toBe(1);
    expect(blocks[0].bookingDate).toBe('2027-01-01');
    expect(blocks[0].slotTime).toBe('10:00');
  });

  it('INT-AVAIL-02: Should natively reject duplicate availability blocks via DB constraint in a race condition', async () => {
    const payload = {
      bookingDate: '2027-01-02',
      slotTime: '11:00'
    };

    // Fire two identical block requests concurrently to bypass controller findOne checks
    const [res1, res2] = await Promise.all([
      request(app).post('/expert-dashboard/block-slot').set('Authorization', `Bearer ${expertToken}`).send(payload),
      request(app).post('/expert-dashboard/block-slot').set('Authorization', `Bearer ${expertToken}`).send(payload)
    ]);

    const statuses = [res1.status, res2.status].sort();
    
    // One succeeds (201)
    expect(statuses[0]).toBe(201);
    // The second either fails via controller `findOne` check (400) or DB native unique index constraint (500 Mongoose E11000 Error)
    expect(statuses[1] === 400 || statuses[1] === 500).toBeTruthy();

    // Verify exactly ONE block was written
    const blocks = await Availability.find({ expert: expertProfile._id });
    expect(blocks.length).toBe(1);
  });

  it('INT-AVAIL-03: Should reject request with 403 Forbidden if user is a Client', async () => {
    const payload = {
      bookingDate: '2027-01-03',
      slotTime: '12:00'
    };

    const response = await request(app)
      .post('/expert-dashboard/block-slot')
      .set('Authorization', `Bearer ${clientToken}`) // Using Client Token
      .send(payload);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toMatch(/authorized/i);

    // Verify nothing was written
    const blocks = await Availability.find();
    expect(blocks.length).toBe(0);
  });
});
