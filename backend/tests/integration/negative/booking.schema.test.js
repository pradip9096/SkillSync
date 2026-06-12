// Ensure necessary environment variables exist
process.env.NODE_ENV = 'test';

const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const Booking = require('../../../src/models/Booking');
const Expert = require('../../../src/models/Expert');
const User = require('../../../src/models/User');

let mongoServer;

describe('Data Layer State Boundary Defenses (Booking Schema)', () => {
  let expertUser, expertProfile, clientUser;

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
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany();
    }

    expertUser = await User.create({
      name: 'Dr. Bounds',
      email: 'bounds@expert.com',
      password: 'password123',
      role: 'Expert'
    });
    expertProfile = await Expert.create({
      user: expertUser._id,
      name: expertUser.name,
      category: 'Technology',
      experience: 10,
      hourlyRate: 1500,
      description: 'Bounds checking',
      rating: 5.0,
      numReviews: 1
    });

    clientUser = await User.create({
      name: 'Client Test',
      email: 'test@client.com',
      password: 'password123',
      role: 'Client'
    });
  });

  it('NEG-BOOK-01: Should block pre-save status mutation to Completed if session time is in the future', async () => {
    const b1 = await Booking.create({
      expert: expertProfile._id,
      user: clientUser._id,
      userName: clientUser.name,
      userEmail: clientUser.email,
      userPhone: '+919876543210',
      bookingDate: '2050-01-01', // Extremely in the future
      slotTime: '10:00',
      status: 'Pending'
    });

    // Try to mark it completed ahead of time
    b1.status = 'Completed';

    let caughtError;
    try {
      await b1.save();
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeDefined();
    expect(caughtError.message).toMatch(/Session has not ended yet/);
  });

  it('NEG-BOOK-02: Should block findOneAndUpdate status mutation to Completed if session time is in the future', async () => {
    const b2 = await Booking.create({
      expert: expertProfile._id,
      user: clientUser._id,
      userName: clientUser.name,
      userEmail: clientUser.email,
      userPhone: '+919876543210',
      bookingDate: '2050-02-01',
      slotTime: '11:00',
      status: 'Pending'
    });

    let caughtError;
    try {
      await Booking.findOneAndUpdate(
        { _id: b2._id },
        { status: 'Completed' },
        { runValidators: true } // Hooks run regardless, but good practice
      );
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeDefined();
    expect(caughtError.message).toMatch(/Session has not ended yet/);
  });
});
