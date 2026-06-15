const BOOKING_STATUS = Object.freeze({
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  LATE_CANCELLATION: 'Late Cancellation'
});

const VALID_TRANSITIONS = Object.freeze({
  [BOOKING_STATUS.PENDING]: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.CANCELLED],
  [BOOKING_STATUS.CONFIRMED]: [BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CANCELLED, BOOKING_STATUS.LATE_CANCELLATION],
  [BOOKING_STATUS.COMPLETED]: [],
  [BOOKING_STATUS.CANCELLED]: [],
  [BOOKING_STATUS.LATE_CANCELLATION]: [BOOKING_STATUS.CANCELLED] // Can be mapped to Cancelled
});

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
