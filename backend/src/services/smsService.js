const twilio = require('twilio');
const CircuitBreaker = require('opossum');
const logger = require('../config/logger');

/**
 * Purpose: General SMS dispatch service.
 * Inputs: { to, message }
 * Outputs: Promise resolving to the SMS delivery info or mock payload.
 * Side Effects: Dispatches an SMS using Twilio in production, or logs the payload to the console in development.
 */
// Circuit Breaker Options
const breakerOptions = {
  timeout: 5000,          // 5 seconds timeout
  errorThresholdPercentage: 50, // Open breaker if 50% of requests fail
  resetTimeout: 30000     // 30 seconds before attempting to close
};

const client = process.env.TWILIO_ACCOUNT_SID ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN) : null;

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
