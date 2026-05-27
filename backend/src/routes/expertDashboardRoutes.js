/**
 * @file expertDashboardRoutes.js
 * @description Defines the endpoints for the Expert Portal. All routes are protected and restricted to the Expert role.
 * 
 * Purpose: Routing map for expert panel dashboards.
 * Inputs: Express router.
 * Outputs: Mounted routes.
 * Side Effects: Connects API endpoints to expertDashboardController.
 */

const express = require('express');
const router = express.Router();
const {
  getExpertBookings,
  getExpertProfile,
  updateExpertProfile,
  blockSlot,
  unblockSlot,
  rateClient,
  getExpertAnalytics
} = require('../controllers/expertDashboardController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// Secure all endpoints in this router to Expert role only
router.use(protect);
router.use(restrictTo('Expert'));

// Sessions / bookings list
router.get('/bookings', getExpertBookings);
router.post('/bookings/:id/rate-client', rateClient);

// Business Analytics
router.get('/analytics', getExpertAnalytics);

// Professional profile configurations
router.get('/profile', getExpertProfile);
router.put('/profile', updateExpertProfile);

// Availability blocks
router.post('/block-slot', blockSlot);
router.post('/unblock-slot', unblockSlot);

// Media Gallery
const upload = require('../middleware/uploadMiddleware');
const { uploadGalleryImage, deleteGalleryImage } = require('../controllers/expertDashboardController');
router.post('/gallery', upload.single('galleryImage'), uploadGalleryImage);
router.delete('/gallery/:filename', deleteGalleryImage);

module.exports = router;
