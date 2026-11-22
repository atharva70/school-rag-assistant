import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { StandardController } from '../controllers/standard.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRoles } from '../middlewares/rbac.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { UserRole } from '../constants/roles';
import {
  createTeacherSchema,
  createStandardSchema,
  addSubjectSchema
} from '../validations/admin.validation';

const router = Router();

// All routes under /api/admin require authentication and SUPER_ADMIN role
router.use(authenticate, requireRoles(UserRole.SUPER_ADMIN));

router.get('/teachers', AdminController.getTeachers);
router.post('/teachers', validateRequest(createTeacherSchema), AdminController.createTeacher);
router.get('/standards', StandardController.getAllStandards);
router.post('/standards', validateRequest(createStandardSchema), AdminController.createStandard);
router.post('/standards/:id/subjects', validateRequest(addSubjectSchema), AdminController.addSubjectToStandard);

export default router;
