/**
 * @file smsService.js
 * @description Transactional SMS dispatch service backed by Twilio. Wraps the Twilio
 * `messages.create` call in an Opossum circuit breaker to prevent cascading failures
 * when Twilio is unavailable. Falls back to console logging when Twilio credentials
 * are not configured (development mode).
 *
 * Inputs and outputs:
 *   - Exports: `{ sendSMS }`.
 *
 * Side effects:
 *   - Dispatches an SMS to `to` via Twilio when credentials are configured.
 *   - Circuit breaker opens after 50% error rate; resets after 30 s.
 *   - Returns a mock SID (not an error) when the breaker is open, so calling
 *     code does not crash when Twilio is temporarily unavailable.
 *
 * Dependencies:
 *   - `twilio` — Twilio REST client.
 *   - `opossum` — Circuit breaker library.
 *   - `../config/logger` — Shared Pino logger.
 */

const twilio = require('twilio');
const CircuitBreaker = require('opossum');
const logger = require('../config/logger');

/** @type {import('opossum').Options} Circuit breaker thresholds for the Twilio API call. */
const breakerOptions = {
  timeout: 5000,               // Abort a call after 5 seconds
  errorThresholdPercentage: 50, // Open the breaker when ≥50% of requests fail
  resetTimeout: 30000          // Attempt to close the breaker after 30 seconds
};

const client = process.env.TWILIO_ACCOUNT_SID ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN) : null;

/**
 * Sends a single SMS via the initialized Twilio client. Wrapped by the circuit breaker.
 * Throws if the Twilio client was not initialized (credentials missing).
 *
 * @async
 * @param {{ body: string, from: string, to: string }} params - Twilio `messages.create` params.
 * @returns {Promise<{ sid: string }>} Twilio message response with SID.
 * @throws {Error} If `TWILIO_ACCOUNT_SID` is not set (client not initialized).
 */
const executeTwilio = async (params) => {
  if (!client) throw new Error('Twilio Client not initialized');
  return await client.messages.create(params);
};

const smsBreaker = new CircuitBreaker(executeTwilio, breakerOptions);

smsBreaker.fallback((params, err) => {
  logger.warn({ err, params }, '[SMS Service] Circuit breaker open or failed. Fallback executed.');
  // Return a mock SID to allow system to proceed without SMS
  return { sid: `mock-sms-fallback-${Date.now()}` };
});

/**
 * Dispatches an SMS via the circuit-breaker-wrapped Twilio client. When Twilio
 * credentials are absent, logs the payload to the console and returns a mock SID.
 * This function is async. It awaits `smsBreaker.fire` (or returns immediately in dev mode).
 *
 * @async
 * @param {{ to: string, message: string }} args
 *   - `to`: Destination phone number in E.164 format (e.g. `+919876543210`).
 *   - `message`: SMS body text.
 * @returns {Promise<{ sid: string }>} Twilio message SID, or a `mock-sms-id-*` string in dev.
 * @throws {Error} If Twilio delivery fails and the circuit breaker does not absorb it.
 */
const sendSMS = async ({ to, message }) => {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_PHONE;

  // Check if Twilio is properly configured in the environment
  if (sid && token && from) {
    try {
      const res = await smsBreaker.fire({
        body: message,
        from: from,
        to: to
      });
      logger.info(`[SMS Service] SMS dispatched. Result: ${res.sid}`);
      return res;
    } catch (err) {
      logger.error({ err, to }, '[SMS Service] Twilio delivery failed');
      throw err;
    }
  }

  // Development Fallback: Log SMS body to terminal console
  logger.info('================= DEVELOPMENT SMS LOG ==================');
  logger.info(`To:      ${to}`);
  logger.info(`Message: ${message}`);
  logger.info('========================================================');
  return { sid: `mock-sms-id-${Date.now()}` };
};

module.exports = { sendSMS };
