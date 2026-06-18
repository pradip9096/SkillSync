/**
 * @file timeFormatters.js
 * @description Utility functions for formatting time values into human-readable strings.
 * All notification, email, and SMS copy must use these formatters rather than raw
 * database time strings.
 *
 * Inputs and outputs:
 *   - Exports: `{ formatTime12H }`.
 */

/**
 * Standard utility for formatting 24-hour time strings into 12-hour AM/PM format.
 *
 * AS PER MASTER_SPEC.md:
 * "Raw 24-hour database time strings (slotTime) must never be passed directly into user-facing payload strings (Notifications, Emails, SMS) without passing through the central timeFormatters.js utility."
 *
 * @param {string} time24 - The 24-hour time string (e.g., '14:00')
 * @returns {string} The formatted 12-hour time string (e.g., '02:00 PM')
 */
const formatTime12H = (time24) => {
  if (!time24) return '';
  const [hour, min] = time24.split(':');
  const hour24 = parseInt(hour, 10);
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  let hour12 = hour24 % 12;
  if (hour12 === 0) hour12 = 12;
  return `${hour12.toString().padStart(2, '0')}:${min} ${ampm}`;
};

module.exports = {
  formatTime12H
};
