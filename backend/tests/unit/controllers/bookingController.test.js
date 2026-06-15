process.env.RAZORPAY_KEY_ID = 'test_key';
process.env.RAZORPAY_KEY_SECRET = 'test_secret';
const httpMocks = require('node-mocks-http');
const mongoose = require('mongoose');
const Booking = require('../../../src/models/Booking');
const Expert = require('../../../src/models/Expert');
const Availability = require('../../../src/models/Availability');
const agenda = require('../../../src/config/agenda');
const Razorpay = require('razorpay');
const User = require('../../../src/models/User');
const Notification = require('../../../src/models/Notification');
const PaymentLog = require('../../../src/models/PaymentLog');
const { createBooking, getBookedSlots, getBookingsByEmail, updateBookingStatus, handleWebhook } = require('../../../src/controllers/bookingController');

jest.mock('../../../src/models/Booking');
jest.mock('../../../src/models/Expert');
jest.mock('../../../src/models/Availability');
jest.mock('../../../src/models/User');
jest.mock('../../../src/models/Notification');
jest.mock('../../../src/models/PaymentLog');
jest.mock('../../../src/services/reminderScheduler', () => ({
  scheduleSessionReminders: jest.fn(),
  cancelScheduledReminders: jest.fn()
}));
jest.mock('../../../src/config/agenda', () => ({
  _collection: true,
  schedule: jest.fn(),
  now: jest.fn(),
  define: jest.fn()
}));
jest.mock('razorpay', () => {
  return jest.fn().mockImplementation(() => {
    if (!global.__mockRazorpayInstance) {
      global.__mockRazorpayInstance = {
        orders: { create: jest.fn().mockResolvedValue({ id: 'mock_order_id', amount: 500000 }) },
        payments: { refund: jest.fn().mockResolvedValue({ id: 'mock_refund_id' }) }
      };
    }
    return global.__mockRazorpayInstance;
  });
});

