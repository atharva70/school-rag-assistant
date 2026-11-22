import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const getStandardByIdSchema = {
  params: z.object({
    id: z.string().regex(objectIdRegex, 'Invalid standard ID parameter')
  })
};
