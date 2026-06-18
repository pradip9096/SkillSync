/**
 * @file expertRoutes.js
 * @description Express router for public expert discovery and rating endpoints.
 * `GET /` and `GET /:id` are fully public. `POST /:id/rate` requires authentication
 * to associate the review with a verified user account.
 *
 * Inputs and outputs:
 *   - Exports: an Express `Router` instance mounted at `/api/experts` in `app.js`.
 */

const express = require('express');
const router = express.Router();
const { getExperts, getExpertById, rateExpert } = require('../controllers/expertController');
const { protect } = require('../middleware/authMiddleware');
const { validateParams } = require('../middleware/validationMiddleware');

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
router.get('/:id', validateParams(['id']), getExpertById);

/**
 * Route: POST /:id/rate
 * Purpose: Submit a rating for an expert and update their overall rating.
 * Access: Public.
 */
router.post('/:id/rate', protect, validateParams(['id']), rateExpert);

module.exports = router;
