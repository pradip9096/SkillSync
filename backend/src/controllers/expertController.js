/**
 * Purpose: Handlers for expert-related API requests.
 * Inputs: Express request objects containing query parameters (for filtering and pagination), expert identifiers (ID), and rating values.
 * Outputs: Express response objects with JSON data representing a list of experts, detailed expert profiles, or updated rating status.
 * Side Effects: Reads expert data from the database and updates expert rating metrics (average rating and review count) in the Expert collection.
 */

const Expert = require('../models/Expert');
const Review = require('../models/Review');
const Booking = require('../models/Booking');

/**
 * Purpose: Get all experts with optional filtering by name/category and pagination.
 * @param {Object} req - Express request object containing query parameters for page, limit, search, and category.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a 200 response with the list of experts, total count, and pagination metadata, or a 500 response on failure.
 * Side effects: Reads from the Expert collection and counts documents matching the query.
 */
const getExperts = async (req, res) => {
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
    console.error('API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

/**
 * Purpose: Get detailed information for a single expert by their unique ID.
 * @param {Object} req - Express request object containing the expert ID in params.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a 200 response with the expert data, or a 404/500 response on failure.
 * Side effects: Reads a single document from the Expert collection.
 */
const getExpertById = async (req, res) => {
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
    console.error('API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

/**
 * Purpose: Submit a numerical rating for an expert and update their rolling average rating.
 * @param {Object} req - Express request object containing the numerical rating in the body and expert ID in params.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a 200 response with the updated expert data, or a 404/500 response on failure.
 * Side effects: Updates the rating and numReviews fields of an Expert document in the database.
 */
const rateExpert = async (req, res) => {
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

    // Create the Review document
    const newReview = await Review.create({
      expert: expertId,
      user: req.user._id,
      userName: req.user.name || 'Anonymous Client',
      rating,
      comment: comment || undefined,
      booking: bookingId
    });

    /**
     * Calculate new average rating:
     * Formula: New Average = ((Current Average * Current Count) + New Rating) / (Current Count + 1)
     */
    const currentTotal = expert.rating * expert.numReviews;
    expert.numReviews += 1;
    expert.rating = (currentTotal + rating) / expert.numReviews;

    // Save the updated expert document
    await expert.save();

    // Mark the booking as rated
    booking.isRated = true;
    await booking.save();

    res.status(200).json({
      success: true,
      data: expert,
      review: newReview
    });
  } catch (error) {
    console.error('API Error in rateExpert:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

module.exports = {
  getExperts,
  getExpertById,
  rateExpert
};
