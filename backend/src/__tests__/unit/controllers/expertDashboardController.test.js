/**
 * @file expertDashboardController.test.js
 * @description Unit tests for expert dashboard controller functions in `expertDashboardController.js`.
 * Covers booking retrieval, profile management, slot blocking and unblocking, gallery image
 * upload and deletion, client rating, and analytics retrieval. ExpertService is fully mocked.
 */

const httpMocks = require('node-mocks-http');
const Expert = require('../../../models/Expert');
const Booking = require('../../../models/Booking');
const Availability = require('../../../models/Availability');
const User = require('../../../models/User');
const ClientReview = require('../../../models/ClientReview');
const Review = require('../../../models/Review');
const { blockSlot, unblockSlot, rateClient, getExpertBookings, getExpertProfile, updateExpertProfile } = require('../../../controllers/expertDashboardController');

jest.mock('mongoose', () => {
  const originalMongoose = jest.requireActual('mongoose');
  return {
    ...originalMongoose,
    startSession: jest.fn().mockResolvedValue({
      withTransaction: jest.fn().mockImplementation(cb => cb()),
      endSession: jest.fn()
    })
  };
});
jest.mock('../../../models/Expert');
jest.mock('../../../models/Booking');
jest.mock('../../../models/Availability');
jest.mock('../../../models/User');
jest.mock('../../../models/ClientReview');
jest.mock('../../../models/Review');

