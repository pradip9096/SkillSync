/**
 * @file AvailabilityRepository.js
 * @description Data-access layer for the `Availability` collection (blocked/unavailable slots).
 * Centralizes all Mongoose queries so that service-layer code does not import the model directly,
 * making it easier to mock this module in unit tests.
 *
 * Inputs and outputs:
 *   - Exports: a singleton `AvailabilityRepository` instance.
 *
 * Dependencies:
 *   - `../models/Availability` — Mongoose Availability model.
 */

const Availability = require('../models/Availability');

/**
 * Repository for querying blocked / unavailable availability slots.
 * Exported as a module-level singleton — import directly, do not instantiate.
 */
class AvailabilityRepository {
  /**
   * Finds the first `Availability` document matching `query`.
   * Supports an optional Mongoose `session` for use inside transactions.
   * This function is async. It awaits the Mongoose query.
   *
   * @async
   * @param {object} query - Mongoose filter object.
   * @param {{ session?: import('mongoose').ClientSession }} [options={}] - Optional query options.
   * @returns {Promise<import('../models/Availability').AvailabilityDocument|null>} Matching document or `null`.
   */
  async findOne(query, options = {}) {
    let q = Availability.findOne(query);
    if (options.session) {
      q = q.session(options.session);
    }
    return q;
  }

  /**
   * Returns all `Availability` documents matching `query`.
   * This function is async. It awaits the Mongoose query.
   *
   * @async
   * @param {object} query - Mongoose filter object.
   * @returns {Promise<import('../models/Availability').AvailabilityDocument[]>} Array of matching documents.
   */
  async find(query) {
    return Availability.find(query);
  }
}

module.exports = new AvailabilityRepository();
