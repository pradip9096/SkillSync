/**
 * @file webhookMiddleware.js
 * @description Express middleware that authenticates inbound Razorpay webhook requests
 * using HMAC-SHA256 signature verification. Must be applied before any webhook route handler
 * to ensure that only genuine Razorpay events are processed.
 *
 * Inputs and outputs:
 *   - Exports: `{ verifyWebhookSignature }`.
 *
 * Side effects:
 *   - Reads `process.env.RAZORPAY_WEBHOOK_SECRET` for the shared secret.
 *   - Reads `req.rawBody` (set by Express's JSON `verify` callback in `app.js`) or falls
 *     back to `JSON.stringify(req.body)` for the HMAC computation.
 *
 * Dependencies:
 *   - `crypto` — HMAC-SHA256 digest and timing-safe buffer comparison.
 */

const crypto = require('crypto');

/**
 * Verifies the `x-razorpay-signature` header against an HMAC-SHA256 digest of the raw
 * request body using the `RAZORPAY_WEBHOOK_SECRET`. Uses `crypto.timingSafeEqual` for
 * the final comparison to prevent timing-oracle attacks that could allow an attacker to
 * enumerate the secret byte-by-byte by measuring response latency. A length guard runs
 * before `timingSafeEqual` because that function throws on mismatched buffer lengths.
 *
 * @param {import('express').Request} req - Express request. `req.rawBody` must contain the
 *   original payload bytes (set by the JSON body-parser's `verify` callback in `app.js`).
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Called with no arguments if the signature is valid.
 * @returns {void}
 * @throws {500} (response, not thrown) If `RAZORPAY_WEBHOOK_SECRET` is not configured — fails
 *   closed to prevent processing unsigned events.
 * @throws {400} (response, not thrown) If the signature header is absent, or the HMAC does not match.
 */
const verifyWebhookSignature = (req, res, next) => {
  const signature = req.headers['x-razorpay-signature'];
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('[Security Warning] Webhook secret is not defined in environment variables. Webhook rejected.');
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }

  if (!signature) {
    return res.status(400).json({ success: false, error: 'Missing webhook signature header' });
  }

  // Compute the expected HMAC signature of the raw body payload
  // Express must be configured to parse raw request body for this validation
  const bodyToVerify = req.rawBody || JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(bodyToVerify)
    .digest('hex');

  const sigBuffer = Buffer.from(signature, 'utf-8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf-8');

  // Prevent timingSafeEqual from throwing errors if byte length differs
  if (sigBuffer.length !== expectedBuffer.length) {
    console.warn('[Security Warning] Received webhook signature length mismatch.');
    return res.status(400).json({ success: false, error: 'Invalid webhook signature' });
  }

  try {
    // Prevent timing attacks using time-constant comparison
    const isMatch = crypto.timingSafeEqual(sigBuffer, expectedBuffer);

    if (!isMatch) {
      console.warn('[Security Warning] Received invalid webhook signature payload.');
      return res.status(400).json({ success: false, error: 'Invalid webhook signature' });
    }
  } catch (err) {
    console.error('[Security Error] Exception during signature verification:', err.message);
    return res.status(400).json({ success: false, error: 'Invalid webhook signature' });
  }

  next();
};

module.exports = { verifyWebhookSignature };
