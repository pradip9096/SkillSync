const { sendSMS } = require('../../../src/services/smsService');
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

    await sendSMS({ to: '12345', message: 'msg' });
    
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
