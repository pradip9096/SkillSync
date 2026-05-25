/**
 * Purpose: Defines the API endpoints for expert-related operations, mapping HTTP methods and paths to controller functions.
 * Inputs: Express router and expert controller handlers.
 * Outputs: Configured Express router object.
 * Side Effects: Registers routes with the Express application.
 */

const express = require('express');
const router = express.Router();
const { getExperts, getExpertById, rateExpert } = require('../controllers/expertController');
const { protect } = require('../middleware/authMiddleware');

/**
 * Route: GET /
 * Purpose: Retrieve a list of experts with optional search and category filters.
 * Access: Public.
 */
router.get('/', getExperts);

/**
 * Route: GET /:id
 * Purpose: Retrieve detailed information for a single expert by ID.
 * Access: Public.
 */
router.get('/:id', getExpertById);

/**
 * Route: POST /:id/rate
 * Purpose: Submit a rating for an expert and update their overall rating.
 * Access: Public.
 */
router.post('/:id/rate', protect, rateExpert);

module.exports = router;
