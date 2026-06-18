import { z } from 'zod';

export const bookingSchema = z.object({
  userName: z.string().min(2, 'Name must be at least 2 characters').max(50, 'Name must be under 50 characters'),
  userEmail: z.string().email('Invalid email address'),
  userPhone: z.string().regex(/^[6-9]\d{9}$/, 'Must be a valid 10-digit Indian mobile number (e.g. 9876543210)'),
  notes: z.string().max(500).optional(),
});
