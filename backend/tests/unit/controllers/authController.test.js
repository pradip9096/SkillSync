const httpMocks = require('node-mocks-http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../../../src/models/User');
const Expert = require('../../../src/models/Expert');
const { registerUser, loginUser, getUserProfile, forgotPassword, resetPassword } = require('../../../src/controllers/authController');
const emailService = require('../../../src/services/emailService');

jest.mock('../../../src/models/User');
jest.mock('../../../src/models/Expert');
jest.mock('jsonwebtoken');
jest.mock('../../../src/services/emailService');

describe('Feature 1.1: Authentication & RBAC Unit Tests', () => {
  let req, res, mockSession;

  beforeEach(() => {
    jest.clearAllMocks();
    req = httpMocks.createRequest();
    res = httpMocks.createResponse();

    // Mock Mongoose transaction session to satisfy strict dependency mocking
    mockSession = {
      withTransaction: jest.fn(async (cb) => {
        await cb();
      }),
      endSession: jest.fn()
    };
    mongoose.startSession = jest.fn().mockResolvedValue(mockSession);
    process.env.JWT_SECRET = 'test_secret';

    // Mock JWT generation
    jwt.sign.mockReturnValue('mock_token');
  });

  describe('registerUser', () => {
    it('TC-AUTH-01: EP - Should return 400 if email or password missing', async () => {
      req.body = { email: 'test@test.com' }; // Missing password
      await registerUser(req, res);
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res._getData()).error).toMatch(/mandatory fields/i);
    });

    it('TC-AUTH-02: EP - Should block attempt to register Admin role via public API', async () => {
      req.body = { email: 'admin@test.com', password: 'pass', role: 'Admin' };
      await registerUser(req, res);
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res._getData()).error).toMatch(/forbidden/i);
    });

    it('TC-AUTH-03: EP - Should reject Expert missing mandatory profile fields', async () => {
      req.body = { email: 'ex@test.com', password: 'pass', role: 'Expert' };
      await registerUser(req, res);
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res._getData()).error).toMatch(/provide all expert profile fields/i);
    });

    it('TC-AUTH-04: BVA - Should reject Expert with invalid Indian phone format', async () => {
      req.body = {
        email: 'ex@test.com', password: 'pass', role: 'Expert',
        name: 'Test', phone: '1234567890', // Missing +91
        category: 'Technology', experience: 5, hourlyRate: 500, description: 'Desc'
      };
      await registerUser(req, res);
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res._getData()).error).toMatch(/valid 10-digit Indian mobile number/i);
    });

    it('TC-AUTH-05: EP - Should reject Expert with unapproved category', async () => {
      req.body = {
        email: 'ex@test.com', password: 'pass', role: 'Expert',
        name: 'Test', phone: '+919876543210',
        category: 'InvalidCat', experience: 5, hourlyRate: 500, description: 'Desc'
      };
      await registerUser(req, res);
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res._getData()).error).toMatch(/valid category/i);
    });

    it('TC-AUTH-06: BVA - Should reject Expert with experience < 0', async () => {
      req.body = {
        email: 'ex@test.com', password: 'pass', role: 'Expert',
        name: 'Test', phone: '+919876543210',
        category: 'Technology', experience: -1, hourlyRate: 500, description: 'Desc'
      };
      await registerUser(req, res);
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res._getData()).error).toMatch(/positive number/i);
    });

    it('TC-AUTH-07: BVA - Should reject Expert with hourlyRate < 100', async () => {
      req.body = {
        email: 'ex@test.com', password: 'pass', role: 'Expert',
        name: 'Test', phone: '+919876543210',
        category: 'Technology', experience: 5, hourlyRate: 99, description: 'Desc'
      };
      await registerUser(req, res);
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res._getData()).error).toMatch(/least 100 rupees/i);
    });

    it('TC-AUTH-08: State - Should reject if email already exists in DB', async () => {
      User.findOne.mockResolvedValue({ _id: 'existingId' });
      req.body = { email: 'ex@test.com', password: 'pass', role: 'Client' };
      await registerUser(req, res);
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res._getData()).error).toMatch(/already exists/i);
    });

    it('TC-AUTH-09: Golden Path - Should successfully register Client', async () => {
      User.findOne.mockResolvedValue(null);
      const mockCreatedUser = { _id: 'newId', email: 'c@c.com', role: 'Client', name: 'Client' };
      User.create.mockResolvedValue([mockCreatedUser]);

      req.body = { email: 'c@c.com', password: 'pass', role: 'Client', name: 'Client' };
      await registerUser(req, res);
      
      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res._getData());
      expect(data.success).toBe(true);
      expect(data.token).toBe('mock_token');
      expect(User.create).toHaveBeenCalled();
    });

    it('TC-AUTH-10: Golden Path - Should successfully register Expert and profile', async () => {
      User.findOne.mockResolvedValue(null);
      const mockCreatedUser = { _id: 'newId', email: 'e@e.com', role: 'Expert' };
      User.create.mockResolvedValue([mockCreatedUser]);
      Expert.create.mockResolvedValue([{ _id: 'expId' }]);

      req.body = {
        email: 'e@e.com', password: 'pass', role: 'Expert',
        name: 'Test', phone: '+919876543210',
        category: 'Technology', experience: 5, hourlyRate: 500, description: 'Desc'
      };
      await registerUser(req, res);
      
      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res._getData());
      expect(data.success).toBe(true);
      expect(data.token).toBe('mock_token');
      expect(User.create).toHaveBeenCalled();
      expect(Expert.create).toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalled();
    });

    it('TC-AUTH-11: Resilience - Should handle Mongoose transaction abort', async () => {
      User.findOne.mockResolvedValue(null);
      
      // Force the transaction block to throw an error
      mockSession.withTransaction = jest.fn(async () => {
        throw new Error('Transaction failed DB lock');
      });

      req.body = { email: 'c@c.com', password: 'pass', role: 'Client', name: 'Client' };
      await registerUser(req, res);
      
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res._getData()).error).toMatch(/Transaction failed DB lock/i);
    });
  });

  describe('loginUser', () => {
    it('TC-AUTH-13: EP - Should reject if credentials missing', async () => {
      req.body = { email: 'test@test.com' };
      await loginUser(req, res);
      expect(res.statusCode).toBe(400);
    });

    it('TC-AUTH-14: State - Should reject if User not found', async () => {
      User.findOne.mockResolvedValue(null);
      req.body = { email: 'test@test.com', password: 'pass' };
      await loginUser(req, res);
      expect(res.statusCode).toBe(401);
    });

    it('TC-AUTH-15: State - Should reject if Password mismatch', async () => {
      const mockUser = { matchPassword: jest.fn().mockResolvedValue(false) };
      User.findOne.mockResolvedValue(mockUser);
      req.body = { email: 'test@test.com', password: 'pass' };
      await loginUser(req, res);
      expect(res.statusCode).toBe(401);
    });

    it('TC-AUTH-16: Golden Path - Should return JWT on valid login', async () => {
      const mockUser = { 
        _id: 'uId', email: 'test@test.com', role: 'Client', 
        matchPassword: jest.fn().mockResolvedValue(true) 
      };
      User.findOne.mockResolvedValue(mockUser);
      req.body = { email: 'test@test.com', password: 'pass' };
      await loginUser(req, res);
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res._getData()).token).toBe('mock_token');
    });
  });

  describe('getUserProfile', () => {
    it('TC-AUTH-18: State - Should reject if user record deleted while holding JWT', async () => {
      req.user = { _id: 'deletedId' };
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
      await getUserProfile(req, res);
      expect(res.statusCode).toBe(404);
    });

    it('TC-AUTH-19: Golden Path - Should return user profile data', async () => {
      req.user = { _id: 'uId' };
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: 'uId', name: 'John' }) });
      await getUserProfile(req, res);
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res._getData()).user.name).toBe('John');
    });
  });
});

