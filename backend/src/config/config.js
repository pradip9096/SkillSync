const logger = require('./logger');
const dotenv = require('dotenv');

// Load environment variables early
dotenv.config();

/**
 * Validates that all critical environment variables are present.
 * Fails fast by exiting the process if any are missing.
 */
const checkEnvVariables = () => {
  if (process.env.NODE_ENV === 'test') return;

  const requiredEnvVars = [
    'PORT',
    'MONGO_URI',
    'JWT_SECRET',
    'RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET',
    'FRONTEND_URL'
  ];

  const missing = requiredEnvVars.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    logger.error(`CRITICAL ERROR: Missing required environment variables: ${missing.join(', ')}. Server starting in degraded state aborted.`);
    process.exit(1);
  }
};

module.exports = { checkEnvVariables };
