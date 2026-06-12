const httpMocks = require('node-mocks-http');
const { 
  getNotifications, 
  markAsRead, 
  markAllAsRead, 
  getUnreadCount 
} = require('../../../src/controllers/notificationController');
const Notification = require('../../../src/models/Notification');

jest.mock('../../../src/models/Notification');

describe('Feature 1.9: Notification Controller Unit Tests', () => {
  let req, res;
  const userId = 'user123';

  beforeEach(() => {
    jest.clearAllMocks();
    req = httpMocks.createRequest();
    res = httpMocks.createResponse();
    req.user = { _id: userId };
  });

  describe('getNotifications', () => {
    it('TC-NOTIF-01: Golden Path - Fetch paginated inbox', async () => {
      Notification.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([{ _id: 'notif1' }])
      });
      await getNotifications(req, res);
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res._getData())[0]._id).toBe('notif1');
    });
  });

  describe('markAsRead', () => {
    it('TC-NOTIF-02: Golden Path - Provide specific notification id', async () => {
      req.params = { id: 'notif1' };
      Notification.findOneAndUpdate.mockResolvedValue({ _id: 'notif1', read: true });
      await markAsRead(req, res);
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res._getData()).read).toBe(true);
      expect(Notification.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'notif1', user: userId },
        { $set: { read: true } },
        { new: true }
      );
    });

    it('Should return 404 if notification not found', async () => {
      req.params = { id: 'notif1' };
      Notification.findOneAndUpdate.mockResolvedValue(null);
      await markAsRead(req, res);
      expect(res.statusCode).toBe(404);
    });
  });

  describe('markAllAsRead', () => {
    it('TC-NOTIF-03: Golden Path - Bulk clear inbox', async () => {
      Notification.updateMany.mockResolvedValue(true);
      await markAllAsRead(req, res);
      expect(res.statusCode).toBe(200);
      expect(Notification.updateMany).toHaveBeenCalledWith(
        { user: userId, read: false },
        { $set: { read: true } }
      );
    });
  });

  describe('getUnreadCount', () => {
    it('TC-NOTIF-04: Golden Path - UI badge polling', async () => {
      Notification.countDocuments.mockResolvedValue(3);
      await getUnreadCount(req, res);
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res._getData()).count).toBe(3);
    });
  });
});
