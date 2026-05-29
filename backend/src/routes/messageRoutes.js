const express = require('express');
const router = express.Router();
const { getMessagesByBooking, sendMessage, markMessagesAsRead, getUnreadCount, getUniqueConversations } = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');

// All message routes require authentication
router.use(protect);

router.get('/conversations', getUniqueConversations);
router.get('/booking/:bookingId', getMessagesByBooking);
router.get('/unread-count', getUnreadCount);
router.post('/', sendMessage);
router.patch('/booking/:bookingId/read', markMessagesAsRead);

module.exports = router;