describe('Feature 1.2: Password Recovery & Tokens Unit Tests', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = httpMocks.createRequest();
    res = httpMocks.createResponse();
    process.env.JWT_SECRET = 'test_secret';
  });

  describe('forgotPassword', () => {
    it('TC-PR-01: EP - Should return 400 if email is missing', async () => {
      req.body = {};
      await forgotPassword(req, res);
      expect(res.statusCode).toBe(400);
    });

    it('TC-PR-02: EP Security - Should return 200 even if email not found in DB', async () => {
      User.findOne.mockResolvedValue(null);
      req.body = { email: 'unknown@test.com' };
      await forgotPassword(req, res);
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res._getData()).data).toMatch(/will receive a password reset link/i);
    });

    it('TC-PR-03: Resilience - Should nullify tokens if emailService throws an error', async () => {
      const mockUser = {
        email: 'user@test.com',
        save: jest.fn().mockResolvedValue(true)
      };
      User.findOne.mockResolvedValue(mockUser);
      const emailService = require('../../../src/services/emailService');
      emailService.sendEmail.mockRejectedValue(new Error('SMTP connection failed'));

      req.body = { email: 'user@test.com' };
      await forgotPassword(req, res);

      expect(res.statusCode).toBe(500);
      expect(JSON.parse(res._getData()).error).toMatch(/Email could not be sent/i);
      // Ensure rollback was called
      expect(mockUser.resetPasswordToken).toBeNull();
      expect(mockUser.resetPasswordExpire).toBeNull();
      expect(mockUser.save).toHaveBeenCalledTimes(2); // Once to save token, once to rollback
    });

    it('TC-PR-04: Golden Path - Should generate token and call emailService', async () => {
      const mockUser = {
        email: 'user@test.com',
        save: jest.fn().mockResolvedValue(true)
      };
      User.findOne.mockResolvedValue(mockUser);
      const emailService = require('../../../src/services/emailService');
      emailService.sendEmail.mockResolvedValue(true);

      req.body = { email: 'user@test.com' };
      await forgotPassword(req, res);

      expect(res.statusCode).toBe(200);
      expect(mockUser.resetPasswordToken).toBeDefined();
      expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
    });

    it('TC-PR-05: Resilience - Should return 500 on unhandled DB error', async () => {
      User.findOne.mockRejectedValue(new Error('DB crash'));
      req.body = { email: 'user@test.com' };
      await forgotPassword(req, res);
      expect(res.statusCode).toBe(500);
    });
  });

  describe('resetPassword', () => {
    it('TC-PR-06: EP - Should return 400 if password is missing', async () => {
      req.params.token = 'some_token';
      req.body = {};
      await resetPassword(req, res);
      expect(res.statusCode).toBe(400);
    });

    it('TC-PR-07: BVA - Should return 400 if password is < 6 characters', async () => {
      req.params.token = 'some_token';
      req.body = { password: '12345' };
      await resetPassword(req, res);
      expect(res.statusCode).toBe(400);
    });

    it('TC-PR-08: State - Should return 400 if token is invalid or expired', async () => {
      req.params.token = 'invalid_token';
      req.body = { password: 'newpassword' };
      User.findOne.mockResolvedValue(null);
      await resetPassword(req, res);
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res._getData()).error).toMatch(/Invalid or expired/i);
    });

    it('TC-PR-09: Golden Path - Should update password and return new JWT', async () => {
      req.params.token = 'valid_token';
      req.body = { password: 'newpassword' };
      
      const mockUser = {
        _id: 'userId',
        save: jest.fn().mockResolvedValue(true)
      };
      User.findOne.mockResolvedValue(mockUser);
      
      const jwt = require('jsonwebtoken');
      jwt.sign.mockReturnValue('new_jwt_token');

      await resetPassword(req, res);
      
      expect(res.statusCode).toBe(200);
      expect(mockUser.password).toBe('newpassword');
      expect(mockUser.resetPasswordToken).toBeNull();
      expect(mockUser.resetPasswordExpire).toBeNull();
      expect(mockUser.save).toHaveBeenCalledTimes(1);
      expect(JSON.parse(res._getData()).token).toBe('new_jwt_token');
    });

    it('TC-PR-10: Resilience - Should return 500 on unhandled DB error', async () => {
      req.params.token = 'valid_token';
      req.body = { password: 'newpassword' };
      User.findOne.mockRejectedValue(new Error('DB connection lost'));
      
      await resetPassword(req, res);
      expect(res.statusCode).toBe(500);
    });
  });
});
