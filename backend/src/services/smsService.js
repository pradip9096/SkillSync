const twilio = require('twilio');

/**
 * Purpose: General SMS dispatch service.
 * Inputs: { to, message }
 * Outputs: Promise resolving to the SMS delivery info or mock payload.
 * Side Effects: Dispatches an SMS using Twilio in production, or logs the payload to the console in development.
 */
const sendSMS = async ({ to, message }) => {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_PHONE;

  // Check if Twilio is properly configured in the environment
  if (sid && token && from) {
    try {
      const client = twilio(sid, token);
      const res = await client.messages.create({
        body: message,
        from: from,
        to: to
      });
      console.log(`[SMS Service] SMS sent successfully to ${to}. MessageSid: ${res.sid}`);
      return res;
    } catch (err) {
      console.error(`[SMS Service] Twilio delivery failed to ${to}:`, err.message);
      throw err;
    }
  }

  // Development Fallback: Log SMS body to terminal console
  console.log('================= DEVELOPMENT SMS LOG ==================');
  console.log(`To:      ${to}`);
  console.log(`Message: ${message}`);
  console.log('========================================================');
  return { sid: `mock-sms-id-${Date.now()}` };
};

module.exports = { sendSMS };
