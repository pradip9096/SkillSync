process.env.RAZORPAY_KEY_ID = 'test_key';
process.env.RAZORPAY_KEY_SECRET = 'test_secret';
const mongoose = require('mongoose');

// Mocks
jest.spyOn(mongoose.Types.ObjectId, 'isValid').mockReturnValue(true);
jest.spyOn(mongoose, 'startSession').mockResolvedValue({
  withTransaction: jest.fn().mockImplementation(cb => cb()),
  endSession: jest.fn()
});

jest.mock('../../../models/ProcessedWebhook', () => ({
  create: jest.fn()
}));
jest.mock('../../../models/PaymentLog', () => ({
  create: jest.fn(),
  findOne: jest.fn()
}));
jest.mock('../../../models/Notification', () => ({
  create: jest.fn()
}));

jest.mock('../../../repositories/BookingRepository', () => ({
  findOne: jest.fn(),
  createInstance: jest.fn(),
  save: jest.fn(),
  findById: jest.fn()
}));

jest.mock('../../../repositories/ExpertRepository', () => ({
  findByIdWithUser: jest.fn(),
  findOne: jest.fn(),
  findById: jest.fn()
}));

jest.mock('../../../repositories/AvailabilityRepository', () => ({
  findOne: jest.fn()
}));

jest.mock('../../../repositories/UserRepository', () => ({
  save: jest.fn(),
  findById: jest.fn()
}));

jest.mock('razorpay', () => {
  return jest.fn().mockImplementation(() => ({
    orders: {
      create: jest.fn().mockResolvedValue({ id: 'order_test_123', amount: 100000 })
    },
    payments: {
      refund: jest.fn().mockResolvedValue({ id: 'rfnd_test_123' })
    }
  }));
});

jest.mock('../../../config/agenda', () => ({
  schedule: jest.fn(),
  now: jest.fn(),
  _collection: true
}));

jest.mock('../../../services/reminderScheduler', () => ({
  scheduleSessionReminders: jest.fn(),
  cancelScheduledReminders: jest.fn()
}));

const BookingService = require('../../../services/BookingService');
const BookingRepository = require('../../../repositories/BookingRepository');
const ExpertRepository = require('../../../repositories/ExpertRepository');
const AvailabilityRepository = require('../../../repositories/AvailabilityRepository');

describe('BookingService Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createBooking', () => {
    it('should create a booking successfully when no conflicts exist', async () => {
      // Setup
      ExpertRepository.findByIdWithUser.mockResolvedValue({
        _id: 'expert_123',
        hourlyRate: 1000,
        user: { _id: 'user_expert', email: 'expert@test.com' }
      });
      BookingRepository.findOne.mockResolvedValue(null); // No conflicting booking
      AvailabilityRepository.findOne.mockResolvedValue(null); // No blocked slot
      
      const mockBooking = { _id: 'booking_123' };
      BookingRepository.createInstance.mockReturnValue(mockBooking);

      const payload = {
        expert: 'expert_123',
        userName: 'John',
        userEmail: 'john@test.com',
        userPhone: '+919876543210',
        bookingDate: '2026-10-10',
        slotTime: '10:00'
      };
      
      const authUser = { _id: 'client_123', role: 'Client', email: 'john@test.com' };

      const result = await BookingService.createBooking({ payload, authUser });
      
      expect(result).toBeDefined();
      expect(result.razorpayOrderId).toBe('order_test_123');
      expect(BookingRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should throw an error if the slot is already booked (double booking)', async () => {
      ExpertRepository.findByIdWithUser.mockResolvedValue({
        _id: 'expert_123',
        hourlyRate: 1000,
        user: { _id: 'user_expert', email: 'expert@test.com' }
      });
      BookingRepository.findOne.mockResolvedValue({ _id: 'existing_booking' });

      const payload = {
        expert: 'expert_123',
        userName: 'John',
        userEmail: 'john@test.com',
        userPhone: '+919876543210',
        bookingDate: '2026-10-10',
        slotTime: '10:00'
      };
      
      const authUser = { _id: 'client_123', role: 'Client', email: 'john@test.com' };

      await expect(BookingService.createBooking({ payload, authUser }))
        .rejects
        .toThrow('This time slot is already booked.');
    });

    it('should throw 403 if the user is suspended', async () => {
      const payload = { expert: 'expert_123' };
      const authUser = { 
        _id: 'client_123', 
        role: 'Client', 
        suspendedUntil: new Date(Date.now() + 100000) 
      };

      await expect(BookingService.createBooking({ payload, authUser }))
        .rejects
        .toThrow(/temporarily suspended/);
    });
  });

  describe('updateBookingStatus', () => {
    let originalNow;
    beforeAll(() => {
      originalNow = Date.now;
      Date.now = jest.fn(() => new Date('2026-10-10T12:00:00Z').getTime()); // mock current time to 12:00 UTC
    });
    afterAll(() => {
      Date.now = originalNow;
    });

    it('should throw time-lock error if trying to complete before 1 hour has passed', async () => {
      // Mock current time: 2026-10-10T12:00:00Z (17:30 IST)
      // Session time: 17:00 IST (11:30 UTC)
      // Session + 1 hr = 18:00 IST (12:30 UTC)
      // 17:30 IST < 18:00 IST -> Should throw time-lock violation
      BookingRepository.findById.mockResolvedValue({
        _id: 'booking_123',
        status: 'Confirmed',
        user: 'client_123',
        bookingDate: '2026-10-10',
        slotTime: '17:00'
      });

      const authUser = { _id: 'client_123', role: 'Client', email: 'test@test.com' };

      await expect(BookingService.updateBookingStatus({
        bookingId: 'booking_123',
        status: 'Completed',
        authUser
      })).rejects.toThrow(/Time-lock violation/);
    });

    it('should allow late cancellation within 2 hours', async () => {
      // Mock current time: 2026-10-10T12:00:00Z (17:30 IST)
      // Session time: 18:30 IST (13:00 UTC)
      // Session is in 1 hour (which is within 2 hours) -> Should warn late cancellation
      BookingRepository.findById.mockResolvedValue({
        _id: 'booking_123',
        status: 'Confirmed',
        user: 'client_123',
        userEmail: 'test@test.com',
        bookingDate: '2026-10-10',
        slotTime: '18:30'
      });

      const authUser = { _id: 'client_123', role: 'Client', email: 'test@test.com' };

      await expect(BookingService.updateBookingStatus({
        bookingId: 'booking_123',
        status: 'Cancelled',
        authUser
      })).rejects.toThrow(/must be processed as late cancellations/);
    });
  });
});
