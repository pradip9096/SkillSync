import { describe, it, expect } from 'vitest';
import { bookingSchema } from '../../schemas/bookingSchema';

describe('bookingSchema Validation', () => {
  it('should validate a correct booking payload', () => {
    const validData = {
      userName: 'John Doe',
      userEmail: 'john@example.com',
      userPhone: '9876543210',
      notes: 'Some notes'
    };
    const result = bookingSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject missing name', () => {
    const invalidData = {
      userName: '',
      userEmail: 'john@example.com',
      userPhone: '9876543210'
    };
    const result = bookingSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toBe('Name must be at least 2 characters');
  });

  it('should reject invalid email', () => {
    const invalidData = {
      userName: 'John Doe',
      userEmail: 'johnexample.com',
      userPhone: '9876543210'
    };
    const result = bookingSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toBe('Invalid email address');
  });

  it('should reject non-Indian phone numbers', () => {
    const invalidData = {
      userName: 'John Doe',
      userEmail: 'john@example.com',
      userPhone: '1234567890'
    };
    const result = bookingSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toBe('Must be a valid 10-digit Indian mobile number (e.g. 9876543210)');
  });
});