describe('Feature 1.5: Expert Availability Management Unit Tests', () => {
  let req, res, mockEmit;

  // The test slot we will try to block/unblock
  const testBookingDate = '2023-12-01';
  const testSlotTime = '10:00';
  
  // Timestamps for our fake clock (IST +05:30 offset)
  // Date.parse('2023-12-01T10:00:00+05:30') is 1701405000000
  const slotTimeMs = 1701405000000;
  const timeInPastMs = slotTimeMs + (24 * 60 * 60 * 1000); // 1 day after slot
  const timeInFutureMs = slotTimeMs - (24 * 60 * 60 * 1000); // 1 day before slot

  beforeEach(() => {
    jest.clearAllMocks();
    req = httpMocks.createRequest();
    res = httpMocks.createResponse();
    mockEmit = jest.fn();
    req.app = { get: jest.fn().mockReturnValue({ to: jest.fn().mockReturnValue({ emit: mockEmit }) }) };
    
    // Default logged-in user
    req.user = { _id: 'user1' };
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('blockSlot', () => {
    it('TC-AM-01: EP (Invalid) - Should return 400 if bookingDate or slotTime is missing', async () => {
      req.body = { bookingDate: '2023-12-01' }; // missing slotTime
      
      await blockSlot(req, res);
      
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res._getData()).error).toMatch(/provide bookingDate and slotTime/i);
    });

    it('TC-AM-02: BVA (Time) - Should return 400 if attempt to block slot in the past', async () => {
      // Set system clock to a time AFTER the slot
      jest.setSystemTime(new Date(timeInPastMs));
      
      req.body = { bookingDate: testBookingDate, slotTime: testSlotTime };
      
      await blockSlot(req, res);
      
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res._getData()).error).toMatch(/in the past/i);
    });

    it('TC-AM-03: State (Not Found) - Should return 404 if logged-in user has no Expert profile', async () => {
      jest.setSystemTime(new Date(timeInFutureMs));
      req.body = { bookingDate: testBookingDate, slotTime: testSlotTime };
      
      Expert.findOne.mockResolvedValue(null);
      
      await blockSlot(req, res);
      
      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res._getData()).error).toMatch(/not found/i);
    });

    it('TC-AM-04: State (Concurrency) - Should return 400 if slot is already booked by a Client', async () => {
      jest.setSystemTime(new Date(timeInFutureMs));
      req.body = { bookingDate: testBookingDate, slotTime: testSlotTime };
      
      Expert.findOne.mockResolvedValue({ _id: 'expert1' });
      Booking.findOne.mockResolvedValue({ _id: 'existingBooking1' }); // Found a booking
      
      await blockSlot(req, res);
      
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res._getData()).error).toMatch(/already booked/i);
    });

    it('TC-AM-05: State (Concurrency) - Should return 400 if slot is already blocked by the expert', async () => {
      jest.setSystemTime(new Date(timeInFutureMs));
      req.body = { bookingDate: testBookingDate, slotTime: testSlotTime };
      
      Expert.findOne.mockResolvedValue({ _id: 'expert1' });
      Booking.findOne.mockResolvedValue(null); // No client booking
      Availability.findOne.mockResolvedValue({ _id: 'existingBlock1' }); // Found a block
      
      await blockSlot(req, res);
      
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res._getData()).error).toMatch(/already blocked/i);
    });

    it('TC-AM-06: Golden Path - Should block valid future slot and emit socket event', async () => {
      jest.setSystemTime(new Date(timeInFutureMs));
      req.body = { bookingDate: testBookingDate, slotTime: testSlotTime };
      
      Expert.findOne.mockResolvedValue({ _id: 'expert1' });
      Booking.findOne.mockResolvedValue(null);
      Availability.findOne.mockResolvedValue(null);
      
      const newBlock = { _id: 'block1', bookingDate: testBookingDate, slotTime: testSlotTime };
      Availability.create.mockResolvedValue(newBlock);
      
      await blockSlot(req, res);
      
      expect(res.statusCode).toBe(201);
      const response = JSON.parse(res._getData());
      expect(response.success).toBe(true);
      expect(response.data._id).toBe('block1');
      
      expect(Availability.create).toHaveBeenCalledWith(expect.objectContaining({
        expert: 'expert1',
        bookingDate: testBookingDate,
        slotTime: testSlotTime,
        notes: 'Blocked by Expert'
      }));
      
      expect(mockEmit).toHaveBeenCalledWith('slot_booked', {
        bookingDate: testBookingDate,
        slotTime: testSlotTime
      });
    });
  });

  describe('unblockSlot', () => {
    it('TC-AM-07: EP (Invalid) - Should return 400 if bookingDate or slotTime is missing', async () => {
      req.body = { slotTime: '10:00' }; // missing bookingDate
      
      await unblockSlot(req, res);
      
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res._getData()).error).toMatch(/provide bookingDate and slotTime/i);
    });

    it('TC-AM-08: State (Not Found) - Should return 404 if attempt to unblock a slot not in DB', async () => {
      req.body = { bookingDate: testBookingDate, slotTime: testSlotTime };
      
      Expert.findOne.mockResolvedValue({ _id: 'expert1' });
      Availability.findOne.mockResolvedValue(null); // No block found
      
      await unblockSlot(req, res);
      
      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res._getData()).error).toMatch(/record not found/i);
    });

    it('TC-AM-09: Golden Path - Should unblock slot and emit socket event', async () => {
      req.body = { bookingDate: testBookingDate, slotTime: testSlotTime };
      
      Expert.findOne.mockResolvedValue({ _id: 'expert1' });
      Availability.findOne.mockResolvedValue({ _id: 'block1' });
      Availability.findByIdAndDelete.mockResolvedValue(true);
      
      await unblockSlot(req, res);
      
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res._getData()).success).toBe(true);
      
      expect(Availability.findByIdAndDelete).toHaveBeenCalledWith('block1');
      expect(mockEmit).toHaveBeenCalledWith('slot_released', expect.objectContaining({
        expertId: 'expert1',
        bookingDate: testBookingDate,
        slotTime: testSlotTime
      }));
    });
  });

  describe('Feature 1.7: Reviews & P2P Feedback (rateClient)', () => {
    it('TC-REV-08: BVA (Boundary) - Should return 400 if rating is missing or invalid', async () => {
      req.body = { rating: 6 }; // invalid rating > 5
      req.params = { id: 'booking1' };
      await rateClient(req, res);
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res._getData()).error).toMatch(/Rating must be a number between 1 and 5/i);
    });

    it('TC-REV-09: State (RBAC) - Should return 404 if logged-in user has no Expert profile', async () => {
      req.body = { rating: 5 };
      req.params = { id: 'booking1' };
      Expert.findOne.mockResolvedValue(null);
      await rateClient(req, res);
      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res._getData()).error).toMatch(/Expert profile not found/i);
    });

    it('TC-REV-10: State (RBAC) - Should return 401 if booking does not belong to Expert', async () => {
      req.body = { rating: 5 };
      req.params = { id: 'booking1' };
      Expert.findOne.mockResolvedValue({ _id: 'expert1' });
      Booking.findById.mockResolvedValue({ _id: 'booking1', expert: { toString: () => 'differentExpert' } });
      await rateClient(req, res);
      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res._getData()).error).toMatch(/Not authorized to rate this session/i);
    });

    it('TC-REV-11: State (Workflow) - Should return 400 if booking is not Completed', async () => {
      req.body = { rating: 5 };
      req.params = { id: 'booking1' };
      Expert.findOne.mockResolvedValue({ _id: 'expert1' });
      Booking.findById.mockResolvedValue({ 
        _id: 'booking1', 
        expert: { toString: () => 'expert1' },
        status: 'Pending'
      });
      await rateClient(req, res);
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res._getData()).error).toMatch(/only rate completed sessions/i);
    });

    it('TC-REV-12: State (Idempotency) - Should return 400 if booking is already client-rated', async () => {
      req.body = { rating: 5 };
      req.params = { id: 'booking1' };
      Expert.findOne.mockResolvedValue({ _id: 'expert1' });
      Booking.findById.mockResolvedValue({ 
        _id: 'booking1', 
        expert: { toString: () => 'expert1' },
        status: 'Completed',
        isClientRated: true
      });
      await rateClient(req, res);
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res._getData()).error).toMatch(/already been rated/i);
    });

    it('TC-REV-13: Golden Path - Should mathematically update client rating, save review, and mark booking', async () => {
      req.body = { rating: 2, comment: 'Late' };
      req.params = { id: 'booking1' };
      
      Expert.findOne.mockResolvedValue({ _id: 'expert1', name: 'Expert Bob' });
      
      const mockBooking = { 
        _id: 'booking1', 
        expert: { toString: () => 'expert1' },
        status: 'Completed',
        user: 'clientUser1',
        isClientRated: false,
        save: jest.fn().mockResolvedValue(true)
      };
      Booking.findById.mockResolvedValue(mockBooking);
      
      const mockUser = {
        _id: 'clientUser1',
        rating: 5,
        numReviews: 1,
        save: jest.fn().mockResolvedValue(true)
      };
      User.findById.mockResolvedValue(mockUser);
      
      const mockClientReview = { _id: 'clientReview1', rating: 2 };
      ClientReview.create.mockResolvedValue([mockClientReview]);
      
      const next = jest.fn();
      await rateClient(req, res, next);
      if (res.statusCode !== 200) { console.error('TC-REV-13 Error:', res._getData()); }
      expect(res.statusCode).toBe(200);
      
      // Math check: Average = 5, Count = 1, Total = 5. New rating = 2. Total = 7. Count = 2. Average = 7/2 = 3.5.
      expect(mockUser.numReviews).toBe(2);
      expect(mockUser.rating).toBeCloseTo(3.5, 2);
      expect(mockUser.save).toHaveBeenCalled();
      
      // Booking check
      expect(mockBooking.isClientRated).toBe(true);
      expect(mockBooking.save).toHaveBeenCalled();
      
      // Review Creation check
      expect(ClientReview.create).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            client: 'clientUser1',
            expert: 'expert1',
            rating: 2,
            comment: 'Late'
          })
        ]),
        expect.anything()
      );
    });
  });

  describe('getExpertBookings', () => {
    let req, res;
    beforeEach(() => {
      jest.clearAllMocks();
      req = httpMocks.createRequest();
      res = httpMocks.createResponse();
      req.user = { _id: 'user1' };
    });

    it('Should return 404 if expert profile not found', async () => {
      Expert.findOne.mockResolvedValue(null);
      await getExpertBookings(req, res);
      expect(res.statusCode).toBe(404);
    });

    it('Should fetch paginated bookings', async () => {
      Expert.findOne.mockResolvedValue({ _id: 'expert1' });
      Booking.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([{ _id: 'booking1' }])
      });
      Booking.countDocuments.mockResolvedValue(1);

      await getExpertBookings(req, res);
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res._getData()).data[0]._id).toBe('booking1');
    });
  });

  describe('getExpertProfile', () => {
    let req, res;
    beforeEach(() => {
      jest.clearAllMocks();
      req = httpMocks.createRequest();
      res = httpMocks.createResponse();
      req.user = { _id: 'user1' };
    });

    it('Should fetch profile', async () => {
      Expert.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue({ _id: 'expert1' })
      });
      await getExpertProfile(req, res);
      expect(res.statusCode).toBe(200);
    });
  });

  describe('updateExpertProfile', () => {
    let req, res;
    beforeEach(() => {
      jest.clearAllMocks();
      req = httpMocks.createRequest();
      res = httpMocks.createResponse();
      req.user = { _id: 'user1' };
    });

    it('Should update profile details', async () => {
      req.body = { experience: 5, hourlyRate: 500 };
      const mockExpert = { _id: 'expert1', save: jest.fn().mockResolvedValue({ _id: 'expert1', experience: 5, hourlyRate: 500 }) };
      Expert.findOne.mockResolvedValue(mockExpert);
      
      await updateExpertProfile(req, res);
      expect(res.statusCode).toBe(200);
      expect(mockExpert.experience).toBe(5);
    });
  });

  describe('getExpertAnalytics', () => {
    let req, res;
    beforeEach(() => {
      jest.clearAllMocks();
      req = httpMocks.createRequest();
      res = httpMocks.createResponse();
      req.user = { _id: 'user1' };
    });

    it('Should return 404 if expert not found', async () => {
      Expert.findOne.mockResolvedValue(null);
      const { getExpertAnalytics } = require('../../../controllers/expertDashboardController');
      await getExpertAnalytics(req, res);
      expect(res.statusCode).toBe(404);
    });

    it('Should fetch analytics', async () => {
      Expert.findOne.mockResolvedValue({ _id: 'expert1', hourlyRate: 1000 });
      Booking.find.mockResolvedValue([
        { status: 'Completed', bookingDate: '2023-12-01', slotTime: '10:00' }
      ]);
      Availability.find.mockResolvedValue([]);
      Review.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([])
      });
      const { getExpertAnalytics } = require('../../../controllers/expertDashboardController');
      await getExpertAnalytics(req, res);
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res._getData()).analytics.counts.completedCount).toBe(1);
    });
  });

  describe('uploadGalleryImage', () => {
    let req, res;
    beforeEach(() => {
      jest.clearAllMocks();
      req = httpMocks.createRequest();
      res = httpMocks.createResponse();
      req.user = { _id: 'user1' };
    });

    it('Should return 400 if no file', async () => {
      const { uploadGalleryImage } = require('../../../controllers/expertDashboardController');
      await uploadGalleryImage(req, res);
      expect(res.statusCode).toBe(400);
    });

    it('Should upload image', async () => {
      req.file = { filename: 'test.png' };
      const mockExpert = { _id: 'expert1', gallery: [], save: jest.fn() };
      Expert.findOne.mockResolvedValue(mockExpert);
      const { uploadGalleryImage } = require('../../../controllers/expertDashboardController');
      await uploadGalleryImage(req, res);
      expect(res.statusCode).toBe(200);
      expect(mockExpert.gallery).toContain('/uploads/test.png');
    });
  });

  describe('deleteGalleryImage', () => {
    let req, res;
    beforeEach(() => {
      jest.clearAllMocks();
      req = httpMocks.createRequest();
      res = httpMocks.createResponse();
      req.user = { _id: 'user1' };
    });

    it('Should return 404 if image not found in gallery', async () => {
      req.params = { filename: 'test.png' };
      Expert.findOne.mockResolvedValue({ _id: 'expert1', gallery: [] });
      const { deleteGalleryImage } = require('../../../controllers/expertDashboardController');
      await deleteGalleryImage(req, res);
      expect(res.statusCode).toBe(404);
    });

    it('Should delete image', async () => {
      req.params = { filename: 'test.png' };
      const mockExpert = { _id: 'expert1', gallery: ['/uploads/test.png'], save: jest.fn() };
      Expert.findOne.mockResolvedValue(mockExpert);
      const { deleteGalleryImage } = require('../../../controllers/expertDashboardController');
      await deleteGalleryImage(req, res);
      expect(res.statusCode).toBe(200);
      expect(mockExpert.gallery.length).toBe(0);
    });
  });
});
