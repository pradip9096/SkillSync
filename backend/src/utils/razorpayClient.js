const Razorpay = require('razorpay');
const CircuitBreaker = require('opossum');
const logger = require('../config/logger');

let razorpay = null;

if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
}

const breakerOptions = {
  timeout: 10000, // 10 seconds
  errorThresholdPercentage: 50,
  resetTimeout: 30000
};

// Create Breakers
const createOrderBreaker = new CircuitBreaker(async (params) => {
  if (!razorpay) throw new Error('Razorpay not initialized');
  return await razorpay.orders.create(params);
}, breakerOptions);

const fetchPaymentsBreaker = new CircuitBreaker(async (orderId) => {
  if (!razorpay) throw new Error('Razorpay not initialized');
  return await razorpay.orders.fetchPayments(orderId);
}, breakerOptions);

const refundPaymentBreaker = new CircuitBreaker(async (paymentId, params) => {
  if (!razorpay) throw new Error('Razorpay not initialized');
  return await razorpay.payments.refund(paymentId, params);
}, breakerOptions);

// Fallbacks
createOrderBreaker.fallback((params, err) => {
  logger.error({ err, params }, '[Razorpay Breaker] createOrder failed');
  throw new Error('Payment gateway is currently unavailable. Please try again later.');
});

fetchPaymentsBreaker.fallback((orderId, err) => {
  logger.error({ err, orderId }, '[Razorpay Breaker] fetchPayments failed');
  throw new Error('Unable to verify payment status at this time.');
});

refundPaymentBreaker.fallback((paymentId, params, err) => {
  logger.error({ err, paymentId }, '[Razorpay Breaker] refundPayment failed');
  throw new Error('Refund service is currently unavailable. Please contact support.');
});

module.exports = {
  razorpay,
  createOrder: (params) => createOrderBreaker.fire(params),
  fetchPayments: (orderId) => fetchPaymentsBreaker.fire(orderId),
  refundPayment: (paymentId, params) => refundPaymentBreaker.fire(paymentId, params)
};
