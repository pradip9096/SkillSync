/**
 * @file phoneUtils.js
 * @description Utility function for validating Indian mobile phone numbers.
 * Accepts numbers with an optional `+91` or `91` country prefix.
 *
 * Inputs and outputs:
 *   - Exports: `{ isValidIndianPhone }`.
 */

/**
 * Returns `true` if `phone` is a valid Indian mobile number (10 digits, starting
 * with 6–9, with an optional `+91` or `91` prefix).
 *
 * @param {string} phone - The phone number string to validate.
 * @returns {boolean} `true` if valid, `false` otherwise.
 */
const isValidIndianPhone = (phone) => {
  if (!phone) return false;
  // Allows optional +91 or 91 prefix, followed by 10 digits starting with 6-9
  const regex = /^(?:\+91|91)?[6-9]\d{9}$/;
  return regex.test(phone.toString().replace(/\s/g, ''));
};

module.exports = {
  isValidIndianPhone
};
