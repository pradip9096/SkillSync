/**
 * @file ExpertRepository.js
 * @description Data-access layer for the `Expert` collection. Provides query methods with and
 * without `user` population to support both list views (no population needed) and detail/auth
 * flows (where the linked User ID must be resolved).
 *
 * Inputs and outputs:
 *   - Exports: a singleton `ExpertRepository` instance.
 *
 * Dependencies:
 *   - `../models/Expert` — Mongoose Expert model.
 */

const Expert = require('../models/Expert');

/**
 * Repository for read operations on the `experts` collection.
 * Exported as a module-level singleton — import directly, do not instantiate.
 */
class ExpertRepository {
  /**
   * Finds an expert by its `_id`.
   * This function is async. It awaits the Mongoose query.
   *
   * @async
   * @param {string|import('mongoose').Types.ObjectId} id - Expert document ID.
   * @returns {Promise<import('../models/Expert').ExpertDocument|null>}
   */
  async findById(id) {
    return Expert.findById(id);
  }

  /**
   * Finds an expert by `_id` and populates the linked `User` document.
   * This function is async. It awaits the Mongoose query with `populate`.
   *
   * @async
   * @param {string|import('mongoose').Types.ObjectId} id - Expert document ID.
   * @returns {Promise<import('../models/Expert').ExpertDocument|null>} Expert with `user` populated, or `null`.
   */
  async findByIdWithUser(id) {
    return Expert.findById(id).populate('user');
  }

  /**
   * Finds the first expert matching `query`.
   * This function is async. It awaits the Mongoose query.
   *
   * @async
   * @param {object} query - Mongoose filter object.
   * @returns {Promise<import('../models/Expert').ExpertDocument|null>}
   */
  async findOne(query) {
    return Expert.findOne(query);
  }

  /**
   * Finds the first expert matching `query` and populates the linked `User` document.
   * This function is async. It awaits the Mongoose query with `populate`.
   *
   * @async
   * @param {object} query - Mongoose filter object.
   * @returns {Promise<import('../models/Expert').ExpertDocument|null>} Expert with `user` populated, or `null`.
   */
  async findOneWithUser(query) {
    return Expert.findOne(query).populate('user');
  }
}

module.exports = new ExpertRepository();
