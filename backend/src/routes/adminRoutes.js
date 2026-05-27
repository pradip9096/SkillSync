/**
 * @file adminRoutes.js
 * @description Defines the endpoints for system administrators, securing them with JWT and role checks.
 * 
 * Purpose: Routing mapping for Admin Panel dashboards.
 * Inputs: Express router.
 * Outputs: Mounted routes.
 * Side Effects: Connects API endpoints to adminController.
 */

const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  getAllBookings,
  updateBookingStatusByAdmin,
  deleteBookingByAdmin,
  createExpertByAdmin,
  deleteExpertByAdmin,
  resetUserPenalties
} = require('../controllers/adminController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// Secure all routes inside this file to Admin role only
router.use(protect);
router.use(restrictTo('Admin'));

// User accounts management
router.get('/users', getAllUsers);
router.post('/users/:id/reset-penalties', resetUserPenalties);

// Bookings management
router.get('/bookings', getAllBookings);
router.patch('/bookings/:id/status', updateBookingStatusByAdmin);
router.delete('/bookings/:id', deleteBookingByAdmin);

// Experts management
router.post('/experts', createExpertByAdmin);
router.delete('/experts/:id', deleteExpertByAdmin);

module.exports = router;