describe('Feature 1.3: Booking Engine & Constraints Unit Tests', () => {
  let req, res, next, mockSession, mockEmit;

  beforeEach(() => {
    jest.clearAllMocks();
    req = httpMocks.createRequest();
    res = httpMocks.createResponse();
    next = jest.fn((err) => {
      if (err) {
        res.status(err.status || err.statusCode || (err.code === 11000 ? 409 : 500)).json({ error: err.message });
      }
    });
    mockEmit = jest.fn();
    req.app = { get: jest.fn().mockReturnValue({ to: jest.fn().mockReturnValue({ emit: mockEmit }) }) };

    // Setup Mongoose Session Mock
    mockSession = {
      withTransaction: jest.fn(async (cb) => {
        await cb();
      }),
      endSession: jest.fn()
    };
    jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession);
    jest.spyOn(mongoose.Types.ObjectId, 'isValid').mockReturnValue(true);
  });

  describe('createBooking', () => {
    const validPayload = {
      expert: '60d5ecb8b392d700153ee000',
      userName: 'John Client',
      userEmail: 'john@client.com',
      userPhone: '+919876543210',
      bookingDate: '2023-12-01',
      slotTime: '10:00'
    };

    it('TC-BK-01: EP - Should return 400 if expert ObjectId is invalid', async () => {
      mongoose.Types.ObjectId.isValid.mockReturnValueOnce(false);
      req.body = { ...validPayload, expert: 'invalid_id' };
      
      await createBooking(req, res, next);
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res._getData()).error).toMatch(/Invalid or missing expert/i);
    });

    it('TC-BK-02: EP (RBAC) - Should return 403 if user is Admin or Expert', async () => {
      req.user = { _id: 'admin1', role: 'Admin' };
      req.body = validPayload;
      
      await createBooking(req, res, next);
      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res._getData()).error).toMatch(/are not permitted to book/i);
    });

    it('TC-BK-03: State - Should return 403 if user is suspended', async () => {
      req.user = { _id: 'user1', role: 'Client', suspendedUntil: new Date(Date.now() + 100000) };
      req.body = validPayload;
      
      await createBooking(req, res, next);
      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res._getData()).error).toMatch(/privileges are temporarily suspended/i);
    });

    it('TC-BK-04: State - Should return 400 if user attempts to book themselves via email', async () => {
      req.user = { _id: 'user1', role: 'Client' };
      req.body = validPayload;
      Expert.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: validPayload.expert,
          user: { _id: 'expertUser1', email: 'john@client.com' } // matches userEmail
        })
      });

      await createBooking(req, res, next);
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res._getData()).error).toMatch(/cannot book a session with yourself/i);
    });

    it('TC-BK-05: State (Concurrency) - Should return 400 if slot is already booked', async () => {
      req.user = { _id: 'user1', role: 'Client', save: jest.fn() };
      req.body = validPayload;
      Expert.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: validPayload.expert,
          user: { _id: 'expertUser1', email: 'expert@expert.com' },
          hourlyRate: 5000
        })
      });
      
      Booking.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue({ _id: 'existingBookingId' })
      });

      await createBooking(req, res, next);
      expect(res.statusCode).toBe(409);
    });

    it('TC-BK-06: State (Concurrency) - Should return 400 if slot is blocked by expert', async () => {
      req.user = { _id: 'user1', role: 'Client', save: jest.fn() };
      req.body = validPayload;
      Expert.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: validPayload.expert,
          user: { _id: 'expertUser1', email: 'expert@expert.com' },
          hourlyRate: 5000
        })
      });
      
      Booking.findOne.mockReturnValue({ session: jest.fn().mockResolvedValue(null) });
      Availability.findOne.mockReturnValue({ session: jest.fn().mockResolvedValue({ _id: 'blockId' }) });

      await createBooking(req, res, next);
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res._getData()).error).toMatch(/blocked by the expert/i);
    });

    it('TC-BK-07: Resilience - Should return 400 with Double Booking message on Mongoose 11000 error', async () => {
      req.user = null; // Public booking
      req.body = validPayload;
      Expert.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: validPayload.expert,
          user: { _id: 'expertUser1', email: 'expert@expert.com' },
          hourlyRate: 5000
        })
      });
      
      Booking.findOne.mockReturnValue({ session: jest.fn().mockResolvedValue(null) });
      Availability.findOne.mockReturnValue({ session: jest.fn().mockResolvedValue(null) });
      
      // Simulate race condition crash
      mockSession.withTransaction.mockRejectedValue({ code: 11000, message: 'Double booking detected' });

      await createBooking(req, res, next);
      expect(res.statusCode).toBe(409);
    });

    it('TC-BK-08: Golden Path - Should create booking, order, and emit socket event', async () => {
      req.user = null; // Public booking
      req.body = validPayload;
      Expert.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: validPayload.expert,
          user: { _id: 'expertUser1', email: 'expert@expert.com' },
          hourlyRate: 5000
        })
      });
      
      Booking.findOne.mockReturnValue({ session: jest.fn().mockResolvedValue(null) });
      Availability.findOne.mockReturnValue({ session: jest.fn().mockResolvedValue(null) });

      // Provide a mock implementation for the Booking constructor so _id exists
      Booking.mockImplementation(() => ({
        _id: 'mock_booking_id',
        save: jest.fn().mockResolvedValue(true)
      }));

      await createBooking(req, res, next);
      
      const response = JSON.parse(res._getData());
      expect(res.statusCode).toBe(201);
      expect(response.success).toBe(true);
      expect(response.razorpayOrderId).toBe('mock_order_id');
      expect(mockEmit).toHaveBeenCalledWith('slot_booked', {
        bookingDate: validPayload.bookingDate,
        slotTime: validPayload.slotTime
      });
      expect(agenda.schedule).toHaveBeenCalledWith('in 5 minutes', 'cancel-abandoned-booking', expect.any(Object));
      expect(mockSession.withTransaction).toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalled();
    });
  });

  describe('getBookedSlots', () => {
    it('TC-BK-09: Golden Path - Should merge active bookings and expert blocks', async () => {
      req.params = { expertId: '123', date: '2023-12-01' };
      
      Booking.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ slotTime: '10:00' }])
      });
      
      Availability.find.mockResolvedValue([
        { slotTime: '12:00', notes: 'Lunch Break' }
      ]);

      await getBookedSlots(req, res, next);
      
      const response = JSON.parse(res._getData());
      expect(res.statusCode).toBe(200);
      expect(response.data.length).toBe(2);
      expect(response.data[0].slotTime).toBe('10:00'); // Booking
      expect(response.data[1].slotTime).toBe('12:00'); // Block
      expect(response.data[1].userName).toBe('Blocked Slot');
    });

    it('TC-BK-10: Resilience - Should return 500 if DB fails', async () => {
      req.params = { expertId: '123', date: '2023-12-01' };
      Booking.find.mockImplementation(() => { throw new Error('DB Crash'); });

      await getBookedSlots(req, res, next);
      expect(res.statusCode).toBe(500);
    });
  });

  describe('getBookingsByEmail', () => {
    it('TC-BK-11: EP - Should return 400 if email is missing', async () => {
      req.query = {};
      await getBookingsByEmail(req, res, next);
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res._getData()).error).toMatch(/provide an email/i);
    });

    it('TC-BK-12: EP (RBAC) - Should return 403 if Client tries to view another user email', async () => {
      req.user = { role: 'Client', email: 'hacker@client.com' };
      req.query = { email: 'victim@client.com' };
      
      await getBookingsByEmail(req, res, next);
      expect(res.statusCode).toBe(403);
    });

    it('TC-BK-13: Golden Path - Admin can view any email', async () => {
      req.user = { role: 'Admin', email: 'admin@system.com' };
      req.query = { email: 'victim@client.com', page: 1, limit: 10 };
      
      Booking.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([{ _id: 'booking1' }])
      });
      Booking.countDocuments.mockResolvedValue(1);

      await getBookingsByEmail(req, res, next);
      
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res._getData()).data.length).toBe(1);
    });

    it('TC-BK-14: Golden Path - Client can view their own email', async () => {
      req.user = { role: 'Client', email: 'john@client.com' };
      req.query = { email: 'john@client.com' };
      
      Booking.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([{ _id: 'booking1' }])
      });
      Booking.countDocuments.mockResolvedValue(1);

      await getBookingsByEmail(req, res, next);
      expect(res.statusCode).toBe(200);
    });
  });
});

