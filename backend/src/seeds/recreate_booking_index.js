/**
 * @file recreate_booking_index.js
 * @description Standalone script to drop the legacy compound unique index on Bookings and rebuild it.
 * It also migrates existing data by setting the 'active' field appropriately.
 */

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Booking = require('../models/Booking');

const rebuildIndex = async () => {
  try {
    // 1. Connect to database
    await connectDB();
    console.log('Database connected successfully.');

    // 2. Migrate existing documents to populate the 'active' field
    console.log('Migrating existing bookings to set the active field...');
    const inactiveResult = await Booking.updateMany(
      { status: { $in: ['Cancelled', 'Late Cancellation'] } },
      { $set: { active: false } }
    );
    console.log(`Updated ${inactiveResult.modifiedCount} inactive bookings (active = false).`);

    const activeResult = await Booking.updateMany(
      { status: { $nin: ['Cancelled', 'Late Cancellation'] } },
      { $set: { active: true } }
    );
    console.log(`Updated ${activeResult.modifiedCount} active bookings (active = true).`);

    // 3. Drop the old index
    const indexName = 'expert_1_bookingDate_1_slotTime_1';
    console.log(`Checking indexes on 'bookings' collection...`);
    const indexes = await Booking.collection.indexes();
    const indexExists = indexes.some(idx => idx.name === indexName);

    if (indexExists) {
      console.log(`Found legacy index '${indexName}'. Dropping...`);
      await Booking.collection.dropIndex(indexName);
      console.log(`Legacy index '${indexName}' dropped successfully.`);
    } else {
      console.log(`Legacy index '${indexName}' not found. Skipping drop.`);
    }

    // 4. Rebuild indexes defined in model schema
    console.log('Rebuilding model indexes...');
    await Booking.cleanIndexes(); // Clean any other conflicting index specifications
    await Booking.createIndexes();
    console.log('All indexes rebuilt successfully.');

    console.log('Index recreation complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error recreating booking indexes:', error);
    process.exit(1);
  }
};

rebuildIndex();
