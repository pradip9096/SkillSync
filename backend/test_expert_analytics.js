/**
 * test_expert_analytics.js
 * Integration test suite for the Expert Analytics Dashboard.
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const assert = require('assert');

// Load env variables
dotenv.config({ path: path.join(__dirname, '.env') });

const Expert = require('./src/models/Expert');
const User = require('./src/models/User');
const Booking = require('./src/models/Booking');
const Availability = require('./src/models/Availability');
const Review = require('./src/models/Review');

const { getExpertAnalytics } = require('./src/controllers/expertDashboardController');

const makeMockRes = () => {
  return {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    }
  };
};

const runTests = async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/skillsync';
  console.log(`Connecting to ${mongoUri}...`);
  await mongoose.connect(mongoUri);
  console.log('Database connected.');

  let testExpertUser = null;
  let testExpert = null;
  let testClientUser = null;

  try {
    // Proactively clean up any left-over test fixtures from previous failed runs
    await User.deleteMany({ email: { $in: ['analytics_expert@example.com', 'analytics_client@example.com'] } });
    await Expert.deleteMany({ name: 'Analytics Expert' });
    await Booking.deleteMany({ userEmail: 'analytics_client@example.com' });
    await Availability.deleteMany({});
    await Review.deleteMany({ userName: 'Analytics Client' });

    // Setup users & profiles
    testExpertUser = await User.create({
      name: 'Analytics Expert User',
      email: 'analytics_expert@example.com',
      password: 'password123',
      role: 'Expert'
    });

    testExpert = await Expert.create({
      name: 'Analytics Expert',
      category: 'Technology',
      experience: 6,
      description: 'Expert for analytics dashboard testing.',
      hourlyRate: 1200,
      user: testExpertUser._id,
      rating: 4.5,
      numReviews: 2
    });

    testClientUser = await User.create({
      name: 'Analytics Client',
      email: 'analytics_client@example.com',
      password: 'password123',
      role: 'Client'
    });

    console.log('Seeded test environment profiles.');

    // 1. Create Bookings with different status and dates
    // Booking 1: Completed, May 2026, Monday 10:00
    const booking1 = await Booking.create({
      expert: testExpert._id,
      user: testClientUser._id,
      userName: testClientUser.name,
      userEmail: testClientUser.email,
      userPhone: '+919876543210',
      bookingDate: '2026-05-25', // Monday
      slotTime: '10:00',
      status: 'Completed'
    });

    // Booking 2: Completed, May 2026, Wednesday 14:00
    const booking2 = await Booking.create({
      expert: testExpert._id,
      user: testClientUser._id,
      userName: testClientUser.name,
      userEmail: testClientUser.email,
      userPhone: '+919876543210',
      bookingDate: '2026-05-27', // Wednesday
      slotTime: '14:00',
      status: 'Completed'
    });

    // Booking 3: Completed, April 2026, Monday 10:00
    const booking3 = await Booking.create({
      expert: testExpert._id,
      user: testClientUser._id,
      userName: testClientUser.name,
      userEmail: testClientUser.email,
      userPhone: '+919876543210',
      bookingDate: '2026-04-06', // Monday
      slotTime: '10:00',
      status: 'Completed'
    });

    // Booking 4: Confirmed, April 2026, Friday 18:00
    const booking4 = await Booking.create({
      expert: testExpert._id,
      user: testClientUser._id,
      userName: testClientUser.name,
      userEmail: testClientUser.email,
      userPhone: '+919876543210',
      bookingDate: '2026-04-10', // Friday
      slotTime: '18:00',
      status: 'Confirmed'
    });

    // Booking 5: Cancelled
    const booking5 = await Booking.create({
      expert: testExpert._id,
      user: testClientUser._id,
      userName: testClientUser.name,
      userEmail: testClientUser.email,
      userPhone: '+919876543210',
      bookingDate: '2026-04-15',
      slotTime: '11:00',
      status: 'Cancelled'
    });

    // 2. Create one blocked slot
    await Availability.create({
      expert: testExpert._id,
      bookingDate: '2026-05-28',
      slotTime: '09:00',
      active: true
    });

    // 3. Create client reviews for this expert
    await Review.create({
      expert: testExpert._id,
      user: testClientUser._id,
      userName: testClientUser.name,
      rating: 5,
      comment: 'Absolutely amazing expert!',
      booking: booking1._id
    });

    await Review.create({
      expert: testExpert._id,
      user: testClientUser._id,
      userName: testClientUser.name,
      rating: 4,
      comment: 'Very helpful advice.',
      booking: booking2._id
    });

    console.log('Seeded test bookings, blocks, and reviews.');

    // -------------------------------------------------------------
    // Test Case 1: Fetch analytics and verify counts
    // -------------------------------------------------------------
    console.log('\nRunning Test Case 1: Verify correct counts and aggregate metrics...');
    const req1 = {
      user: testExpertUser
    };
    const res1 = makeMockRes();

    await getExpertAnalytics(req1, res1);
    assert.strictEqual(res1.statusCode, 200);
    assert.strictEqual(res1.data.success, true);
    
    const { counts, totalEarnings, utilizationRate, monthlyTrends, weeklyTrends, hourlyTrends, recentReviews } = res1.data.analytics;
    
    // Validate counts
    assert.strictEqual(counts.totalBookings, 5);
    assert.strictEqual(counts.completedCount, 3);
    assert.strictEqual(counts.confirmedCount, 1);
    assert.strictEqual(counts.cancelledCount, 1);
    assert.strictEqual(counts.totalBlockedCount, 1);

    // Validate earnings: 3 completed sessions * 1200 rate = 3600
    assert.strictEqual(totalEarnings, 3600);

    // Validate utilization rate: completed (3) / (bookings (5) + blocks (1)) = 3/6 = 50%
    assert.strictEqual(utilizationRate, 50.0);

    console.log('✔ Test Case 1 Passed.');

    // -------------------------------------------------------------
    // Test Case 2: Verify Monthly Trends grouping
    // -------------------------------------------------------------
    console.log('\nRunning Test Case 2: Verify monthly trends aggregation...');
    // We expect two months: May 2026 and June 2026
    assert.strictEqual(monthlyTrends.length, 2);
    // May 2026: 2 completed (booking1, booking2) -> 2400 revenue, 2 count
    const mayTrend = monthlyTrends.find(t => t.month.includes('May'));
    assert.ok(mayTrend);
    assert.strictEqual(mayTrend.count, 2);
    assert.strictEqual(mayTrend.revenue, 2400);

    // April 2026: 1 completed (booking3), 1 confirmed (booking4) -> 1200 revenue, 2 count (completed + confirmed)
    const aprilTrend = monthlyTrends.find(t => t.month.includes('Apr'));
    assert.ok(aprilTrend);
    assert.strictEqual(aprilTrend.count, 2);
    assert.strictEqual(aprilTrend.revenue, 1200); // only Completed counts towards revenue

    console.log('✔ Test Case 2 Passed.');

    // -------------------------------------------------------------
    // Test Case 3: Verify Weekly & Hourly distributions
    // -------------------------------------------------------------
    console.log('\nRunning Test Case 3: Verify slot distribution groupings...');
    // Mondays: booking1 (completed) and booking3 (completed) -> 2 count
    const mondayTrend = weeklyTrends.find(w => w.day === 'Monday');
    assert.ok(mondayTrend);
    assert.strictEqual(mondayTrend.count, 2);

    // slot "10:00": booking1, booking3 -> 2 count
    const slot10 = hourlyTrends.find(h => h.slot === '10:00');
    assert.ok(slot10);
    assert.strictEqual(slot10.count, 2);

    console.log('✔ Test Case 3 Passed.');

    // -------------------------------------------------------------
    // Test Case 4: Verify Reviews population
    // -------------------------------------------------------------
    console.log('\nRunning Test Case 4: Verify recent review population list...');
    assert.strictEqual(recentReviews.length, 2);
    assert.strictEqual(recentReviews[0].comment, 'Very helpful advice.'); // Sorted by createdAt descending
    assert.strictEqual(recentReviews[1].comment, 'Absolutely amazing expert!');

    console.log('✔ Test Case 4 Passed.');

    console.log('\nAll 4 Expert Analytics Integration Tests PASSED successfully.');
  } finally {
    // Teardown connections and files
    await User.deleteMany({ email: { $in: ['analytics_expert@example.com', 'analytics_client@example.com'] } });
    await Expert.deleteMany({ name: 'Analytics Expert' });
    await Booking.deleteMany({ userEmail: 'analytics_client@example.com' });
    await Availability.deleteMany({});
    await Review.deleteMany({ userName: 'Analytics Client' });
    await mongoose.disconnect();
    console.log('Database disconnected.');
  }
};

runTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
