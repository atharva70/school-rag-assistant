import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const chatSchema = {
  body: z.object({
    subjectName: z.string().min(1, 'subjectName is required').trim(),
    question: z
      .string()
      .min(1, 'question cannot be empty')
      .max(600, 'Question must not exceed 600 characters')
      .trim(),
    sessionId: z.string().regex(objectIdRegex, 'Invalid sessionId ObjectId format').optional(),
    standardId: z.string().regex(objectIdRegex, 'Invalid standardId ObjectId format').optional()
  })
};
