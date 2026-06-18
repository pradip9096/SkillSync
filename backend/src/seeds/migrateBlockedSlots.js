/**
 * @file migrateBlockedSlots.js
 * @description One-time migration script. Ports expert calendar block placeholders that were
 * stored in the `Booking` collection (with `notes: 'Blocked by Expert'`) to the dedicated
 * `Availability` collection introduced in the v2 schema. Attempts an ACID transaction first;
 * falls back to sequential batch operations if running against a standalone (non-replica-set)
 * MongoDB instance.
 *
 * Inputs and outputs:
 *   - Run directly: `node src/seeds/migrateBlockedSlots.js`
 *   - Reads `process.env.MONGO_URI` for the connection string.
 *   - Exits with code 0 on success; code 1 on error.
 *
 * Side effects:
 *   - Connects to MongoDB.
 *   - Inserts documents into the `availabilities` collection.
 *   - Deletes migrated documents from the `bookings` collection.
 *
 * Dependencies:
 *   - `mongoose` — MongoDB connection and transactions.
 *   - `dotenv` — Loads `.env` from `backend/.env`.
 *   - `../models/Booking` — Source collection.
 *   - `../models/Availability` — Destination collection.
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Booking = require('../models/Booking');
const Availability = require('../models/Availability');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

/**
 * Connects to MongoDB and migrates all legacy `Booking` documents with
 * `notes: 'Blocked by Expert'` to the `Availability` collection.
 * Uses a replica-set transaction when available; falls back to sequential upserts.
 * This function is async. It awaits `mongoose.connect`, `Booking.find`,
 * `session.withTransaction`, and multiple `Availability.create` / `Booking.deleteOne` calls.
 *
 * @async
 * @returns {Promise<void>} Calls `process.exit(0)` on success; `process.exit(1)` on error.
 */
const runMigration = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/skillsync';
    console.log(`Connecting to database: ${mongoUri}...`);
    await mongoose.connect(mongoUri);
    console.log('Database connected successfully.');

    // Find all legacy blocked slots
    const legacyBlocks = await Booking.find({ notes: 'Blocked by Expert' });
    console.log(`Found ${legacyBlocks.length} legacy blocked slot placeholders in Booking collection.`);

    if (legacyBlocks.length === 0) {
      console.log('No legacy blocked slot placeholders found. Migration is not required.');
      process.exit(0);
    }

    // Try executing inside a MongoDB replica set transaction first
    let transactionCompleted = false;
    try {
      const session = await mongoose.startSession();
      await session.withTransaction(async () => {
        for (const block of legacyBlocks) {
          // Port to Availability collection
          await Availability.create([{
            expert: block.expert,
            bookingDate: block.bookingDate,
            slotTime: block.slotTime,
            notes: 'Blocked by Expert'
          }], { session });

          // Delete from Booking collection
          await Booking.deleteOne({ _id: block._id }, { session });
        }
      });
      session.endSession();
      transactionCompleted = true;
      console.log('Transaction committed: Ported legacy slot blocks to Availability collection atomically.');
    } catch (txError) {
      console.warn('MongoDB transaction failed or unsupported (e.g., standalone local DB). Falling back to standard operations...');
      console.warn(`Reason: ${txError.message}`);

      // Fallback: Perform batch operations sequentially
      for (const block of legacyBlocks) {
        // Create availability record
        await Availability.findOneAndUpdate(
          { expert: block.expert, bookingDate: block.bookingDate, slotTime: block.slotTime },
          { expert: block.expert, bookingDate: block.bookingDate, slotTime: block.slotTime, notes: 'Blocked by Expert' },
          { upsert: true, new: true }
        );

        // Delete booking record
        await Booking.deleteOne({ _id: block._id });
      }
      transactionCompleted = true;
      console.log('Standard batch execution: Ported legacy slot blocks to Availability collection successfully.');
    }

    if (transactionCompleted) {
      console.log('Migration completed successfully!');
      process.exit(0);
    } else {
      throw new Error('Migration did not complete.');
    }
  } catch (error) {
    console.error(`Migration script failed: ${error.message}`);
    process.exit(1);
  }
};

runMigration();
