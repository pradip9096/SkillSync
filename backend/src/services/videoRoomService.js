/**
 * @file videoRoomService.js
 * @description Service layer for WebRTC peer-to-peer video session support. Fetches
 * ephemeral ICE/STUN/TURN credentials from the Twilio Network Traversal Service so the
 * frontend WebRTC client can establish direct peer connections across NAT/firewalls.
 *
 * Inputs and outputs:
 *   - Exports: `{ generateNetworkToken }`.
 *
 * Side effects:
 *   - Makes an outbound HTTPS call to the Twilio NTS API.
 *
 * Dependencies:
 *   - `twilio` — Twilio REST client.
 */

const twilio = require('twilio');

/**
 * Fetches ephemeral Twilio Network Traversal Service (NTS) credentials with a 60-minute TTL.
 * Returns an `iceServers` array suitable for direct use in a browser `RTCPeerConnection` config.
 * This function is async. It awaits `client.tokens.create`.
 *
 * @async
 * @returns {Promise<{ iceServers: object[] }>} ICE server config object.
 * @throws {Error} If `TWILIO_ACCOUNT_SID` or `TWILIO_AUTH_TOKEN` are not set, or if the
 *   Twilio API call fails.
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
