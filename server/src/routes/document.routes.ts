import { Router } from 'express';
import { DocumentController } from '../controllers/document.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRoles } from '../middlewares/rbac.middleware';
import { uploadPdf, verifyPdfMagicBytes } from '../middlewares/upload.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { UserRole } from '../constants/roles';
import {
  uploadDocumentSchema,
  deleteDocumentSchema,
  getDocumentsSchema
} from '../validations/document.validation';

const router = Router();

// GET /api/documents - Accessible by all authenticated roles (filtered automatically for STUDENT)
router.get('/', authenticate, validateRequest(getDocumentsSchema), DocumentController.getDocuments);

// POST /api/documents/upload - Protected for TEACHER (and SUPER_ADMIN)
router.post(
  '/upload',
  authenticate,
  requireRoles(UserRole.TEACHER, UserRole.SUPER_ADMIN),
  uploadPdf.single('file'),
  verifyPdfMagicBytes,
  validateRequest(uploadDocumentSchema),
  DocumentController.uploadDocument
);

// DELETE /api/documents/:id - Protected for TEACHER (and SUPER_ADMIN)
router.delete(
  '/:id',
  authenticate,
  requireRoles(UserRole.TEACHER, UserRole.SUPER_ADMIN),
  validateRequest(deleteDocumentSchema),
  DocumentController.deleteDocument
);

export default router;
