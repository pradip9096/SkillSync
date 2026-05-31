/**
 * Purpose: Middleware to verify incoming Razorpay webhook signatures using SHA-256 HMAC timing-safe validation.
 * Inputs: Express request and response objects, and next middleware callback.
 * Outputs: Calls next() on success, returns 400/500 JSON response on failure.
 * Side Effects: Verifies headers using crypto library.
 */

const crypto = require('crypto');

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
