import { describe, it, expect } from 'vitest';
import { BOOKING_STATUS, isValidTransition } from '../bookingStatus';

describe('bookingStatus State Machine', () => {
  it('should define all booking statuses', () => {
    expect(BOOKING_STATUS).toBeDefined();
    expect(BOOKING_STATUS.PENDING).toBe('Pending');
    expect(BOOKING_STATUS.CONFIRMED).toBe('Confirmed');
    expect(BOOKING_STATUS.COMPLETED).toBe('Completed');
    expect(BOOKING_STATUS.CANCELLED).toBe('Cancelled');
  });

  it('should allow valid transitions', () => {
    expect(isValidTransition(BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED)).toBe(true);
    expect(isValidTransition(BOOKING_STATUS.PENDING, BOOKING_STATUS.CANCELLED)).toBe(true);
    expect(isValidTransition(BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.COMPLETED)).toBe(true);
    expect(isValidTransition(BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.CANCELLED)).toBe(true);
  });

  it('should deny invalid transitions', () => {
    expect(isValidTransition(BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CONFIRMED)).toBe(false);
    expect(isValidTransition(BOOKING_STATUS.CANCELLED, BOOKING_STATUS.PENDING)).toBe(false);
    expect(isValidTransition(BOOKING_STATUS.PENDING, BOOKING_STATUS.COMPLETED)).toBe(false);
    expect(isValidTransition('InvalidState', BOOKING_STATUS.CONFIRMED)).toBe(false);
  });
});
