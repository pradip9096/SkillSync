/**
 * @file config.js
 * @description Application configuration guard. Validates that all required environment
 * variables are present at startup and terminates the process with exit code 1 if any
 * are missing, preventing the server from running in a misconfigured state.
 *
 * Inputs and outputs:
 *   - Exports: `{ checkEnvVariables }` — call once during server bootstrap.
 *
 * Side effects:
 *   - Calls `process.exit(1)` if required variables are absent (skipped in `test` env).
 *   - Loads `.env` via `dotenv.config()`.
 *   - Writes an error log via the shared Pino logger.
 *
 * Dependencies:
 *   - `dotenv` — Loads `.env` into `process.env`.
 *   - `./logger` — Shared Pino logger for the startup error message.
 */

const logger = require('./logger');
const dotenv = require('dotenv');

// Load environment variables early
dotenv.config();

/**
 * Validates that all critical environment variables are present.
 * Exits the process immediately if any required variable is missing (fail-fast guard).
 * No-ops when `NODE_ENV` is `test` to allow Jest runs without a full `.env` file.
 *
 * @returns {void}
 * @throws {never} Does not throw — calls `process.exit(1)` directly on failure.
 */
const checkEnvVariables = () => {
  if (process.env.NODE_ENV === 'test') return;

  const requiredEnvVars = [
    'PORT',
    'MONGO_URI',
    'JWT_SECRET',
    'RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET',
    'FRONTEND_URL'
  ];

  const missing = requiredEnvVars.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    logger.error(`CRITICAL ERROR: Missing required environment variables: ${missing.join(', ')}. Server starting in degraded state aborted.`);
    process.exit(1);
  }
};

module.exports = { checkEnvVariables };
