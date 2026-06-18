/**
 * @file notificationRoutes.js
 * @description Express router for the in-app notification API. All routes require JWT
 * authentication via `protect`.
 *
 * Inputs and outputs:
 *   - Exports: an Express `Router` instance mounted at `/notifications` (and `/api/v1/notifications`).
 *
 * Dependencies:
 *   - `../controllers/notificationController` — Handler functions.
 *   - `../middleware/authMiddleware` — JWT authentication.
 *   - `../middleware/validationMiddleware` — ObjectId parameter validation.
 */

const express = require('express');
const router = express.Router();
const { getNotifications, markAsRead, markAllAsRead, getUnreadCount } = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');
const { validateParams } = require('../middleware/validationMiddleware');

// All notification routes require authentication
router.use(protect);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', validateParams(['id']), markAsRead);

module.exports = router;
