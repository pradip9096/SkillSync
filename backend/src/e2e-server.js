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
