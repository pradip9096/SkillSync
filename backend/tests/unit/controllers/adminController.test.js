const httpMocks = require('node-mocks-http');
const mongoose = require('mongoose');
const {
  getAllUsers,
  getAllBookings,
  updateBookingStatusByAdmin,
  deleteBookingByAdmin,
  createExpertByAdmin,
  deleteExpertByAdmin,
  resetUserPenalties
} = require('../../../src/controllers/adminController');

const User = require('../../../src/models/User');
const Expert = require('../../../src/models/Expert');
const Booking = require('../../../src/models/Booking');

jest.mock('../../../src/models/User');
jest.mock('../../../src/models/Expert');
jest.mock('../../../src/models/Booking');

describe('Feature 1.10: Admin & Analytics Dashboards Unit Tests', () => {
  let req, res, mockEmit;
  const mockSession = {
    withTransaction: jest.fn(async (cb) => {
      await cb();
    }),
    endSession: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    req = httpMocks.createRequest();
    res = httpMocks.createResponse();
    mockEmit = jest.fn();
    req.app = { get: jest.fn().mockReturnValue({ to: jest.fn().mockReturnValue({ emit: mockEmit }) }) };
    mongoose.startSession = jest.fn().mockResolvedValue(mockSession);
  });

  describe('getAllUsers', () => {
    it('TC-ADM-01: Golden Path - Returns paginated user list', async () => {
      req.query = { page: 1, limit: 10 };
      User.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([{ _id: 'user1' }])
      });
      User.countDocuments.mockResolvedValue(1);

      await getAllUsers(req, res);
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res._getData()).count).toBe(1);
    });
  });

  describe('getAllBookings', () => {
    it('TC-ADM-02: Golden Path - Returns paginated bookings', async () => {
      Booking.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([{ _id: 'book1' }])
      });
      Booking.countDocuments.mockResolvedValue(1);

      await getAllBookings(req, res);
      expect(res.statusCode).toBe(200);
    });
  });

  describe('updateBookingStatusByAdmin', () => {
    it('TC-ADM-03: State (Invalid) - Return 400 for invalid status', async () => {
      req.body = { status: 'SuperConfirmed' };
      await updateBookingStatusByAdmin(req, res);
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res._getData()).error).toMatch(/valid status/i);
    });

    it('TC-ADM-04: Golden Path - Bypasses lock, sets status, emits slot_released', async () => {
      req.params = { id: 'book1' };
      req.body = { status: 'Cancelled' };
      const mockBooking = {
        _id: 'book1',
        status: 'Confirmed',
        expert: 'expert1',
        save: jest.fn().mockResolvedValue(true)
      };
      Booking.findById.mockResolvedValue(mockBooking);

      await updateBookingStatusByAdmin(req, res);
      expect(res.statusCode).toBe(200);
      expect(mockBooking.bypassTimeLock).toBe(true);
      expect(mockBooking.status).toBe('Cancelled');
      expect(mockBooking.save).toHaveBeenCalled();
      expect(req.app.get('io').to).toHaveBeenCalledWith('expert1');
      expect(mockEmit).toHaveBeenCalledWith('slot_released', expect.any(Object));
    });
  });

  describe('deleteBookingByAdmin', () => {
    it('TC-ADM-05: Golden Path - Deletes booking and emits slot_released', async () => {
      req.params = { id: 'book1' };
      Booking.findById.mockResolvedValue({ _id: 'book1', expert: 'expert1' });
      Booking.findByIdAndDelete.mockResolvedValue(true);

      await deleteBookingByAdmin(req, res);
      expect(res.statusCode).toBe(200);
      expect(Booking.findByIdAndDelete).toHaveBeenCalledWith('book1');
      expect(mockEmit).toHaveBeenCalledWith('slot_released', expect.any(Object));
    });
  });

  describe('createExpertByAdmin', () => {
    it('TC-ADM-06: BVA (Boundary) - Returns 400 if hourlyRate < 100 or phone is invalid', async () => {
      req.body = {
        email: 'test@test.com', password: 'pass', name: 'Test',
        phone: '123', // invalid
        category: 'Tech', experience: 5, hourlyRate: 50 // invalid
      };
      await createExpertByAdmin(req, res);
      expect(res.statusCode).toBe(400);
    });

    it('TC-ADM-07: State (Idempotent) - Returns 400 if user account exists', async () => {
      req.body = {
        email: 'test@test.com', password: 'pass', name: 'Test',
        phone: '+919876543210', category: 'Tech', experience: 5, hourlyRate: 500
      };
      User.findOne.mockResolvedValue({ _id: 'existingUser' });
      await createExpertByAdmin(req, res);
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res._getData()).error).toMatch(/already exists/i);
    });

    it('TC-ADM-08: Golden Path - Creates User and Expert via transaction', async () => {
      req.body = {
        email: 'test@test.com', password: 'pass', name: 'Test',
        phone: '+919876543210', category: 'Tech', experience: 5, hourlyRate: 500
      };
      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue([{ _id: 'newUser' }]);
      Expert.create.mockResolvedValue([{ _id: 'newExpert' }]);

      await createExpertByAdmin(req, res);
      expect(res.statusCode).toBe(201);
      expect(mongoose.startSession).toHaveBeenCalled();
      expect(mockSession.withTransaction).toHaveBeenCalled();
      expect(User.create).toHaveBeenCalled();
      expect(Expert.create).toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalled();
    });
  });

  describe('deleteExpertByAdmin', () => {
    it('TC-ADM-09: Golden Path - Drops Expert, User, and Bookings via transaction', async () => {
      req.params = { id: 'expert1' };
      Expert.findById.mockResolvedValue({ _id: 'expert1', user: 'user1' });
      
      await deleteExpertByAdmin(req, res);
      
      expect(res.statusCode).toBe(200);
      expect(mongoose.startSession).toHaveBeenCalled();
      expect(mockSession.withTransaction).toHaveBeenCalled();
      expect(User.findByIdAndDelete).toHaveBeenCalledWith('user1', { session: mockSession });
      expect(Booking.deleteMany).toHaveBeenCalledWith({ expert: 'expert1' }, { session: mockSession });
      expect(Expert.findByIdAndDelete).toHaveBeenCalledWith('expert1', { session: mockSession });
    });
  });

  describe('resetUserPenalties', () => {
    it('TC-ADM-10: Golden Path - Clears suspension properties', async () => {
      req.params = { id: 'user1' };
      const mockUser = {
        _id: 'user1',
        lateCancellationsCount: 3,
        suspendedUntil: new Date(),
        save: jest.fn().mockResolvedValue(true)
      };
      User.findById.mockResolvedValue(mockUser);

      await resetUserPenalties(req, res);
      
      expect(res.statusCode).toBe(200);
      expect(mockUser.lateCancellationsCount).toBe(0);
      expect(mockUser.suspendedUntil).toBeNull();
      expect(mockUser.save).toHaveBeenCalled();
    });
  });
});
