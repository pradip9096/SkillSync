/**
 * Purpose: Database configuration file to establish a connection with MongoDB using Mongoose.
 * Inputs: process.env.MONGO_URI (environment variable).
 * Outputs: None (exports the connectDB function).
 * Side Effects: Establishes a network connection to MongoDB, logs connection status to the console, and may terminate the process on connection failure.
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

/**
 * Purpose: Asynchronously connects to MongoDB using the URI provided in environment variables.
 * @async
 * @returns {Promise<void>} Resolves when the connection is successfully established.
 * Side effects: Establishes a database connection, logs the host name to the console, and exits the process with a failure code (1) if the connection fails.
 */
const connectDB = async () => {
  try {
    // Attempt to connect to MongoDB with the URI from .env
    const conn = await mongoose.connect(process.env.MONGO_URI);
    
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
