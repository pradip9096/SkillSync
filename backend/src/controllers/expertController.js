/**
 * @file expertController.js
 * @description Express route handler functions for the public expert catalogue. Provides
 * paginated expert listing with search and category filters, single expert detail retrieval
 * with reviews, and post-session expert rating with rolling average update.
 *
 * Inputs and outputs:
 *   - All handlers receive `(req, res, next)` from Express and write a JSON response.
 *   - Exports: `{ getExperts, getExpertById, rateExpert }`.
 *
 * Side effects:
 *   - Reads `Expert`, `Review`, and `Booking` MongoDB collections.
 *   - `rateExpert` writes a new `Review` document and updates `Expert.rating` and
 *     `Expert.numReviews` atomically via `session.withTransaction`.
 *
 * Dependencies:
 *   - `mongoose` — MongoDB transaction sessions (required lazily inside `rateExpert`).
 *   - `../models/Expert` — Mongoose Expert model.
 *   - `../models/Review` — Mongoose Review model.
 *   - `../models/Booking` — Mongoose Booking model.
 */

const Expert = require('../models/Expert');
const Review = require('../models/Review');
const Booking = require('../models/Booking');

/**
 * Returns a paginated list of experts, optionally filtered by name search and/or category.
 * The `search` term is sanitized and applied as a case-insensitive regex on `Expert.name`.
 * This function is async. It awaits `Expert.find` and `Expert.countDocuments`.
 *
 * @async
 * @param {import('express').Request} req - Express request. Query params: `page` (default 1),
 *   `limit` (default 10, max 100), `search` (partial name match), `category`.
 * @param {import('express').Response} res - Express response. Returns 200
 *   `{ success, count, total, pages, data }`.
 * @param {import('express').NextFunction} next - Forwards unexpected errors to the global error handler.
 * @returns {Promise<void>}
 * @route GET /experts
 */
const getExperts = async (req, res, next) => {
  try {
    // Extract query parameters with default values for pagination
    const { page = 1, limit = 10, search, category } = req.query;

    const query = {};

    /**
     * Search by name:
     * If a search string is provided, we use a case-insensitive regular expression
     * to find experts whose names contain the string.
     */
    if (search) {
      const safeSearch = String(search).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.name = { $regex: safeSearch, $options: 'i' };
    }

    /**
     * Filter by category:
     * If a category is selected, filter the results to only include that category.
     */
    if (category) {
      query.category = category;
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(Math.max(1, parseInt(limit) || 10), 100);
    const skip = (pageNum - 1) * limitNum;
    
    // Execute query with limit, skip, and sort (newest first)
    const experts = await Expert.find(query)
      .limit(limitNum)
      .skip(skip)
      .sort({ createdAt: -1 });
 
    // Get total count of documents matching the query for pagination info
    const total = await Expert.countDocuments(query);
 
    res.status(200).json({
      success: true,
      count: experts.length,
      total,
      pages: Math.ceil(total / limitNum),
      data: experts
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Returns a single expert's full profile and all associated reviews.
 * This function is async. It awaits `Expert.findById` and `Review.find`.
 *
 * @async
 * @param {import('express').Request} req - Express request. `req.params.id` is the Expert document ID.
 * @param {import('express').Response} res - Express response. Returns 200 `{ success, data, reviews }`.
 * @param {import('express').NextFunction} next - Forwards unexpected errors to the global error handler.
 * @returns {Promise<void>}
 * @throws {404} If no expert exists with the given ID.
 * @route GET /experts/:id
 */
const getExpertById = async (req, res, next) => {
  try {
    const expert = await Expert.findById(req.params.id);

    // Handle case where ID doesn't match any document
    if (!expert) {
      return res.status(404).json({
        success: false,
        error: 'Expert not found'
      });
    }

    // Fetch all reviews for this expert (sorted by newest first)
    const reviews = await Review.find({ expert: req.params.id }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: expert,
      reviews
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Submits a rating and optional comment for a completed session. Atomically creates a
 * `Review` document, updates the expert's rolling average rating (`Expert.rating`,
 * `Expert.numReviews`), and marks the booking as rated — all inside a single MongoDB
 * transaction to prevent partial updates. Enforces: session must be Completed, the caller
 * must own the booking, and the booking must not already be rated.
 * This function is async. It awaits `Expert.findById`, `Booking.findById`,
 * `session.withTransaction`, `Review.create`, `expert.save`, and `booking.save`.
 *
 * @async
 * @param {import('express').Request} req - Express request. `req.params.id` is the Expert ID;
 *   body requires `rating` (number 1–5) and `bookingId`; optional `comment` (string).
 * @param {import('express').Response} res - Express response. Returns 200 `{ success, data, review }`.
 * @param {import('express').NextFunction} next - Forwards unexpected errors to the global error handler.
 * @returns {Promise<void>}
 * @throws {400} If `rating` or `bookingId` are missing, booking expert mismatch, session not completed,
 *   or session already rated.
 * @throws {401} If the authenticated user does not own the booking.
 * @throws {404} If the expert or booking is not found.
 * @route POST /experts/:id/rate
 */
const rateExpert = async (req, res, next) => {
  try {
    const { rating, comment, bookingId } = req.body;
    const expertId = req.params.id;

    // Validate inputs
    if (!rating || !bookingId) {
      return res.status(400).json({ success: false, error: 'Rating and Booking ID are required.' });
    }

    const expert = await Expert.findById(expertId);
    if (!expert) {
      return res.status(404).json({ success: false, error: 'Expert not found' });
    }

    // Verify the booking
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found.' });
    }

    // Ensure the booking matches the expert
    if (booking.expert.toString() !== expertId) {
      return res.status(400).json({ success: false, error: 'Booking expert does not match requested expert.' });
    }

    // Ensure the booking is completed
    if (booking.status !== 'Completed') {
      return res.status(400).json({ success: false, error: 'You can only rate completed sessions.' });
    }

    // Ensure the user owns this booking
    if (booking.user && booking.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ success: false, error: 'Not authorized to rate this session.' });
    }

    // Ensure the booking has not been rated yet
    if (booking.isRated) {
      return res.status(400).json({ success: false, error: 'This session has already been rated.' });
    }

    const mongoose = require('mongoose');
    const session = await mongoose.startSession();
    let newReview;

    try {
      await session.withTransaction(async () => {
        // Create the Review document
        const reviewDocs = await Review.create([{
          expert: expertId,
          user: req.user._id,
          userName: req.user.name || 'Anonymous Client',
          rating,
          comment: comment || undefined,
          booking: bookingId
        }], { session });
        
        newReview = reviewDocs[0];

        /**
         * Calculate new average rating:
         * Formula: New Average = ((Current Average * Current Count) + New Rating) / (Current Count + 1)
         */
        const currentTotal = expert.rating * expert.numReviews;
        expert.numReviews += 1;
        expert.rating = (currentTotal + rating) / expert.numReviews;

        // Save the updated expert document
        await expert.save({ session });

        // Mark the booking as rated
        booking.isRated = true;
        await booking.save({ session });
      });
    } finally {
      session.endSession();
    }

    res.status(200).json({
      success: true,
      data: expert,
      review: newReview
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getExperts,
  getExpertById,
  rateExpert
};