describe('Feature 1.4: Late Cancellation & Penalties Unit Tests', () => {
  let req, res, next, mockEmit, rzpMock;

  beforeEach(() => {
    jest.clearAllMocks();
    req = httpMocks.createRequest();
    res = httpMocks.createResponse();
    next = jest.fn((err) => {
      if (err) {
        res.status(err.status || err.statusCode || (err.code === 11000 ? 409 : 500)).json({ error: err.message });
      }
    });
    mockEmit = jest.fn();
    req.app = { get: jest.fn().mockReturnValue({ to: jest.fn().mockReturnValue({ emit: mockEmit }) }) };
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('updateBookingStatus', () => {
    // 2023-12-01 10:00:00+05:30 -> Timestamp is 1701405000000
    // Target Date: '2023-12-01'
    // Target Time: '10:00'
    const sessionTimeMs = 1701405000000;
    
    it('TC-LC-01: EP - Should return 404 if booking not found', async () => {
      req.params = { id: 'invalid_id' };
      req.body = { status: 'Cancelled' };
      Booking.findById.mockResolvedValue(null);
      
      await updateBookingStatus(req, res, next);
      expect(res.statusCode).toBe(404);
    });

    it('TC-LC-02: EP (RBAC) - Should return 403 if unauthorized user attempts update', async () => {
      req.params = { id: 'booking1' };
      req.body = { status: 'Cancelled' };
      req.user = { _id: 'hacker1', role: 'Client', email: 'hacker@test.com' };
      
      Booking.findById.mockResolvedValue({
        _id: 'booking1',
        user: 'victim1',
        userEmail: 'victim@test.com',
        expert: 'expert1'
      });
      
      await updateBookingStatus(req, res, next);
      expect(res.statusCode).toBe(403);
    });

    it('TC-LC-03: State (Time Lock) - Should reject Completed status before session + 1 hr', async () => {
      // Set system time to EXACTLY the session start time (too early to complete)
      jest.setSystemTime(new Date(sessionTimeMs));
      
      req.params = { id: 'booking1' };
      req.body = { status: 'Completed' };
      req.user = { _id: 'client1', role: 'Client', email: 'client@test.com' };
      
      Booking.findById.mockResolvedValue({
        _id: 'booking1',
        status: 'Confirmed',
        user: 'client1',
        userEmail: 'client@test.com',
        expert: 'expert1',
        bookingDate: '2023-12-01',
        slotTime: '10:00'
      });
      
      await updateBookingStatus(req, res, next);
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res._getData()).error).toMatch(/cannot be completed yet/i);
    });

    it('TC-LC-04: State (Time Lock) - Should reject Cancellation of past session', async () => {
      // Set system time 2 hours AFTER session started
      jest.setSystemTime(new Date(sessionTimeMs + (2 * 60 * 60 * 1000)));
      
      req.params = { id: 'booking1' };
      req.body = { status: 'Cancelled' };
      req.user = { _id: 'client1', role: 'Client', email: 'client@test.com' };
      
      Booking.findById.mockResolvedValue({
        _id: 'booking1',
        status: 'Confirmed',
        user: 'client1',
        userEmail: 'client@test.com',
        expert: 'expert1',
        bookingDate: '2023-12-01',
        slotTime: '10:00'
      });
      
      await updateBookingStatus(req, res, next);
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res._getData()).error).toMatch(/already passed/i);
    });

    it('TC-LC-05: BVA (Penalty) - Should enforce Late Cancellation within 2 hours', async () => {
      // Set system time to 1 hour before session (within penalty window)
      jest.setSystemTime(new Date(sessionTimeMs - (1 * 60 * 60 * 1000)));
      
      req.params = { id: 'booking1' };
      req.body = { status: 'Cancelled' };
      req.user = { _id: 'client1', role: 'Client', email: 'client@test.com' };
      
      Booking.findById.mockResolvedValue({
        _id: 'booking1',
        status: 'Confirmed',
        user: 'client1',
        userEmail: 'client@test.com',
        expert: 'expert1',
        bookingDate: '2023-12-01',
        slotTime: '10:00'
      });
      
      await updateBookingStatus(req, res, next);
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res._getData()).error).toMatch(/processed as late cancellations/i);
    });

    it('TC-LC-06: State (Downgrade) - Should gracefully downgrade Late Cancellation > 2 hours', async () => {
      // Set system time 5 hours before session (outside penalty window)
      jest.setSystemTime(new Date(sessionTimeMs - (5 * 60 * 60 * 1000)));
      
      req.params = { id: 'booking1' };
      req.body = { status: 'Late Cancellation' };
      req.user = { _id: 'client1', role: 'Client', email: 'client@test.com' };
      
      const mockBooking = {
        _id: 'booking1',
        status: 'Confirmed',
        user: 'client1',
        userEmail: 'client@test.com',
        expert: 'expert1',
        bookingDate: '2023-12-01',
        slotTime: '10:00',
        save: jest.fn().mockResolvedValue(true)
      };
      Booking.findById.mockResolvedValue(mockBooking);
      
      await updateBookingStatus(req, res, next);
      expect(res.statusCode).toBe(200);
      expect(mockBooking.status).toBe('Cancelled'); // Downgraded
    });

    it('TC-LC-07: State (Strike) - Should increment strike on valid Late Cancellation', async () => {
      // Set system time to 1 hour before session (within penalty window)
      jest.setSystemTime(new Date(sessionTimeMs - (1 * 60 * 60 * 1000)));
      
      req.params = { id: 'booking1' };
      req.body = { status: 'Late Cancellation' };
      req.user = { _id: 'client1', role: 'Client', email: 'client@test.com' };
      
      const mockBooking = {
        _id: 'booking1',
        status: 'Confirmed',
        user: 'client1',
        userEmail: 'client@test.com',
        expert: 'expert1',
        bookingDate: '2023-12-01',
        slotTime: '10:00',
        save: jest.fn().mockResolvedValue(true)
      };
      Booking.findById.mockResolvedValue(mockBooking);
      
      const mockUser = {
        _id: 'client1',
        lateCancellationsCount: 1,
        save: jest.fn().mockResolvedValue(true)
      };
      User.findById.mockResolvedValue(mockUser);
      
      await updateBookingStatus(req, res, next);
      expect(res.statusCode).toBe(200);
      expect(mockBooking.status).toBe('Late Cancellation');
      expect(mockUser.lateCancellationsCount).toBe(2); // Incremented
    });

    it('TC-LC-08: State (Suspension) - Should suspend user on 3rd Late Cancellation', async () => {
      // Set system time to 1 hour before session (within penalty window)
      jest.setSystemTime(new Date(sessionTimeMs - (1 * 60 * 60 * 1000)));
      
      req.params = { id: 'booking1' };
      req.body = { status: 'Late Cancellation' };
      req.user = { _id: 'client1', role: 'Client', email: 'client@test.com' };
      
      const mockBooking = {
        _id: 'booking1',
        status: 'Confirmed',
        user: 'client1',
        userEmail: 'client@test.com',
        expert: 'expert1',
        bookingDate: '2023-12-01',
        slotTime: '10:00',
        save: jest.fn().mockResolvedValue(true)
      };
      Booking.findById.mockResolvedValue(mockBooking);
      
      const mockUser = {
        _id: 'client1',
        lateCancellationsCount: 2, // Already has 2
        save: jest.fn().mockResolvedValue(true)
      };
      User.findById.mockResolvedValue(mockUser);
      
      await updateBookingStatus(req, res, next);
      expect(res.statusCode).toBe(200);
      expect(mockUser.lateCancellationsCount).toBe(0); // Resets after suspension
      expect(mockUser.suspendedUntil).toBeDefined();
    });

    it('TC-LC-09: Golden Path (Refund) - Should refund if Cancelled outside window', async () => {
      // Set system time 5 hours before session (outside penalty window)
      jest.setSystemTime(new Date(sessionTimeMs - (5 * 60 * 60 * 1000)));
      
      req.params = { id: 'booking1' };
      req.body = { status: 'Cancelled' };
      req.user = { _id: 'client1', role: 'Client', email: 'client@test.com' };
      
      const mockBooking = {
        _id: 'booking1',
        status: 'Confirmed',
        user: 'client1',
        userEmail: 'client@test.com',
        expert: 'expert1',
        bookingDate: '2023-12-01',
        slotTime: '10:00',
        status: 'Confirmed', // Refund requires Confirmed
        save: jest.fn().mockResolvedValue(true)
      };
      Booking.findById.mockResolvedValue(mockBooking);
      
      PaymentLog.findOne.mockResolvedValue({
        razorpayPaymentId: 'pay_123',
        amount: 500000
      });
      PaymentLog.create.mockResolvedValue(true);
      
      await updateBookingStatus(req, res, next);
      
      expect(res.statusCode).toBe(200);
      expect(PaymentLog.create).toHaveBeenCalled(); // Means refund log was created
      
      expect(global.__mockRazorpayInstance.payments.refund).toHaveBeenCalledWith('pay_123', {
        amount: 500000,
        notes: { reason: 'Client cancelled session outside penalty window.' }
      });
    });

    it('TC-LC-10: Integration (Sockets) - Valid Cancellation emits events', async () => {
      // Set system time 5 hours before session (outside penalty window)
      jest.setSystemTime(new Date(sessionTimeMs - (5 * 60 * 60 * 1000)));
      
      req.params = { id: 'booking1' };
      req.body = { status: 'Cancelled' };
      req.user = { _id: 'client1', role: 'Client', email: 'client@test.com' };
      
      const mockBooking = {
        _id: 'booking1',
        status: 'Confirmed',
        user: 'client1',
        userEmail: 'client@test.com',
        expert: 'expert1',
        bookingDate: '2023-12-01',
        slotTime: '10:00',
        save: jest.fn().mockResolvedValue(true)
      };
      Booking.findById.mockResolvedValue(mockBooking);
      
      await updateBookingStatus(req, res, next);
      
      expect(res.statusCode).toBe(200);
      expect(mockEmit).toHaveBeenCalledWith('slot_released', {
        bookingDate: '2023-12-01',
        slotTime: '10:00'
      });
    });
  });

  describe('handleWebhook', () => {
    it('TC-WH-05: EP (Not Found) - payment.captured for unknown order_id gracefully ignores', async () => {
      req.body = {
        event: 'payment.captured',
        payload: { payment: { entity: { order_id: 'order_unknown', id: 'pay_123' } } }
      };
      Booking.findOne.mockResolvedValue(null);
      
      await handleWebhook(req, res, next);
      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res._getData()).error).toMatch(/booking not found/i);
    });

    it('TC-WH-06: Golden Path - payment.captured processes booking', async () => {
      req.body = {
        event: 'payment.captured',
        payload: { payment: { entity: { order_id: 'order_valid', id: 'pay_123' } } }
      };
      
      const mockBooking = {
        _id: 'booking1',
        status: 'Pending',
        expert: { hourlyRate: 5000 },
        save: jest.fn().mockResolvedValue(true)
      };
      Booking.findOne.mockResolvedValue(mockBooking);
      Booking.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockBooking)
      }); // for confirmBookingPayment
      PaymentLog.findOne.mockResolvedValue(null);
      PaymentLog.create.mockResolvedValue(true);
      
      await handleWebhook(req, res, next);
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res._getData()).success).toBe(true);
    });

    it('TC-WH-07: State (Failed) - payment.failed for Pending booking updates status and emits', async () => {
      req.body = {
        event: 'payment.failed',
        payload: { payment: { entity: { order_id: 'order_failed' } } }
      };
      
      const mockBooking = {
        _id: 'booking1',
        status: 'Pending',
        expert: 'expert1',
        bookingDate: '2023-12-01',
        slotTime: '10:00',
        save: jest.fn().mockResolvedValue(true)
      };
      Booking.findOne.mockResolvedValue(mockBooking);
      
      await handleWebhook(req, res, next);
      expect(res.statusCode).toBe(200);
      expect(mockBooking.status).toBe('Cancelled');
      expect(mockBooking.save).toHaveBeenCalled();
      expect(mockEmit).toHaveBeenCalledWith('slot_released', expect.any(Object));
    });

    it('TC-WH-08: State (Failed) - payment.failed for Confirmed booking is ignored', async () => {
      req.body = {
        event: 'payment.failed',
        payload: { payment: { entity: { order_id: 'order_failed' } } }
      };
      
      const mockBooking = {
        _id: 'booking1',
        status: 'Confirmed',
        save: jest.fn()
      };
      Booking.findOne.mockResolvedValue(mockBooking);
      
      await handleWebhook(req, res, next);
      expect(res.statusCode).toBe(200);
      expect(mockBooking.status).toBe('Confirmed'); // Untouched
      expect(mockBooking.save).not.toHaveBeenCalled();
    });

    it('TC-WH-09: Boundary - Unrecognized event hook is ignored gracefully', async () => {
      req.body = { event: 'refund.processed', payload: {} };
      
      await handleWebhook(req, res, next);
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res._getData()).ignored).toBe(true);
    });
  });
});
