/**
 * @file authMiddleware.test.js
 * @description Unit tests for the JWT authentication middleware in `authMiddleware.js`.
 * Covers Bearer token extraction, JWT signature verification, user lookup from the database,
 * rejection of missing or invalid tokens, and role-based access restriction via `restrictTo`.
 * The User model and jsonwebtoken are fully mocked.
 */

const httpMocks = require('node-mocks-http');
const jwt = require('jsonwebtoken');
const User = require('../../../models/User');
const { protect, restrictTo } = require('../../../middleware/authMiddleware');

jest.mock('../../../models/User');
jest.mock('jsonwebtoken');

describe('Feature 1.1: Auth Middleware & RBAC Unit Tests', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = httpMocks.createRequest();
    res = httpMocks.createResponse();
    next = jest.fn();
    process.env.JWT_SECRET = 'test_secret';
  });

  describe('protect() Middleware', () => {
    it('TC-AUTH-21: EP - Should reject if Authorization header is missing', async () => {
      // No headers set
      await protect(req, res, next);
      
      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res._getData()).error).toMatch(/no token provided/i);
      expect(next).not.toHaveBeenCalled();
    });

    it('TC-AUTH-21: EP - Should reject if Authorization header does not start with Bearer', async () => {
      req.headers.authorization = 'Basic somerandomtoken';
      await protect(req, res, next);
      
      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res._getData()).error).toMatch(/no token provided/i);
      expect(next).not.toHaveBeenCalled();
    });

    it('TC-AUTH-22: EP - Should reject if JWT verification throws an error', async () => {
      req.headers.authorization = 'Bearer malformedtoken';
      jwt.verify.mockImplementation(() => { throw new Error('Invalid token'); });

      await protect(req, res, next);
      
      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res._getData()).error).toMatch(/token validation failed/i);
      expect(next).not.toHaveBeenCalled();
    });

    it('TC-AUTH-23: State - Should reject if JWT is valid but User no longer exists in DB', async () => {
      req.headers.authorization = 'Bearer validtoken';
      jwt.verify.mockReturnValue({ id: 'deletedUserId' });
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

      await protect(req, res, next);
      
      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res._getData()).error).toMatch(/user not found/i);
      expect(next).not.toHaveBeenCalled();
    });

    it('Golden Path - Should attach user to req and call next() on success', async () => {
      req.headers.authorization = 'Bearer validtoken';
      jwt.verify.mockReturnValue({ id: 'validUserId' });
      
      const mockUser = { _id: 'validUserId', role: 'Client', name: 'John Doe' };
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUser) });

      await protect(req, res, next);
      
      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.statusCode).toBe(200); // Should not have changed
    });
  });

  describe('restrictTo() Middleware', () => {
    it('State - Should reject if req.user is entirely missing (protect middleware failed/skipped)', () => {
      const middleware = restrictTo('Admin', 'Expert');
      // req.user is undefined
      middleware(req, res, next);
      
      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res._getData()).error).toMatch(/credentials missing/i);
      expect(next).not.toHaveBeenCalled();
    });

    it('TC-AUTH-24: EP (RBAC) - Should return 403 if user role is not in the allowed list', () => {
      const middleware = restrictTo('Admin', 'Expert');
      req.user = { role: 'Client' }; // Not allowed
      
      middleware(req, res, next);
      
      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res._getData()).error).toMatch(/not authorized to access this resource/i);
      expect(next).not.toHaveBeenCalled();
    });

    it('Golden Path (RBAC) - Should call next() if user role is in the allowed list', () => {
      const middleware = restrictTo('Admin', 'Expert');
      req.user = { role: 'Expert' }; // Allowed
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.statusCode).toBe(200); // Should not have changed
    });
  });
});
