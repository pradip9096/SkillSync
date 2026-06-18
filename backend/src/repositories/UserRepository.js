/**
 * @file UserRepository.js
 * @description Data-access layer for the `User` collection. Currently used by
 * `ExpertService` to look up and persist user documents without importing the
 * model directly, keeping service unit tests mockable.
 *
 * Inputs and outputs:
 *   - Exports: a singleton `UserRepository` instance.
 *
 * Dependencies:
 *   - `../models/User` — Mongoose User model.
 */

const User = require('../models/User');

/**
 * Repository for read/write operations on the `users` collection.
 * Exported as a module-level singleton — import directly, do not instantiate.
 */
class UserRepository {
  /**
   * Finds a user by its `_id`.
   * This function is async. It awaits the Mongoose query.
   *
   * @async
   * @param {string|import('mongoose').Types.ObjectId} id - User document ID.
   * @returns {Promise<import('../models/User').UserDocument|null>}
   */
  async findById(id) {
    return User.findById(id);
  }

  /**
   * Saves a Mongoose `User` document instance. Accepts an optional session for
   * transactional saves (e.g. profile update transactions in `ExpertService`).
   * This function is async. It awaits `user.save`.
   *
   * @async
   * @param {import('../models/User').UserDocument} user - An existing Mongoose document instance.
   * @param {{ session?: import('mongoose').ClientSession }} [options={}]
   * @returns {Promise<import('../models/User').UserDocument>} The saved document.
   */
  async save(user, options = {}) {
    return user.save(options);
  }
}

module.exports = new UserRepository();
