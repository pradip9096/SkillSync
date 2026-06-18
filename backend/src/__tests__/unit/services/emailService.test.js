/**
 * @file emailService.test.js
 * @description Unit tests for the email dispatch service in `services/emailService.js`.
 * Verifies the SMTP transport path when SMTP_HOST is configured, and the Ethereal Mail
 * fallback path used in development mode when SMTP is not available.
 * The nodemailer module is fully mocked.
 */

const { sendEmail } = require('../../../services/emailService');
const nodemailer = require('nodemailer');

jest.mock('nodemailer');

describe('emailService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Should send email via SMTP when configured', async () => {
    process.env.SMTP_HOST = 'smtp.test.com';
    const sendMailMock = jest.fn().mockResolvedValue({ messageId: '123' });
    nodemailer.createTransport.mockReturnValue({ sendMail: sendMailMock });

    await sendEmail({ to: 'test@test.com', subject: 'sub', text: 'txt', html: '<html>' });
    
    expect(sendMailMock).toHaveBeenCalled();
    delete process.env.SMTP_HOST; // cleanup
  });

  it('Should fallback to Ethereal in development', async () => {
    delete process.env.SMTP_HOST;
    const sendMailMock = jest.fn().mockResolvedValue({ messageId: '123' });
    nodemailer.createTestAccount.mockResolvedValue({ user: 'u', pass: 'p' });
    nodemailer.createTransport.mockReturnValue({ sendMail: sendMailMock });
    nodemailer.getTestMessageUrl = jest.fn().mockReturnValue('url');

    await sendEmail({ to: 'test@test.com', subject: 'sub' });
    expect(sendMailMock).toHaveBeenCalled();
  });
});
