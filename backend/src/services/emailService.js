const nodemailer = require('nodemailer');

/**
 * Purpose: General email dispatcher service.
 * Inputs: { to, subject, html, text }
 * Outputs: Promise resolving to the sent email info or mock payload.
 * Side Effects: Sends an email via SMTP in production or generates a console log/Ethereal preview link in development.
 */
const sendEmail = async ({ to, subject, html, text }) => {
  // If SMTP configuration is provided, use it
  if (process.env.SMTP_HOST) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT, 10) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || '"SkillSync" <noreply@skillsync.com>',
        to,
        subject,
        text,
        html,
      });

      console.log(`[Email Service] Email sent successfully to ${to}. MessageId: ${info.messageId}`);
      return info;
    } catch (err) {
      console.error(`[Email Service] SMTP Delivery failed to ${to}:`, err.message);
      throw err;
    }
  }

  // Development Fallback: Log to console and send to free Ethereal Mail server
  console.log('================= DEVELOPMENT EMAIL LOG =================');
  console.log(`To:      ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Text:    ${text || '(No text version)'}`);
  console.log(`HTML:    ${html ? html.substring(0, 300) + '...' : '(No HTML version)'}`);
  console.log('========================================================');

  try {
    const testAccount = await nodemailer.createTestAccount();
    const transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    const info = await transporter.sendMail({
      from: '"SkillSync Dev" <noreply@skillsync.com>',
      to,
      subject,
      text,
      html,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log(`[Email Service Dev] Ethereal preview link generated: ${previewUrl}`);
    return { messageId: info.messageId, previewUrl };
  } catch (err) {
    console.log(`[Email Service Dev] Ethereal dispatch failed: ${err.message}. Raw logging fallback completed.`);
    return { messageId: `mock-email-id-${Date.now()}` };
  }
};

module.exports = { sendEmail };
