import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const uploadDocumentSchema = {
  body: z.object({
    standardId: z.string().regex(objectIdRegex, 'Invalid standardId ObjectId format'),
    subjectName: z.string().min(1, 'Subject name is required').trim(),
    title: z.string().min(1).trim().optional()
  })
};

export const deleteDocumentSchema = {
  params: z.object({
    id: z.string().regex(objectIdRegex, 'Invalid document ID parameter')
  })
};

export const getDocumentsSchema = {
  query: z.object({
    standardId: z.string().regex(objectIdRegex, 'Invalid standardId').optional(),
    subjectName: z.string().trim().optional()
  })
};
