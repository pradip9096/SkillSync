/**
 * @file videoRoomController.test.js
 * @description Unit tests for the WebRTC video token provisioning controller in `videoRoomController.js`.
 * Verifies time-lock enforcement (access blocked before 5 minutes prior to session start),
 * participant authorization (client and expert only), and token generation via the injected
 * videoRoomService dependency. The Booking model is fully mocked.
 */

const { getVideoToken } = require('../../../controllers/videoRoomController');
const Booking = require('../../../models/Booking');
const httpMocks = require('node-mocks-http');

jest.mock('../../../models/Booking');

const mockVideoRoomService = {
  generateNetworkToken: jest.fn()
};

describe('videoRoomController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getVideoToken', () => {
    const mockBookingId = '64f1b2c3e4d5a6b7c8d9e0f1';
    const mockUserId = 'user123';
    const mockExpertId = 'expert123';
    const otherUserId = 'other456';

    const getBaseReqRes = (userId) => {
      const req = httpMocks.createRequest({
        method: 'GET',
        url: `/api/v1/bookings/${mockBookingId}/video-token`,
        params: { id: mockBookingId },
        user: { _id: userId }
      });
      req.app = { locals: { videoRoomService: mockVideoRoomService } };
      const res = httpMocks.createResponse();
      const next = jest.fn();
      return { req, res, next };
    };

    it('should return 403 if user is not the client or expert (V&V 2: Authorization)', async () => {
      const { req, res, next } = getBaseReqRes(otherUserId);
      
      Booking.findById.mockResolvedValue({
        _id: mockBookingId,
        user: mockUserId,
        expert: mockExpertId,
        bookingDate: '2026-06-16',
        slotTime: '10:00'
      });

      await getVideoToken(req, res, next);
      expect(res.statusCode).toBe(403);
      expect(res._getJSONData().error).toBe('Not authorized to join this room');
    });

    it('should return 403 if requested at T-6 minutes (V&V 1: Time-Lock)', async () => {
      const { req, res, next } = getBaseReqRes(mockUserId);
      
      Booking.findById.mockResolvedValue({
        _id: mockBookingId,
        user: mockUserId,
        expert: mockExpertId,
        bookingDate: '2026-06-16',
        slotTime: '10:00'
      });

      const sessionStart = new Date('2026-06-16T10:00:00+05:30');
      // T-6 minutes
      const tMinus6 = new Date(sessionStart.getTime() - 6 * 60 * 1000);
      jest.setSystemTime(tMinus6);

      await getVideoToken(req, res, next);
      expect(res.statusCode).toBe(403);
      expect(res._getJSONData().error).toContain('Room is locked');
    });

    it('should return 200 and iceServers if requested at T-4 minutes (V&V 1 & 3)', async () => {
      const { req, res, next } = getBaseReqRes(mockUserId);
      
      Booking.findById.mockResolvedValue({
        _id: mockBookingId,
        user: mockUserId,
        expert: mockExpertId,
        bookingDate: '2026-06-16',
        slotTime: '10:00'
      });

      const sessionStart = new Date('2026-06-16T10:00:00+05:30');
      // T-4 minutes
      const tMinus4 = new Date(sessionStart.getTime() - 4 * 60 * 1000);
      jest.setSystemTime(tMinus4);

      mockVideoRoomService.generateNetworkToken.mockResolvedValue({
        iceServers: [
          { urls: 'stun:global.stun.twilio.com:3478' },
          { urls: 'turn:global.turn.twilio.com:3478', username: 'user', credential: 'pwd' }
        ]
      });

      await getVideoToken(req, res, next);
      
      expect(res.statusCode).toBe(200);
      const responseData = res._getJSONData();
      expect(responseData.success).toBe(true);
      expect(responseData.data.iceServers).toBeDefined();
      expect(responseData.data.iceServers[0].urls).toContain('stun:');
      expect(responseData.data.iceServers[1].urls).toContain('turn:');
    });
  });
});
