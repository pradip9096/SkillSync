/**
 * @file app.js
 * @description Main entry point for the Real-Time Expert Session Booking System backend.
 * This file initializes the Express application, sets up Socket.io for real-time updates,
 * connects to the database, and defines the API routes.
 * 
 * @inputs Environment variables (PORT, MONGO_URI, NODE_ENV)
 * @outputs Running HTTP and WebSocket server
 * @side_effects Database connection, file system logs, network socket listeners
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const connectDB = require('./config/db');

// Load environment variables from .env file
dotenv.config();

/** 
 * @type {express.Application} 
 * Express application instance
 */
const app = express();

/** 
 * @type {http.Server} 
 * HTTP server instance wrapping the Express app
 */
const server = http.createServer(app);

/**
 * Socket.io initialization
 * Handles real-time communication between the client and server.
 * CORS is configured to allow all origins for development purposes.
 * 
 * @type {Server}
 */
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for development to resolve connectivity issues
    methods: ["GET", "POST", "PATCH"],
    credentials: true
  }
});

// Make io accessible to our routers/controllers
app.set('io', io);

// Socket.io JWT Authentication Middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('Authentication error: Token missing'));
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch (err) {
    return next(new Error('Authentication error: Invalid token'));
  }
});

/**
 * Socket.io Event Handlers
 * Manages client connections and room-based communication for real-time slot updates.
 */
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  /**
   * join_expert_room event
   * Allows a client to join a specific room based on an expert's ID.
   * This is used to broadcast slot availability changes only to users viewing that expert.
   * 
   * @param {string} expertId - The ID of the expert whose room the user is joining
   */
  socket.on('join_expert_room', (expertId) => {
    socket.join(expertId);
    console.log(`User joined room for expert: ${expertId}`);
  });

  /**
   * join_booking_room event
   * Allows clients and experts to join a private chat room for a specific booking.
   * 
   * @param {string} bookingId - The ID of the booking room to join
   */
  socket.on('join_booking_room', (bookingId) => {
    socket.join(`booking_${bookingId}`);
    console.log(`User joined chat room for booking: ${bookingId}`);
  });

  /**
   * join_user_room event
   * Allows users to join a global personal room for real-time notifications.
   */
  socket.on('join_user_room', (userId) => {
    if (socket.userId === userId) {
      socket.join(`user_${userId}`);
      console.log(`User joined global room: ${userId}`);
    }
  });

  // Handle client disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Middleware: Body parser to handle JSON-encoded request bodies
app.use(express.json());

// Middleware: Enable Cross-Origin Resource Sharing (CORS) for all routes
app.use(cors());

/**
 * Basic Route
 * Used to verify that the API is running correctly.
 * 
 * @param {express.Request} req - Express request object
 * @param {express.Response} res - Express response object
 */
app.get('/', (req, res) => {
  res.send('API is running...');
});

// Mount Routers
// Importing route modules for experts, bookings, auth, admin, and expert dashboard
const expertRoutes = require('./routes/expertRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const expertDashboardRoutes = require('./routes/expertDashboardRoutes');
const messageRoutes = require('./routes/messageRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

// Defining the base paths for the respective routes
app.use('/experts', expertRoutes);
app.use('/bookings', bookingRoutes);
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/expert-dashboard', expertDashboardRoutes);
app.use('/messages', messageRoutes);
app.use('/notifications', notificationRoutes);

/** 
 * @type {number|string} 
 * Port number for the server to listen on
 */
const PORT = process.env.PORT || 5000;

/**
 * startServer function
 * Connects to the MongoDB database and starts the HTTP server.
 * 
 * @async
 * @function startServer
 * @returns {Promise<void>}
 * @throws {Error} If database connection or server start fails
 * @side_effects Connects to MongoDB, starts listening on a network port
 */
const startServer = async () => {
  try {
    // Attempt to connect to the database before starting the server
    await connectDB();

    // Start Agenda scheduler
    const agenda = require('./config/agenda');
    require('./services/reminderScheduler'); // Registers job definitions
    await agenda.start();
    console.log('Agenda scheduler started.');

    server.listen(PORT, () => {
      console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });
  } catch (error) {
    // Log any errors that occur during startup and exit the process
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Execute the server startup function
startServer();

/**
 * Global Error Handling
 * Handles unhandled promise rejections globally to prevent the process from crashing silently.
 * 
 * @param {Error} err - The error object
 * @param {Promise} promise - The rejected promise
 * @side_effects Logs error to console, closes server, exits process
 */
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close the server and exit the process with a failure code
  server.close(() => process.exit(1));
});
