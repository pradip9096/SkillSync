/**
 * @file BookingRepository.js
 * @description Data-access layer for the `Booking` collection. Wraps Mongoose operations
 * with optional query builders for pagination, population, and transaction session support.
 * Centralizing queries here allows service-layer unit tests to mock this module cleanly.
 *
 * Inputs and outputs:
 *   - Exports: a singleton `BookingRepository` instance.
 *
 * Dependencies:
 *   - `../models/Booking` — Mongoose Booking model.
 */

const Booking = require('../models/Booking');

/**
 * Repository for CRUD operations on the `bookings` collection.
 * Exported as a module-level singleton — import directly, do not instantiate.
 */
class BookingRepository {
  /**
   * Finds a single booking by its `_id`.
   * This function is async. It awaits the Mongoose query.
   *
   * @async
   * @param {string|import('mongoose').Types.ObjectId} id - Booking document ID.
   * @returns {Promise<import('../models/Booking').BookingDocument|null>}
   */
  async findById(id) {
    return Booking.findById(id);
  }

  /**
   * Finds a single booking by `_id` and populates the linked `expert` document.
   * This function is async. It awaits the Mongoose query with `populate`.
   *
   * @async
   * @param {string|import('mongoose').Types.ObjectId} id - Booking document ID.
   * @returns {Promise<import('../models/Booking').BookingDocument|null>} Booking with `expert` populated, or `null`.
   */
  async findByIdWithExpert(id) {
    return Booking.findById(id).populate('expert');
  }

  /**
   * Finds the first booking matching `query`. Supports a Mongoose `session` for use
   * inside multi-document transactions.
   * This function is async. It awaits the Mongoose query.
   *
   * @async
   * @param {object} query - Mongoose filter object.
   * @param {{ session?: import('mongoose').ClientSession }} [options={}]
   * @returns {Promise<import('../models/Booking').BookingDocument|null>}
   */
  async findOne(query, options = {}) {
    let q = Booking.findOne(query);
    if (options.session) {
      q = q.session(options.session);
    }
    return q;
  }

  /**
   * Returns bookings matching `query` with optional populate, sort, pagination, and lean mode.
   * This function is async. It awaits the Mongoose query chain.
   *
   * @async
   * @param {object} query - Mongoose filter object.
   * @param {{ populate?: string|object; sort?: object; skip?: number; limit?: number; lean?: boolean }} [options={}]
   * @returns {Promise<import('../models/Booking').BookingDocument[]>}
   */
  async find(query, options = {}) {
    let q = Booking.find(query);
    if (options.populate) {
      q = q.populate(options.populate);
    }
    if (options.sort) {
      q = q.sort(options.sort);
    }
    if (options.skip !== undefined) {
      q = q.skip(options.skip);
    }
    if (options.limit !== undefined) {
      q = q.limit(options.limit);
    }
    if (options.lean) {
      q = q.lean();
    }
    return q;
  }

  /**
   * Returns the number of booking documents matching `query`.
   * This function is async. It awaits `Booking.countDocuments`.
   *
   * @async
   * @param {object} query - Mongoose filter object.
   * @returns {Promise<number>}
   */
  async countDocuments(query) {
    return Booking.countDocuments(query);
  }

  /**
   * Creates a new booking document inside an optional session (for ACID transactions).
   * Uses the array-style `Booking.create([data], options)` form required by Mongoose
   * when passing a session.
   * This function is async. It awaits `Booking.create`.
   *
   * @async
   * @param {object} data - Booking fields to persist.
   * @param {{ session?: import('mongoose').ClientSession }} [options={}]
   * @returns {Promise<import('../models/Booking').BookingDocument>} The created booking document.
   */
  async create(data, options = {}) {
    const bookings = await Booking.create([data], options);
    return bookings[0];
  }
  
  /**
   * Constructs an unsaved Mongoose `Booking` document instance.
   * Useful when the caller needs to set fields or run validations before calling `save`.
   *
   * @param {object} data - Initial booking field values.
   * @returns {import('../models/Booking').BookingDocument} Unsaved Mongoose document instance.
   */
  createInstance(data) {
    return new Booking(data);
  }

  /**
   * Persists a Mongoose `Booking` document instance (calls `booking.save`).
   * Accepts an optional session for transactional saves.
   * This function is async. It awaits `booking.save`.
   *
   * @async
   * @param {import('../models/Booking').BookingDocument} booking - An existing Mongoose document instance.
   * @param {{ session?: import('mongoose').ClientSession }} [options={}]
   * @returns {Promise<import('../models/Booking').BookingDocument>} The saved document.
   */
  async save(booking, options = {}) {
    return booking.save(options);
  }
}

module.exports = new BookingRepository();
