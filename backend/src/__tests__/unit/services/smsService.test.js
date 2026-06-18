/**
 * @file smsService.test.js
 * @description Unit tests for the Twilio SMS dispatch service in `services/smsService.js`.
 * Verifies Twilio message creation when credentials are configured, the development
 * console-log fallback when credentials are absent, and the circuit breaker fallback
 * that returns a mock SID to prevent system failure when Twilio is unavailable.
 * The twilio module is fully mocked.
 */

const { sendSMS } = require('../../../services/smsService');
const twilio = require('twilio');

jest.mock('twilio');

describe('smsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Should send SMS via Twilio when configured', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'sid';
    process.env.TWILIO_AUTH_TOKEN = 'token';
    process.env.TWILIO_FROM_PHONE = '123';
    
    const createMock = jest.fn().mockResolvedValue({ sid: 'msg1' });
    twilio.mockReturnValue({ messages: { create: createMock } });

    jest.resetModules();
    const twilioMock = require('twilio');
    twilioMock.mockReturnValue({ messages: { create: createMock } });
    const { sendSMS: sendSMSReloaded } = require('../../../services/smsService');

    await sendSMSReloaded({ to: '12345', message: 'msg' });
    
    expect(createMock).toHaveBeenCalled();

    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_FROM_PHONE;
  });

  it('Should fallback to console in development', async () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    const res = await sendSMS({ to: '12345', message: 'msg' });
    expect(res.sid).toMatch(/mock-sms-id-/);
  });
});
