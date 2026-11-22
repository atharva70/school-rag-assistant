import { Router } from 'express';
import { StandardController } from '../controllers/standard.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { getStandardByIdSchema } from '../validations/standard.validation';

const router = Router();

// Standards endpoint is accessible by any authenticated user (SUPER_ADMIN, TEACHER, STUDENT)
router.use(authenticate);

router.get('/', StandardController.getAllStandards);
router.get('/:id', validateRequest(getStandardByIdSchema), StandardController.getStandardById);

export default router;
