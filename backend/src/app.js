


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
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const connectDB = require('./config/db');
const logger = require('./config/logger');
const pinoHttp = require('pino-http');
const errorHandler = require('./middleware/errorHandler');

// Load environment variables from .env file
dotenv.config();

// Assert critical environment variables
const { checkEnvVariables } = require('./config/config');
checkEnvVariables();

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

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173'
].filter(Boolean);

/**
 * Socket.io initialization
 * Handles real-time communication between the client and server.
 * CORS is configured to allow frontend origins.
 * 
 * @type {Server}
 */
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PATCH"],
    credentials: true
  }
});

if (process.env.REDIS_URI) {
  const { createClient } = require('redis');
  const { createAdapter } = require('@socket.io/redis-adapter');
  const pubClient = createClient({ url: process.env.REDIS_URI });
  const subClient = pubClient.duplicate();

  Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
    io.adapter(createAdapter(pubClient, subClient));
    logger.info('Redis adapter attached to Socket.io');
  }).catch((err) => {
    logger.error({ err }, 'Redis connection failed');
  });
}

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
  logger.info(`A user connected: ${socket.id}`);

  /**
   * join_expert_room event
   * Allows a client to join a specific room based on an expert's ID.
   * This is used to broadcast slot availability changes only to users viewing that expert.
   * 
   * @param {string} expertId - The ID of the expert whose room the user is joining
   */
  socket.on('join_expert_room', (expertId) => {
    socket.join(expertId);
    logger.info(`User joined room for expert: ${expertId}`);
  });

  /**
   * join_booking_room event
   * Allows clients and experts to join a private chat room for a specific booking.
   * Authorized users only (must be part of the booking).
   * 
   * @param {string} bookingId - The ID of the booking room to join
   */
  socket.on('join_booking_room', async (bookingId) => {
    try {
      const Booking = require('./models/Booking');
      const booking = await Booking.findById(bookingId).populate('expert');
      if (!booking) return;

      const isClient = booking.user && booking.user.toString() === socket.userId;
      const isExpert = booking.expert && booking.expert.user && booking.expert.user.toString() === socket.userId;

      if (isClient || isExpert) {
        socket.join(`booking_${bookingId}`);
        logger.info(`User joined chat room for booking: ${bookingId}`);
      }
    } catch (error) {
      logger.error({ error }, 'Error joining booking room');
    }
  });

  /**
   * leave_booking_room event
   * Allows clients and experts to leave a private chat room.
   */
  socket.on('leave_booking_room', (bookingId) => {
    socket.leave(`booking_${bookingId}`);
    logger.info(`User left chat room for booking: ${bookingId}`);
  });

  /**
   * join_user_room event
   * Allows users to join a global personal room for real-time notifications.
   */
  socket.on('join_user_room', (userId) => {
    if (socket.userId === userId) {
      socket.join(`user_${userId}`);
      logger.info(`User joined global room: ${userId}`);
    }
  });

  /**
   * Typing indicators
   */
  socket.on('typing', (bookingId) => {
    socket.to(`booking_${bookingId}`).emit('typing', socket.userId);
  });

  socket.on('stop_typing', (bookingId) => {
    socket.to(`booking_${bookingId}`).emit('stop_typing', socket.userId);
  });

  // Handle client disconnection
  socket.on('disconnect', () => {
    logger.info('User disconnected');
  });
});

// Base middleware
// Add security headers (disable CORP so cross-origin frontend can read responses)
app.use(helmet({
  crossOriginResourcePolicy: false,
}));
// Prevent NoSQL Injection (Custom wrapper for Express 5 compatibility)
app.use((req, res, next) => {
  ['body', 'params', 'headers', 'query'].forEach((key) => {
    if (req[key]) {
      mongoSanitize.sanitize(req[key]);
    }
  });
  next();
});

const crypto = require('crypto');
// Global Request Logging (Epic 2.2)
app.use(pinoHttp({ 
  logger, 
  autoLogging: true,
  genReqId: (req) => req.headers['x-correlation-id'] || crypto.randomUUID()
}));

// Middleware for CORS - strict origin
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// Body parser with size limit to prevent payload bloat
app.use(express.json({
  limit: '10kb',
  verify: (req, res, buf) => {
    if (req.originalUrl && req.originalUrl.includes('/webhook')) {
      req.rawBody = buf.toString('utf-8');
    }
  }
}));

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

// Mount Routers (Legacy - Deprecated)
app.use('/experts', expertRoutes);
app.use('/bookings', bookingRoutes);
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/expert-dashboard', expertDashboardRoutes);
app.use('/messages', messageRoutes);
app.use('/notifications', notificationRoutes);

// Mount Routers (v1 API - Epic 1.3)
app.use('/api/v1/experts', expertRoutes);
app.use('/api/v1/bookings', bookingRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/expert-dashboard', expertDashboardRoutes);
app.use('/api/v1/messages', messageRoutes);
app.use('/api/v1/notifications', notificationRoutes);

if (process.env.NODE_ENV !== 'production') {
  const testRoutes = require('./routes/testRoutes');
  app.use('/api/test', testRoutes);
}

// Global Error Handler Middleware
app.use(errorHandler);

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
    agenda.io = io; // Attach io for background jobs
    require('./services/reminderScheduler'); // Registers job definitions
    await agenda.start();
    logger.info('Agenda scheduler started.');

    server.listen(PORT, () => {
      logger.info(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });
  } catch (error) {
    // Log any errors that occur during startup and exit the process
    logger.fatal({ error }, 'Failed to start server');
    process.exit(1);
  }
};

// Execute the server startup function only if this file is run directly
if (require.main === module) {
  startServer();
}

module.exports = { app, server };

/**
 * Global Error Handling
 * Handles unhandled promise rejections globally to prevent the process from crashing silently.
 * 
 * @param {Error} err - The error object
 * @param {Promise} promise - The rejected promise
 * @side_effects Logs error to console, closes server, exits process
 */
process.on('unhandledRejection', (err, promise) => {
  logger.error({ err }, 'Unhandled Rejection. Shutting down gracefully...');
  gracefulShutdown('unhandledRejection');
});

/**
 * Graceful Shutdown Handlers
 * Captures OS termination signals to safely shut down Agenda, the HTTP server, and Mongoose.
 */
const gracefulShutdown = async (signal) => {
  logger.info(`\n${signal} received. Starting graceful shutdown...`);

  // Force exit after 30 seconds
  const forceExitTimeout = setTimeout(() => {
    logger.error('Graceful shutdown timed out after 30 seconds. Forcing exit.');
    process.exit(1);
  }, 30000);

  try {
    const agenda = require('./config/agenda');
    const mongoose = require('mongoose');

    // 1. Stop Agenda from accepting new jobs and wait for active jobs to yield/finish
    logger.info('Stopping Agenda...');
    await agenda.stop();
    logger.info('Agenda stopped.');

    // 2. Close the HTTP server
    logger.info('Closing HTTP server...');
    server.close(async () => {
      logger.info('HTTP server closed.');

      // 3. Disconnect Mongoose
      logger.info('Disconnecting from MongoDB...');
      await mongoose.connection.close();
      logger.info('MongoDB disconnected.');

      clearTimeout(forceExitTimeout);
      // Exit process successfully
      process.exit(0);
    });
  } catch (error) {
    logger.error({ error }, 'Error during graceful shutdown');
    clearTimeout(forceExitTimeout);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
