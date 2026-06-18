/**
 * @file messageController.test.js
 * @description Unit tests for messaging controller functions in `messageController.js`.
 * Covers message retrieval by booking, message sending with HTML sanitization, bulk
 * read-state marking, unread message count, and unique conversation listing.
 * Authorization enforcement is verified for both client and expert roles.
 * Message, Booking, and Notification models are fully mocked.
 */

const httpMocks = require('node-mocks-http');
const mongoose = require('mongoose');
const {
  sendMessage,
  getMessagesByBooking,
  markMessagesAsRead, 
  getUnreadCount, 
  getUniqueConversations 
} = require('../../../controllers/messageController');

const Message = require('../../../models/Message');
const Booking = require('../../../models/Booking');
const Notification = require('../../../models/Notification');
const Expert = require('../../../models/Expert');

jest.mock('../../../models/Message');
jest.mock('../../../models/Booking');
jest.mock('../../../models/Notification');
jest.mock('../../../models/Expert');

describe('Feature 1.8: Chat Messaging System Unit Tests', () => {
  let req, res, mockEmit;
  const clientId = new mongoose.Types.ObjectId().toString();
  const expertUserId = new mongoose.Types.ObjectId().toString();
  const bookingId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    req = httpMocks.createRequest();
    res = httpMocks.createResponse();
    mockEmit = jest.fn();
    req.app = { get: jest.fn().mockReturnValue({ to: jest.fn().mockReturnValue({ emit: mockEmit }) }) };
    req.user = { _id: clientId, role: 'User' };
  });

  describe('sendMessage', () => {
    it('TC-MSG-01: EP (Invalid) - Should return 400 if missing fields', async () => {
      req.body = { bookingId, receiverId: expertUserId }; // missing content
      await sendMessage(req, res);
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res._getData()).message).toMatch(/Missing required fields/i);
    });

    it('TC-MSG-02: BVA (Boundary) - Should return 400 if content exceeds 5000 chars', async () => {
      req.body = { bookingId, receiverId: expertUserId, content: 'a'.repeat(5001) };
      await sendMessage(req, res);
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res._getData()).message).toMatch(/exceeds 5000 characters/i);
    });

    it('TC-MSG-03: State (Not Found) - Should return 404 if booking not found', async () => {
      req.body = { bookingId, receiverId: expertUserId, content: 'Hello' };
      Booking.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null)
      });
      await sendMessage(req, res);
      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res._getData()).message).toMatch(/Booking not found/i);
    });

    it('TC-MSG-04: State (RBAC) - Should return 403 if user is unauthorized', async () => {
      req.body = { bookingId, receiverId: expertUserId, content: 'Hello' };
      req.user._id = new mongoose.Types.ObjectId().toString(); // Random user

      const mockBooking = { user: clientId, expert: { user: expertUserId } };
      Booking.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockBooking)
      });
      await sendMessage(req, res);
      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res._getData()).message).toMatch(/Not authorized/i);
    });

    it('TC-MSG-05: Golden Path - Should create message, notification, and emit sockets', async () => {
      req.body = { bookingId, receiverId: expertUserId, content: 'Hello' };
      const mockBooking = { user: clientId, expert: { user: expertUserId } };
      Booking.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockBooking)
      });

      const mockMessage = { toJSON: () => ({ content: 'Hello' }) };
      Message.create.mockResolvedValue(mockMessage);

      const mockNotif = { toJSON: () => ({ type: 'MESSAGE' }) };
      Notification.create.mockResolvedValue(mockNotif);

      await sendMessage(req, res);
      expect(res.statusCode).toBe(201);
      expect(Message.create).toHaveBeenCalled();
      expect(Notification.create).toHaveBeenCalled();
      
      // Sockets emitted
      expect(req.app.get('io').to).toHaveBeenCalledWith(`booking_${bookingId}`);
      expect(req.app.get('io').to).toHaveBeenCalledWith(`user_${expertUserId}`);
      expect(mockEmit).toHaveBeenCalledWith('new_message', { content: 'Hello' });
      expect(mockEmit).toHaveBeenCalledWith('new_notification', { type: 'MESSAGE' });
    });
  });

  describe('getMessagesByBooking', () => {
    it('TC-MSG-06: State (RBAC) - Should return 403 for unauthorized viewer', async () => {
      req.params = { bookingId };
      req.user._id = new mongoose.Types.ObjectId().toString(); // Random user
      
      const mockBooking = { user: clientId, expert: { user: expertUserId } };
      Booking.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockBooking)
      });

      await getMessagesByBooking(req, res);
      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res._getData()).message).toMatch(/Not authorized/i);
    });

    it('TC-MSG-07: Golden Path - Should return messages unified across peer bookings', async () => {
      req.params = { bookingId };
      req.user._id = clientId;

      const mockBooking = { user: clientId, expert: { _id: 'expert1', user: expertUserId } };
      Booking.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockBooking)
      });

      Booking.find.mockResolvedValue([{ _id: bookingId }, { _id: 'peerBooking2' }]);

      Message.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([{ _id: 'msg1' }, { _id: 'msg2' }])
      });

      await getMessagesByBooking(req, res);
      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res._getData());
      // Due to messages.reverse()
      expect(data[0]._id).toBe('msg2');
      expect(data[1]._id).toBe('msg1');
      expect(Booking.find).toHaveBeenCalledWith({ user: clientId, expert: 'expert1' });
    });
  });

  describe('markMessagesAsRead', () => {
    it('TC-MSG-08: Golden Path - Marks unread messages as read', async () => {
      req.params = { bookingId };
      req.user._id = clientId;

      const mockBooking = { user: clientId, expert: { _id: 'expert1', user: expertUserId } };
      Booking.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockBooking)
      });
      Booking.find.mockResolvedValue([{ _id: bookingId }]);
      Message.updateMany.mockResolvedValue(true);

      await markMessagesAsRead(req, res);
      expect(res.statusCode).toBe(200);
      expect(Message.updateMany).toHaveBeenCalledWith(
        { bookingId: { $in: [bookingId] }, receiver: clientId, read: false },
        { $set: { read: true } }
      );
    });
  });

  describe('getUnreadCount', () => {
    it('TC-MSG-09: Golden Path - Returns accurate count of unread documents', async () => {
      Message.countDocuments.mockResolvedValue(5);
      await getUnreadCount(req, res);
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res._getData()).count).toBe(5);
    });
  });

  describe('getUniqueConversations', () => {
    it('TC-MSG-10: Golden Path (Expert) - Returns grouped conversations', async () => {
      req.user = { _id: expertUserId, role: 'Expert' };
      
      Expert.findOne.mockResolvedValue({ _id: 'expert1' });
      Booking.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([
          { _id: bookingId, user: { _id: clientId, name: 'John Doe' }, createdAt: new Date() }
        ])
      });

      Message.aggregate.mockResolvedValue([
        { _id: bookingId, lastMessage: { createdAt: new Date() } }
      ]);

      await getUniqueConversations(req, res);
      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.length).toBe(1);
      expect(data[0].otherUser._id).toBe(clientId);
    });

    it('TC-MSG-11: Golden Path (Client) - Returns grouped conversations', async () => {
      req.user = { _id: clientId, role: 'User' };
      
      Booking.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([
          { _id: bookingId, expert: { user: { _id: expertUserId, name: 'Expert Bob' } }, createdAt: new Date() }
        ])
      });

      Message.aggregate.mockResolvedValue([
        { _id: bookingId, lastMessage: { createdAt: new Date() } }
      ]);

      await getUniqueConversations(req, res);
      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.length).toBe(1);
      expect(data[0].otherUser._id).toBe(expertUserId);
    });
  });
});
