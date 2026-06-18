/**
 * @file db.js
 * @description MongoDB connection factory. Exports `connectDB`, which is called once
 * during server startup to establish the Mongoose connection before any route handlers run.
 *
 * Inputs and outputs:
 *   - Reads `process.env.MONGO_URI` for the Atlas connection string.
 *   - Exports: `connectDB` — async function, resolves `void` on success.
 *
 * Side effects:
 *   - Establishes a persistent TCP connection to MongoDB Atlas.
 *   - Writes the connected host name to stdout.
 *   - Calls `process.exit(1)` if the connection attempt fails.
 *
 * Dependencies:
 *   - `mongoose` — ODM / MongoDB connection driver.
 *   - `dotenv` — Ensures `MONGO_URI` is available when the module is loaded standalone.
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

/**
 * Connects to MongoDB using the URI from `process.env.MONGO_URI`.
 * This function is async. It awaits `mongoose.connect` with a 30-second server
 * selection timeout and a 45-second socket timeout.
 *
 * @async
 * @function connectDB
 * @returns {Promise<void>} Resolves when the Mongoose connection is ready.
 * @throws {never} Does not throw — calls `process.exit(1)` on connection failure.
 */
const connectDB = async () => {
  try {
    // Attempt to connect to MongoDB with the URI from .env
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });
    
    // Log the host name of the connected database for confirmation
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    // Log the error and exit the process if the connection fails
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

// Export the connection function to be used in app.js
module.exports = connectDB;
