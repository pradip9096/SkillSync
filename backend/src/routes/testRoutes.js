const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Expert = require('../models/Expert');
const Availability = require('../models/Availability');
const Booking = require('../models/Booking');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const bcrypt = require('bcryptjs');

// Ensure these routes only run in non-production environments
if (process.env.NODE_ENV === 'production') {
  console.error('CRITICAL: Test routes loaded in production environment.');
  process.exit(1);
}

/**
 * Helper to wipe all test data
 */
const cleanupTestData = async () => {
  const users = await User.find({ email: { $in: [
    'client-e2e@skillsync.com', 
    'expert-e2e@skillsync.com', 
    'expert-schedule-e2e@skillsync.com',
    'resiliency-expert@skillsync.com',
    'resiliency-client-A@skillsync.com',
    'resiliency-client-B@skillsync.com',
    'chat-expert@skillsync.com',
    'chat-client@skillsync.com',
    'admin-e2e@skillsync.com',
    'suspended-client@skillsync.com',
    'target-expert@skillsync.com'
  ] } });
  const userIds = users.map(u => u._id);
  
  if (userIds.length > 0) {
    await Message.deleteMany({ $or: [{ sender: { $in: userIds } }, { receiver: { $in: userIds } }] });
    await Notification.deleteMany({ user: { $in: userIds } });
    await Booking.deleteMany({ $or: [{ user: { $in: userIds } }, { expert: { $in: userIds } }] });
    await Availability.deleteMany({ expert: { $in: userIds } });
    await Expert.deleteMany({ user: { $in: userIds } });
    await User.deleteMany({ _id: { $in: userIds } });
  }
};

/**
 * POST /api/test/seed-booking-e2e
 * Seeds the database for E2E Core Booking Journey tests
 */
