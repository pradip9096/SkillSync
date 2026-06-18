/**
 * @file e2e-server.js
 * @description Lightweight test-mode entry point for Playwright E2E tests. Imports the
 * production Express app and injects two DI stubs into `app.locals` before starting the
 * HTTP server, avoiding costly external service calls during automated test runs.
 *
 * Inputs and outputs:
 *   - Not imported by other modules; intended to be run directly as `node src/e2e-server.js`.
 *   - Starts the server on `process.env.PORT` (default 5005) to avoid clashing with the
 *     development server on port 5000.
 *
 * Side effects:
 *   - Overrides `app.locals.videoRoomService` with a stub that returns a hard-coded Google
 *     STUN server, bypassing the Twilio Network Traversal Service paid API.
 *   - Overrides `app.locals.socketAuthenticator` to accept the hard-coded Playwright fixture
 *     token `mock_token` in addition to real JWTs, bypassing a live MongoDB user lookup.
 *   - Starts the HTTP server and writes a startup message to stdout.
 *
 * Dependencies:
 *   - `./app` — Production Express app + HTTP server instance.
 *   - `jsonwebtoken` — JWT verification for non-mock tokens in the socket authenticator.
 */

const { app, server } = require('./app');
const jwt = require('jsonwebtoken');

// Inject DI for video room service to bypass Twilio paid API in E2E automation
app.locals.videoRoomService = {
  generateNetworkToken: async () => ({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  })
};

// Inject DI for socket authenticator to bypass MongoDB JWT validation for test fixtures
app.locals.socketAuthenticator = (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('Authentication error: Token missing'));
  }

  // Specific fixture for Playwright
  if (token === 'mock_token') {
    socket.userId = socket.handshake.auth?.userId || 'test_user';
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch (err) {
    return next(new Error('Authentication error: Invalid token'));
  }
};

const PORT = process.env.PORT || 5005;

server.listen(PORT, () => {
  console.log(`E2E Server running in test mode with DI mocks on port ${PORT}`);
});
