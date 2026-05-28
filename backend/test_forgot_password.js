/**
 * test_forgot_password.js
 * Integration test suite for the Forgot Password and Reset Password flows.
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const User = require('./src/models/User');
const emailService = require('./src/services/emailService');
const { forgotPassword, resetPassword, loginUser } = require('./src/controllers/authController');

let emailCalls = [];

const setupSpies = () => {
  emailCalls = [];
  emailService.sendEmail = async (args) => {
    emailCalls.push(args);
    return { messageId: `mock-email-id-${Date.now()}` };
  };
};

const makeMockRes = () => {
  return {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    }
  };
};

const runTests = async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/skillsync';
  console.log(`Connecting to ${mongoUri}...`);
  await mongoose.connect(mongoUri);
  console.log('Database connected.');

  // Clear existing test data
  const testEmail = 'reset_test_user@example.com';
  await User.deleteOne({ email: testEmail });

  // Setup spies
  setupSpies();

  try {
    // Create test user
    const user = await User.create({
      name: 'Reset Test User',
      email: testEmail,
      password: 'oldpassword123',
      role: 'Client'
    });

    console.log('\n--- Running TEST 1: Request Password Reset Link ---');
    const reqForgot = {
      body: { email: testEmail }
    };
    const resForgot = makeMockRes();

    await forgotPassword(reqForgot, resForgot);

    assert.strictEqual(resForgot.statusCode, 200, 'Forgot password request should succeed.');
    assert.strictEqual(emailCalls.length, 1, 'Should trigger exactly one email.');
    assert.ok(emailCalls[0].subject.includes('Reset'), 'Email subject should indicate reset request.');

    // Check database to verify reset token and expiration were set
    const updatedUser = await User.findOne({ email: testEmail });
    assert.ok(updatedUser.resetPasswordToken, 'Should store hashed token in database.');
    assert.ok(updatedUser.resetPasswordExpire, 'Should store expiration timestamp.');
    assert.ok(updatedUser.resetPasswordExpire.getTime() > Date.now(), 'Expiration must be in the future.');

    // Extract the raw token from the email body link
    const emailHtml = emailCalls[0].html;
    const urlMatch = emailHtml.match(/reset-password\/([a-f0-9]+)/);
    assert.ok(urlMatch, 'Email HTML should contain a reset password URL with token.');
    const rawToken = urlMatch[1];
    console.log(`Found raw reset token: ${rawToken}`);
    console.log('TEST 1 Passed: Token generated, saved, and sent successfully.');


    console.log('\n--- Running TEST 2: Reset Password with Invalid Token (Should Fail) ---');
    const reqResetInvalid = {
      params: { token: 'invalidtoken1234567890' },
      body: { password: 'newpassword123' }
    };
    const resResetInvalid = makeMockRes();

    await resetPassword(reqResetInvalid, resResetInvalid);
    assert.strictEqual(resResetInvalid.statusCode, 400, 'Should reject invalid token.');
    assert.strictEqual(resResetInvalid.data.error, 'Invalid or expired password reset token');
    console.log('TEST 2 Passed: Invalid token rejected successfully.');


    console.log('\n--- Running TEST 3: Reset Password with Expired Token (Should Fail) ---');
    // Manually force-expire the token in the database
    updatedUser.resetPasswordExpire = new Date(Date.now() - 5000); // 5 seconds in the past
    await updatedUser.save();

    const reqResetExpired = {
      params: { token: rawToken },
      body: { password: 'newpassword123' }
    };
    const resResetExpired = makeMockRes();

    await resetPassword(reqResetExpired, resResetExpired);
    assert.strictEqual(resResetExpired.statusCode, 400, 'Should reject expired token.');
    assert.strictEqual(resResetExpired.data.error, 'Invalid or expired password reset token');
    console.log('TEST 3 Passed: Expired token rejected successfully.');


    console.log('\n--- Running TEST 4: Reset Password with Valid Token (Should Succeed) ---');
    // Restore token expiration to the future
    const freshToken = crypto.randomBytes(20).toString('hex');
    updatedUser.resetPasswordToken = crypto.createHash('sha256').update(freshToken).digest('hex');
    updatedUser.resetPasswordExpire = new Date(Date.now() + 10 * 60 * 1000);
    await updatedUser.save();

    const reqResetValid = {
      params: { token: freshToken },
      body: { password: 'newpassword123' }
    };
    const resResetValid = makeMockRes();

    await resetPassword(reqResetValid, resResetValid);
    assert.strictEqual(resResetValid.statusCode, 200, 'Should succeed password reset.');
    assert.ok(resResetValid.data.token, 'Should return a JWT token for immediate login.');
    assert.strictEqual(resResetValid.data.user.email, testEmail, 'Should return user profile data.');

    // Verify token fields are cleared in database
    const resetUser = await User.findOne({ email: testEmail });
    assert.strictEqual(resetUser.resetPasswordToken, null, 'Hashed token should be cleared.');
    assert.strictEqual(resetUser.resetPasswordExpire, null, 'Expiration should be cleared.');
    console.log('TEST 4 Passed: Password reset and token auto-login succeeded.');


    console.log('\n--- Running TEST 5: Verify Old Credentials Fail & New Credentials Succeed ---');
    // Test login with old password (should fail)
    const reqLoginOld = {
      body: { email: testEmail, password: 'oldpassword123' }
    };
    const resLoginOld = makeMockRes();
    await loginUser(reqLoginOld, resLoginOld);
    assert.strictEqual(resLoginOld.statusCode, 401, 'Old password login must fail.');

    // Test login with new password (should succeed)
    const reqLoginNew = {
      body: { email: testEmail, password: 'newpassword123' }
    };
    const resLoginNew = makeMockRes();
    await loginUser(reqLoginNew, resLoginNew);
    assert.strictEqual(resLoginNew.statusCode, 200, 'New password login must succeed.');
    assert.ok(resLoginNew.data.token, 'New password login must return JWT.');
    console.log('TEST 5 Passed: Credentials sync verified successfully.');

    console.log('\nAll Forgot Password Integration Tests PASSED successfully.');

  } catch (err) {
    console.error('Test Suite Failed:', err);
    process.exit(1);
  } finally {
    // Cleanup database
    await User.deleteOne({ email: testEmail });
    await mongoose.disconnect();
    console.log('Database disconnected.');
    process.exit(0);
  }
};

runTests();
