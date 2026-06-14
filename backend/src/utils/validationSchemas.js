const { z } = require('zod');

// Shared Indian Phone Number regex (basic validation for format +91XXXXXXXXXX)
const phoneRegex = /^\+91[6-9]\d{9}$/;

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50, "Name must be under 50 characters"),
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phone: z.string().regex(phoneRegex, "Phone must be a valid Indian mobile number starting with +91").optional(),
  role: z.enum(['user', 'expert']).optional(),
  bio: z.string().max(500).optional(),
  expertise: z.array(z.string()).optional(),
  hourlyRate: z.number().min(0).optional()
});

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required")
});

const bookingSchema = z.object({
  expert: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid expert ID format"),
  userName: z.string().min(2, "User name must be at least 2 characters").max(50),
  userEmail: z.string().email("Invalid email format"),
  userPhone: z.string().regex(phoneRegex, "Phone must be a valid Indian mobile number starting with +91"),
  bookingDate: z.string().refine(val => !isNaN(Date.parse(val)), "Invalid date format"),
  slotTime: z.string().min(5),
  notes: z.string().max(500).optional()
});

module.exports = {
  registerSchema,
  loginSchema,
  bookingSchema
};
