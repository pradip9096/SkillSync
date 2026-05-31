/**
 * @file phoneUtils.js
 * @description Shared utility functions for phone number format normalization.
 *
 * Purpose: Enforces a single, consistent phone number contract across all frontend
 * consumers. Phone numbers are stored in E.164 format (+91XXXXXXXXXX) in the database,
 * but displayed and accepted as bare 10-digit numbers in the UI.
 *
 * Contract:
 *   - Database / API boundary: E.164  (+919876543210)
 *   - User input / display:    bare   (9876543210)
 *   - Razorpay prefill.contact: bare  (9876543210)
 *   - Twilio SMS "to":          E.164 (+919876543210)
 */

/**
 * Convert any phone string to E.164 format for storage/API calls.
 * Accepts:
 *   - bare 10-digit:  "9876543210"         → "+919876543210"
 *   - already E.164:  "+919876543210"       → "+919876543210" (idempotent)
 *   - with spaces/dashes: "98765 43210"     → "+919876543210"
 *
 * @param {string} phone - Raw phone string from form input.
 * @returns {string} E.164 phone string, or empty string if input is falsy.
 */
export const toE164 = (phone) => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) {
    return `+${digits}`;
  }
  return `+91${digits}`;
};

/**
 * Strip the +91 prefix for display in form inputs and Razorpay prefill.
 * Accepts:
 *   - E.164:  "+919876543210"  → "9876543210"
 *   - bare:   "9876543210"     → "9876543210" (idempotent)
 *
 * @param {string} phone - Phone string from DB/API (E.164) or already bare.
 * @returns {string} Bare 10-digit phone string, or empty string if input is falsy.
 */
export const fromE164 = (phone) => {
  if (!phone) return '';
  return phone.replace(/^\+91/, '').replace(/\D/g, '').slice(0, 10);
};

/**
 * Validate that a bare or E.164 phone is a valid Indian mobile number.
 * Valid: 10 digits starting with 6–9 (after stripping +91).
 *
 * @param {string} phone - Phone in any format.
 * @returns {boolean} true if the phone is a valid Indian mobile number.
 */
export const isValidIndianPhone = (phone) => {
  const bare = fromE164(phone);
  return /^[6-9][0-9]{9}$/.test(bare);
};
