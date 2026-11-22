import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

// Strong password rules: min 8 characters, at least 1 uppercase, at least 1 number
export const strongPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const createStudentSchema = {
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: strongPasswordSchema,
    standardId: z.string().regex(objectIdRegex, 'Invalid standardId ObjectId format')
  })
};
