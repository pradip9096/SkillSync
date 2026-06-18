/**
 * @file logger.js
 * @description Creates and exports the application-wide Pino structured logger instance.
 * In production, emits compact JSON to stdout. In development, uses `pino-pretty` for
 * human-readable, colorized console output with timestamps.
 *
 * Inputs and outputs:
 *   - Reads `process.env.LOG_LEVEL` to override the default log level.
 *   - Reads `process.env.NODE_ENV` to select the transport (JSON vs pino-pretty).
 *   - Exports: the configured `pino` logger instance.
 *
 * Dependencies:
 *   - `pino` — High-performance JSON logger.
 *   - `pino-pretty` — Development-only human-readable transport (dev dependency).
 */

const pino = require('pino');

const isProduction = process.env.NODE_ENV === 'production';

const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  ...(isProduction
    ? {} // Default JSON format in production
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }),
});

module.exports = logger;
