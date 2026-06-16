/**
 * Purpose: Service layer for WebRTC Video Room operations.
 * Inputs: Twilio credentials from environment variables.
 * Outputs: Network Traversal Service tokens (STUN/TURN).
 * Side Effects: Performs outbound API calls to Twilio.
 */

const twilio = require('twilio');

/**
 * Generates an ephemeral Network Traversal Service token (STUN/TURN) via Twilio.
 * @returns {Promise<Object>} An object containing the iceServers array.
 */
const generateNetworkToken = async () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error('TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN is missing from environment variables');
  }

  const client = twilio(accountSid, authToken);
  
  // Set TTL to 60 minutes (3600 seconds) as defined in the plan
  const token = await client.tokens.create({ ttl: 3600 });
  
  return {
    iceServers: token.iceServers
  };
};

module.exports = {
  generateNetworkToken
};
