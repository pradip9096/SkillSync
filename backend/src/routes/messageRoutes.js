const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { getMessagesByBooking, sendMessage, markMessagesAsRead, getUnreadCount, getUniqueConversations } = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');
const { validateParams } = require('../middleware/validationMiddleware');

const messageRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // Limit each IP to 60 requests per window
  message: { message: 'Too many messages sent, please try again later.' }
});

// All message routes require authentication
router.use(protect);

router.get('/conversations', getUniqueConversations);
router.get('/booking/:bookingId', validateParams(['bookingId']), getMessagesByBooking);
router.get('/unread-count', getUnreadCount);
router.post('/', messageRateLimiter, sendMessage);
router.patch('/booking/:bookingId/read', validateParams(['bookingId']), markMessagesAsRead);

module.exports = router;
