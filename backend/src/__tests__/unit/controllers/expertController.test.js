const httpMocks = require('node-mocks-http');
const { rateExpert, getExperts, getExpertById } = require('../../../controllers/expertController');
const Expert = require('../../../models/Expert');
const Booking = require('../../../models/Booking');
const Review = require('../../../models/Review');

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
jest.mock('../../../models/Review');

describe('Feature 1.7: Reviews & P2P Feedback Unit Tests', () => {
  describe('rateExpert (Client -> Expert)', () => {
    let req, res;
    
    beforeEach(() => {
      jest.clearAllMocks();
      req = httpMocks.createRequest();
      res = httpMocks.createResponse();
      req.user = { _id: 'clientUser1', name: 'John Doe' };
      req.params = { id: 'expert1' };
    });

    it('TC-REV-01: EP (Invalid) - Should return 400 if rating or bookingId is missing', async () => {
      req.body = { rating: 5 }; // missing bookingId
      await rateExpert(req, res);
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res._getData()).error).toMatch(/Rating and Booking ID are required/i);
    });

    it('TC-REV-02: State (Not Found) - Should return 404 if booking not found', async () => {
      req.body = { rating: 5, bookingId: 'booking1' };
      Expert.findById.mockResolvedValue({ _id: 'expert1' });
      Booking.findById.mockResolvedValue(null);
      await rateExpert(req, res);
      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res._getData()).error).toMatch(/Booking not found/i);
    });

    it('TC-REV-03: State (RBAC) - Should return 400 if booking expert does not match requested expert', async () => {
      req.body = { rating: 5, bookingId: 'booking1' };
      Expert.findById.mockResolvedValue({ _id: 'expert1' });
      Booking.findById.mockResolvedValue({ _id: 'booking1', expert: 'differentExpert' });
      await rateExpert(req, res);
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res._getData()).error).toMatch(/Booking expert does not match/i);
    });

    it('TC-REV-04: State (Workflow) - Should return 400 if booking status is not Completed', async () => {
      req.body = { rating: 5, bookingId: 'booking1' };
      Expert.findById.mockResolvedValue({ _id: 'expert1' });
      Booking.findById.mockResolvedValue({ 
        _id: 'booking1', 
        expert: { toString: () => 'expert1' }, 
        status: 'Pending' 
      });
      await rateExpert(req, res);
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res._getData()).error).toMatch(/only rate completed sessions/i);
    });

    it('TC-REV-05: State (RBAC) - Should return 401 if logged-in user does not own the booking', async () => {
      req.body = { rating: 5, bookingId: 'booking1' };
      Expert.findById.mockResolvedValue({ _id: 'expert1' });
      Booking.findById.mockResolvedValue({ 
        _id: 'booking1', 
        expert: { toString: () => 'expert1' }, 
        status: 'Completed',
        user: { toString: () => 'differentUser' }
      });
      await rateExpert(req, res);
      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res._getData()).error).toMatch(/Not authorized to rate this session/i);
    });

    it('TC-REV-06: State (Idempotency) - Should return 400 if booking is already rated', async () => {
      req.body = { rating: 5, bookingId: 'booking1' };
      Expert.findById.mockResolvedValue({ _id: 'expert1' });
      Booking.findById.mockResolvedValue({ 
        _id: 'booking1', 
        expert: { toString: () => 'expert1' }, 
        status: 'Completed',
        user: { toString: () => 'clientUser1' },
        isRated: true
      });
      await rateExpert(req, res);
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res._getData()).error).toMatch(/already been rated/i);
    });

    it('TC-REV-07: Golden Path - Should mathematically update rating, save review, and mark booking', async () => {
      req.body = { rating: 4, bookingId: 'booking1', comment: 'Great!' };
      
      const mockExpert = { 
        _id: 'expert1', 
        rating: 4.5, 
        numReviews: 2, 
        save: jest.fn().mockResolvedValue(true) 
      };
      const mockBooking = { 
        _id: 'booking1', 
        expert: { toString: () => 'expert1' }, 
        status: 'Completed',
        user: { toString: () => 'clientUser1' },
        isRated: false,
        save: jest.fn().mockResolvedValue(true)
      };
      
      Expert.findById.mockResolvedValue(mockExpert);
      Booking.findById.mockResolvedValue(mockBooking);
      
      const mockReview = { _id: 'review1', rating: 4 };
      Review.create.mockResolvedValue(mockReview);
      
      const next = jest.fn();
      await rateExpert(req, res, next);
      expect(res.statusCode).toBe(200);
      
      expect(mockExpert.numReviews).toBe(3);
      expect(mockExpert.rating).toBeCloseTo(4.3333, 3);
      expect(mockExpert.save).toHaveBeenCalled();
      
      expect(mockBooking.isRated).toBe(true);
      expect(mockBooking.save).toHaveBeenCalled();
      
      expect(Review.create).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            expert: 'expert1',
            user: 'clientUser1',
            rating: 4,
            comment: 'Great!'
          })
        ]),
        expect.anything()
      );
    });
  });

  describe('getExperts', () => {
    let req, res;
    beforeEach(() => {
      jest.clearAllMocks();
      req = httpMocks.createRequest();
      res = httpMocks.createResponse();
    });

    it('Should fetch paginated experts', async () => {
      req.query = { page: 1, limit: 10, search: 'John', category: 'Tech' };
      Expert.find.mockReturnValue({
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([{ _id: 'expert1' }])
      });
      Expert.countDocuments.mockResolvedValue(1);

      await getExperts(req, res);
      
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res._getData()).data[0]._id).toBe('expert1');
    });
  });

  describe('getExpertById', () => {
    let req, res;
    beforeEach(() => {
      jest.clearAllMocks();
      req = httpMocks.createRequest();
      res = httpMocks.createResponse();
    });

    it('Should return 404 if expert not found', async () => {
      req.params = { id: 'expert1' };
      Expert.findById.mockResolvedValue(null);
      await getExpertById(req, res);
      expect(res.statusCode).toBe(404);
    });

    it('Should return expert and reviews', async () => {
      req.params = { id: 'expert1' };
      Expert.findById.mockResolvedValue({ _id: 'expert1' });
      Review.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([{ _id: 'review1' }])
      });
      await getExpertById(req, res);
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res._getData()).data._id).toBe('expert1');
    });
  });
});
