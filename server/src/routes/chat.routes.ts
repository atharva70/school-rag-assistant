import { Router } from 'express';
import { ChatController } from '../controllers/chat.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRoles } from '../middlewares/rbac.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { chatLimiter } from '../middlewares/rateLimiter.middleware';
import { UserRole } from '../constants/roles';
import { chatSchema } from '../validations/chat.validation';

const router = Router();

// POST /api/chat - Protected for STUDENT (and TEACHER / SUPER_ADMIN for testing)
// chatLimiter enforces max 20 requests per 15 minutes per authenticated user ID
router.post(
  '/',
  authenticate,
  chatLimiter,
  requireRoles(UserRole.STUDENT, UserRole.TEACHER, UserRole.SUPER_ADMIN),
  validateRequest(chatSchema),
  ChatController.chat
);

export default router;
