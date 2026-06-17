/**
 * @file env.js
 * @description Centralized Environment Configuration
 * 
 * Purpose: Replaces scattered import.meta.env calls with validated, predictable values to prevent 
 * silent failures due to missing or misconfigured environment variables across the app.
 */

const getApiUrl = () => {
  // Use VITE_API_URL if provided, else default to 5001 (matching backend default)
  const url = import.meta.env.VITE_API_URL || 'http://localhost:5001/api/v1';
  // Strip trailing slashes for consistency
  return url.replace(/\/+$/, '');
};

const getSocketUrl = () => {
  // 1. Explicit socket URL takes precedence
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }
  // 2. Derive from API URL by stripping the /api/v1 path
  const apiUrl = getApiUrl();
  return apiUrl.replace(/\/api\/v1\/?$/, '') || 'http://localhost:5001';
};

export const config = {
  API_URL: getApiUrl(),
  SOCKET_URL: getSocketUrl(),
  RAZORPAY_KEY_ID: import.meta.env.VITE_RAZORPAY_KEY_ID || '',
  IS_DEV: import.meta.env.DEV
};

// Proactive validation during development
if (config.IS_DEV) {
  if (!import.meta.env.VITE_API_URL) {
    console.warn('⚠️ [Config] Missing VITE_API_URL in .env. Falling back to default: ' + config.API_URL);
  }
  if (!import.meta.env.VITE_SOCKET_URL) {
    console.info('ℹ️ [Config] No VITE_SOCKET_URL provided. Auto-deriving Socket URL: ' + config.SOCKET_URL);
  }
  if (!config.RAZORPAY_KEY_ID) {
    console.warn('⚠️ [Config] Missing VITE_RAZORPAY_KEY_ID. Payment workflows will fail.');
  }
}

export default config;
