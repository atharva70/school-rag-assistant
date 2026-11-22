import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { loginLimiter } from '../middlewares/rateLimiter.middleware';
import { loginSchema } from '../validations/auth.validation';

const router = Router();

// Strict limiter on login (max 10 attempts per 15 min per IP)
router.post('/login', loginLimiter, validateRequest(loginSchema), AuthController.login);
router.get('/me', authenticate, AuthController.getProfile);

export default router;
