const crypto = require('crypto');
const httpMocks = require('node-mocks-http');
const { verifyWebhookSignature } = require('../../../src/middleware/webhookMiddleware');

describe('Feature 1.6: Webhook Middleware Unit Tests', () => {
  let req, res, next;
  const originalSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    req = httpMocks.createRequest();
    res = httpMocks.createResponse();
    next = jest.fn();
    process.env.RAZORPAY_WEBHOOK_SECRET = 'test_secret_123';
  });

  afterAll(() => {
    process.env.RAZORPAY_WEBHOOK_SECRET = originalSecret;
  });

  it('TC-WH-01: EP (Security) - Should fail closed if webhook secret is missing', () => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    
    verifyWebhookSignature(req, res, next);
    
    expect(res.statusCode).toBe(500);
    expect(next).not.toHaveBeenCalled();
  });

  it('TC-WH-02: EP (Security) - Should return 400 if signature header is missing', () => {
    verifyWebhookSignature(req, res, next);
    
    expect(res.statusCode).toBe(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('TC-WH-03: EP (Security) - Should return 400 for invalid/tampered signature', () => {
    req.headers['x-razorpay-signature'] = 'invalid_hash_value';
    req.body = { event: 'payment.captured' };
    
    verifyWebhookSignature(req, res, next);
    
    expect(res.statusCode).toBe(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('TC-WH-04: Golden Path - Should call next() for valid HMAC signature', () => {
    req.body = { event: 'payment.captured', payload: { payment: { entity: { id: 'pay_123' } } } };
    
    // Generate valid signature using crypto
    const bodyString = JSON.stringify(req.body);
    const validSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(bodyString)
      .digest('hex');
      
    req.headers['x-razorpay-signature'] = validSignature;
    
    verifyWebhookSignature(req, res, next);
    
    expect(res.statusCode).toBe(200); // default status before send is 200
    expect(next).toHaveBeenCalledTimes(1);
  });
});
