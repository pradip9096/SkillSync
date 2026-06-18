/**
 * @file emailService.js
 * @description Transactional email dispatch service. Sends via a configured SMTP transport
 * when `SMTP_HOST` is set, or falls back to Ethereal Mail (free test accounts) in
 * development, printing a preview URL to the console.
 *
 * Inputs and outputs:
 *   - Exports: `{ sendEmail }`.
 *
 * Side effects:
 *   - Establishes an SMTP connection to the configured mail server or Ethereal.
 *   - Sends an email to `to`.
 *   - Writes logs to stdout.
 *
 * Dependencies:
 *   - `nodemailer` — SMTP client and Ethereal test account factory.
 */

const nodemailer = require('nodemailer');

/**
 * Dispatches a transactional email. Uses the SMTP transport when `SMTP_HOST` is set;
 * otherwise creates a free Ethereal test account and logs a preview URL.
 * This function is async. It awaits `transporter.sendMail` (and optionally
 * `nodemailer.createTestAccount` for the Ethereal fallback).
 *
 * @async
 * @param {{ to: string, subject: string, html?: string, text?: string }} args
 *   - `to`: Recipient email address.
 *   - `subject`: Email subject line.
 *   - `html`: HTML body (optional).
 *   - `text`: Plain-text body (optional).
 * @returns {Promise<{ messageId: string, previewUrl?: string }>} Nodemailer send result.
 * @throws {Error} If SMTP delivery fails (re-throws the underlying nodemailer error).
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