router.post('/seed-booking-e2e', async (req, res) => {
  try {
    await cleanupTestData();

    // Create Client User
    const clientUser = await User.create({
      name: 'E2E Client',
      email: 'client-e2e@skillsync.com',
      password: 'TestPassword123!',
      phone: '+919876543210',
      role: 'Client',
      isVerified: true
    });

    // Create Expert User
    const expertUser = await User.create({
      name: 'expert-e2e',
      email: 'expert-e2e@skillsync.com',
      password: 'TestPassword123!',
      role: 'Expert',
      isVerified: true
    });

    // Create Expert Profile
    const expertProfile = await Expert.create({
      user: expertUser._id,
      name: 'expert-e2e',
      category: 'Technology',
      experience: 5,
      description: 'E2E Test Expert',
      hourlyRate: 1000
    });

    // Create Availability for tomorrow and the day after tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDateStr = tomorrow.toISOString().split('T')[0];

    await Availability.create({
      expert: expertUser._id,
      bookingDate: tomorrowDateStr,
      slotTime: '10:00'
    });

    await Availability.create({
      expert: expertUser._id,
      bookingDate: tomorrowDateStr,
      slotTime: '11:00'
    });
    
    res.status(201).json({ success: true, message: 'E2E seeded successfully' });
  } catch (error) {
    console.error('Seeding error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/test/seed-schedule-e2e
 * Seeds the database for E2E Expert Schedule Management tests
 */
router.post('/seed-schedule-e2e', async (req, res) => {
  try {
    await cleanupTestData();

    // Create Expert User
    const expertUser = await User.create({
      name: 'expert-schedule-e2e',
      email: 'expert-schedule-e2e@skillsync.com',
      password: 'TestPassword123!',
      role: 'Expert',
      isVerified: true
    });

    // Create Expert Profile
    const expertProfile = await Expert.create({
      user: expertUser._id,
      name: 'expert-schedule-e2e',
      category: 'Design',
      experience: 8,
      description: 'Schedule Test Expert',
      hourlyRate: 1500
    });

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDateStr = tomorrow.toISOString().split('T')[0];

    // 1x Inactive Slot at 09:00 AM tomorrow (we don't create it, so it's inactive by default)
    // 1x Active Slot at 10:00 AM tomorrow
    await Availability.create({
      expert: expertProfile._id,
      bookingDate: tomorrowDateStr,
      slotTime: '10:00'
    });

    // Create a Client User to tie the past booking to
    const clientUser = await User.create({
      name: 'Schedule Client',
      email: 'client-e2e@skillsync.com',
      password: 'TestPassword123!',
      phone: '+919876543210',
      role: 'Client',
      isVerified: true
    });

    // Create 1x Active Booking for the past to generate earnings
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDateStr = yesterday.toISOString().split('T')[0];

    await Booking.create({
      expert: expertProfile._id,
      user: clientUser._id,
      expertName: expertProfile.name,
      userName: clientUser.name,
      userEmail: clientUser.email,
      userPhone: clientUser.phone,
      bookingDate: yesterdayDateStr,
      slotTime: '14:00',
      status: 'Completed',
      paymentStatus: 'Paid',
      amount: 1500,
      notes: 'Test past booking'
    });
    
    res.status(201).json({ success: true, message: 'Schedule E2E seeded successfully' });
  } catch (error) {
    console.error('Seeding error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/test/seed-auth-e2e
 * Seeds a specific user account for Authentication & Security Flows.
 * Also cleans up dynamic user accounts created during the test.
 */
router.post('/seed-auth-e2e', async (req, res) => {
  try {
    const authEmail = 'auth-e2e@skillsync.com';
    
    // Clean up existing auth user and any dynamic test users
    await User.deleteMany({
      $or: [
        { email: authEmail },
        { email: { $regex: /^test-new-user-.*@skillsync\.com$/ } }
      ]
    });

    // Create the test user
    await User.create({
      name: 'Auth Test User',
      email: authEmail,
      password: 'TestPassword123!',
      phone: '+919876543210',
      role: 'Client'
    });

    res.status(201).json({ success: true, message: 'Auth E2E seeded successfully' });
  } catch (error) {
    console.error('Seeding auth error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/test/seed-resiliency-e2e
 * Seeds 1 Expert with 1 slot, and 2 distinct Client accounts for testing race conditions.
 */
router.post('/seed-resiliency-e2e', async (req, res) => {
  try {
    const expertEmail = 'resiliency-expert@skillsync.com';
    const clientAEmail = 'resiliency-client-A@skillsync.com';
    const clientBEmail = 'resiliency-client-B@skillsync.com';
    const password = 'TestPassword123!';
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = tomorrowDate.toISOString().split('T')[0];

    // Clean up
    await User.deleteMany({ email: { $in: [expertEmail, clientAEmail, clientBEmail] } });
    
    // Create Expert User
    const expertUser = await User.create({
      name: 'Resiliency Expert',
      email: expertEmail,
      password,
      phone: '+919000000004',
      role: 'Expert'
    });

    // Create Expert Profile
    await Expert.deleteMany({ userId: expertUser._id });
    const expert = await Expert.create({
      userId: expertUser._id,
      name: 'Resiliency Expert',
      category: 'Technology',
      experience: 5,
      hourlyRate: 1000,
      description: 'Expert for testing concurrent bookings.',
      isVerified: true,
      availability: [
        {
          date: tomorrowDate,
          slots: [
            { time: '14:00', isBooked: false }
          ]
        }
      ]
    });

    // Create Client A
    await User.create({
      name: 'Resiliency Client A',
      email: clientAEmail,
      password,
      phone: '+919000000005',
      role: 'Client'
    });

    // Create Client B
    await User.create({
      name: 'Resiliency Client B',
      email: clientBEmail,
      password,
      phone: '+919000000006',
      role: 'Client'
    });

    res.status(201).json({ 
      success: true, 
      expertId: expert._id,
      date: tomorrowStr,
      time: '14:00',
      timeLabel: '02:00 PM'
    });
  } catch (error) {
    console.error('Seeding resiliency error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/test/teardown
 * Wipes the test data
 */
router.delete('/teardown', async (req, res) => {
  try {
    await cleanupTestData();
    res.status(200).json({ success: true, message: 'Teardown complete' });
  } catch (error) {
    console.error('Teardown error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/test/seed-chat-e2e
 * Seeds the database for E2E Chat & Notification UI tests
 */
router.post('/seed-chat-e2e', async (req, res) => {
  try {
    await cleanupTestData();

    // Create Expert User
    const expertUser = await User.create({
      name: 'Chat Expert',
      email: 'chat-expert@skillsync.com',
      password: 'TestPassword123!',
      phone: '+919000000007',
      role: 'Expert',
      isVerified: true
    });

    // Create Expert Profile
    const expert = await Expert.create({
      user: expertUser._id,
      name: 'Chat Expert',
      category: 'Technology',
      bio: 'I help test chat UIs.',
      description: 'Senior Software Tester',
      experience: 5,
      hourlyRate: 1500,
      availability: []
    });

    // Create Client User
    const clientUser = await User.create({
      name: 'Chat Client',
      email: 'chat-client@skillsync.com',
      password: 'TestPassword123!',
      phone: '+919000000008',
      role: 'Client',
      isVerified: true
    });

    // Create a Confirmed Booking between them
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const booking = await Booking.create({
      expert: expert._id,
      user: clientUser._id,
      userName: clientUser.name,
      userEmail: clientUser.email,
      userPhone: clientUser.phone,
      bookingDate: tomorrow,
      slotTime: '10:00',
      status: 'Confirmed',
      paymentStatus: 'Completed',
      amount: 1500,
      razorpayPaymentId: 'pay_test123'
    });

    res.status(201).json({ 
      success: true, 
      expertUserId: expertUser._id,
      clientUserId: clientUser._id,
      expertId: expert._id,
      bookingId: booking._id
    });
  } catch (error) {
    console.error('Seeding chat error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/test/trigger-notification
 * Triggers a real-time notification to a specific user
 */
router.post('/trigger-notification', async (req, res) => {
  try {
    const { userId, type, message, title } = req.body;
    
    if (!userId || !message) {
      return res.status(400).json({ success: false, error: 'userId and message are required' });
    }

    // Save notification to DB
    const notification = await Notification.create({
      user: userId,
      type: type || 'SYSTEM',
      title: title || 'System Alert',
      message: message,
      read: false
    });

    // Emit via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${userId}`).emit('new_notification', notification);
    }

    res.status(201).json({ success: true, notification });
  } catch (error) {
    console.error('Trigger notification error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/test/seed-admin-e2e
 * Seeds the database for E2E Admin Dashboard Journey tests
 */
router.post('/seed-admin-e2e', async (req, res) => {
  try {
    await cleanupTestData();

    // Create Admin User
    const adminUser = await User.create({
      name: 'Admin User',
      email: 'admin-e2e@skillsync.com',
      password: 'TestPassword123!',
      phone: '+919000000099',
      role: 'Admin',
      isVerified: true
    });

    // Create Suspended Client
    const suspendedClient = await User.create({
      name: 'Suspended Client',
      email: 'suspended-client@skillsync.com',
      password: 'TestPassword123!',
      phone: '+919000000010',
      role: 'Client',
      isVerified: true,
      lateCancellationsCount: 3,
      suspendedUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    // Create Expert User
    const expertUser = await User.create({
      name: 'Target Expert',
      email: 'target-expert@skillsync.com',
      password: 'TestPassword123!',
      phone: '+919000000011',
      role: 'Expert',
      isVerified: true
    });

    const expert = await Expert.create({
      user: expertUser._id,
      name: 'Target Expert',
      category: 'Finance',
      bio: 'Finance testing.',
      description: 'Expert for admin booking tests',
      experience: 10,
      hourlyRate: 2000,
      availability: []
    });

    // Create Booking Starting in 1 hour
    const bookingDate = new Date();
    bookingDate.setHours(bookingDate.getHours() + 1);
    const dateStr = bookingDate.toISOString().split('T')[0];
    const timeStr = `${bookingDate.getHours().toString().padStart(2, '0')}:00`;

    const booking = await Booking.create({
      expert: expert._id,
      expertName: expert.name,
      expertEmail: expertUser.email,
      user: suspendedClient._id,
      userName: suspendedClient.name,
      userEmail: suspendedClient.email,
      userPhone: suspendedClient.phone,
      bookingDate: dateStr,
      slotTime: timeStr,
      status: 'Confirmed',
      paymentStatus: 'Completed',
      amount: 2000,
      razorpayPaymentId: 'pay_test_admin'
    });

    res.status(201).json({ 
      success: true, 
      adminId: adminUser._id,
      suspendedClientId: suspendedClient._id,
      bookingId: booking._id
    });
  } catch (error) {
    console.error('Seeding admin error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
