/**
 * @file socket.js
 * @description Service for establishing a real-time connection with the server via Socket.io.
 * 
 * Purpose: Provides a singleton socket instance for real-time communication (e.g., slot updates).
 * Inputs: None (connects to hardcoded backend URL).
 * Outputs: An initialized Socket.io client instance.
 * Side Effects: Establishes a persistent WebSocket connection to the backend server.
 */

import { io } from 'socket.io-client';

/**
 * Initialize the Socket.io client.
 * Connects to the backend server at http://localhost:5000.
 * 
 * Purpose: Creates and configures the socket connection.
 * Configuration:
 * - 'websocket' transport is preferred for performance.
 * - 'upgrade: false' ensures it stays on the websocket transport.
 * @type {import('socket.io-client').Socket}
 */
const socket = io('http://localhost:5000', {
  transports: ['polling', 'websocket'],
  upgrade: true,
  autoConnect: false
});

export const connectSocket = (token) => {
  if (token && !socket.connected) {
    socket.auth = { token };
    socket.connect();
  }
};

export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
};

export default socket;
