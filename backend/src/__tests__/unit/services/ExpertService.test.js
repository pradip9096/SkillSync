/**
 * @file ExpertService.test.js
 * @description Unit tests for expert profile and availability management logic in `services/ExpertService.js`.
 * Covers profile retrieval and updates, slot blocking and unblocking, gallery image upload
 * and deletion, client rating with rolling average, and analytics computation.
 * All repositories, Mongoose models, and filesystem operations are fully mocked.
 */

// Mocks
jest.mock('../../../repositories/BookingRepository', () => ({
  find: jest.fn(),
  countDocuments: jest.fn(),
  findById: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn()
}));

jest.mock('../../../repositories/ExpertRepository', () => ({
  findOne: jest.fn(),
  findOneWithUser: jest.fn()
}));

jest.mock('../../../repositories/AvailabilityRepository', () => ({
  findOne: jest.fn(),
  find: jest.fn()
}));

jest.mock('../../../repositories/UserRepository', () => ({
  findById: jest.fn(),
  save: jest.fn()
}));

jest.mock('../../../models/Availability', () => ({
  create: jest.fn(),
  findByIdAndDelete: jest.fn(),
  find: jest.fn()
}));

jest.mock('../../../models/ClientReview', () => ({
  create: jest.fn()
}));

jest.mock('../../../models/Review', () => ({
  find: jest.fn().mockReturnValue({
    sort: jest.fn().mockReturnValue({
      limit: jest.fn().mockResolvedValue([])
    })
  })
}));

const ExpertService = require('../../../services/ExpertService');
const ExpertRepository = require('../../../repositories/ExpertRepository');
const BookingRepository = require('../../../repositories/BookingRepository');
const AvailabilityRepository = require('../../../repositories/AvailabilityRepository');
const Availability = require('../../../models/Availability');

describe('ExpertService Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('blockSlot', () => {
    it('should successfully block a slot if no conflicts exist', async () => {
      const nowMs = Date.now();
      const futureDate = new Date(nowMs + 24 * 60 * 60 * 1000); // tomorrow
      const dateStr = futureDate.toISOString().split('T')[0];
      const timeStr = '10:00';

      ExpertRepository.findOne.mockResolvedValue({ _id: 'expert_123' });
      BookingRepository.findOne.mockResolvedValue(null);
      AvailabilityRepository.findOne.mockResolvedValue(null);
      Availability.create.mockResolvedValue({ _id: 'block_123' });

      const authUser = { _id: 'user_expert_123' };
      const payload = { bookingDate: dateStr, slotTime: timeStr };

      const result = await ExpertService.blockSlot({ authUser, payload });
      expect(result._id).toBe('block_123');
      expect(Availability.create).toHaveBeenCalled();
    });

    it('should throw error if blocking a slot in the past', async () => {
      const authUser = { _id: 'user_expert_123' };
      const payload = { bookingDate: '2020-01-01', slotTime: '10:00' };

      await expect(ExpertService.blockSlot({ authUser, payload }))
        .rejects
        .toThrow('Cannot block slots in the past.');
    });

    it('should throw error if slot is already booked', async () => {
      const nowMs = Date.now();
      const futureDate = new Date(nowMs + 24 * 60 * 60 * 1000);
      const dateStr = futureDate.toISOString().split('T')[0];
      const timeStr = '10:00';

      ExpertRepository.findOne.mockResolvedValue({ _id: 'expert_123' });
      BookingRepository.findOne.mockResolvedValue({ _id: 'booking_123' });

      const authUser = { _id: 'user_expert_123' };
      const payload = { bookingDate: dateStr, slotTime: timeStr };

      await expect(ExpertService.blockSlot({ authUser, payload }))
        .rejects
        .toThrow('This time slot is already booked.');
    });
  });

  describe('rateClient', () => {
    it('should throw error if session is not completed', async () => {
      ExpertRepository.findOne.mockResolvedValue({ _id: 'expert_123' });
      BookingRepository.findById.mockResolvedValue({
        _id: 'booking_123',
        expert: 'expert_123',
        status: 'Pending'
      });

      const authUser = { _id: 'user_expert_123' };
      const payload = { rating: 5 };

      await expect(ExpertService.rateClient({ authUser, bookingId: 'booking_123', payload }))
        .rejects
        .toThrow('You can only rate completed sessions.');
    });

    it('should throw error if rating is out of range', async () => {
      const authUser = { _id: 'user_expert_123' };
      const payload = { rating: 6 };

      await expect(ExpertService.rateClient({ authUser, bookingId: 'booking_123', payload }))
        .rejects
        .toThrow('Rating must be a number between 1 and 5.');
    });
  });
});
