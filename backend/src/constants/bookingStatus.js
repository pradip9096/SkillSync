/**
 * @file bookingStatus.js
 * @description Central registry for all valid booking lifecycle statuses and the allowed
 * state-machine transitions between them. Importing this module instead of hardcoding
 * string literals ensures that status comparisons are consistent across controllers,
 * services, and models.
 *
 * Inputs and outputs:
 *   - Exports: `BOOKING_STATUS` (enum object), `VALID_TRANSITIONS` (state machine map),
 *     `isValidTransition` (guard function).
 *
 * Dependencies: none — pure constants module.
 */

/**
 * Enum of all valid booking lifecycle status strings.
 * Values are frozen to prevent accidental mutation at runtime.
 *
 * @enum {string}
 */
const BOOKING_STATUS = Object.freeze({
  /** Session request submitted but payment has not yet been captured. */
  PENDING: 'Pending',
  /** Payment captured; session is scheduled and locked. */
  CONFIRMED: 'Confirmed',
  /** Session was held and marked done by the post-session Agenda job. */
  COMPLETED: 'Completed',
  /** Session was cancelled before the late-cancellation window (>2 h before start). */
  CANCELLED: 'Cancelled',
  /** Session was cancelled within 2 hours of the start time; triggers a strike against the user. */
  LATE_CANCELLATION: 'Late Cancellation'
});

/**
 * State machine: maps each status to the set of statuses it may legally transition to.
 * Any transition not in this map is rejected by `isValidTransition` and by
 * `BookingService.updateBookingStatus`. Frozen to prevent accidental mutation.
 *
 * @type {Readonly<Record<string, string[]>>}
 */
const VALID_TRANSITIONS = Object.freeze({
  /** A pending booking can be confirmed once payment is captured, or cancelled outright. */
  [BOOKING_STATUS.PENDING]: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.CANCELLED],
  /** A confirmed booking may complete normally, be cancelled (>2 h), or be late-cancelled (<2 h). */
  [BOOKING_STATUS.CONFIRMED]: [BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CANCELLED, BOOKING_STATUS.LATE_CANCELLATION],
  /** Terminal state — a completed session cannot change status. */
  [BOOKING_STATUS.COMPLETED]: [],
  /** Terminal state — a cancelled booking cannot change status. */
  [BOOKING_STATUS.CANCELLED]: [],
  /** A late cancellation can be promoted to a plain Cancelled by admin action. */
  [BOOKING_STATUS.LATE_CANCELLATION]: [BOOKING_STATUS.CANCELLED]
});

/**
 * Guards whether a booking may legally move from `currentStatus` to `newStatus`
 * according to the `VALID_TRANSITIONS` state machine.
 *
 * @param {string} currentStatus - The booking's present status (one of `BOOKING_STATUS`).
 * @param {string} newStatus - The proposed new status (one of `BOOKING_STATUS`).
 * @returns {boolean} `true` if the transition is permitted; `false` otherwise (including
 *   when `currentStatus` is not a recognised key).
 */
const isValidTransition = (currentStatus, newStatus) => {
  const allowed = VALID_TRANSITIONS[currentStatus];
  if (!allowed) return false;
  return allowed.includes(newStatus);
};

module.exports = {
  BOOKING_STATUS,
  VALID_TRANSITIONS,
  isValidTransition
};
