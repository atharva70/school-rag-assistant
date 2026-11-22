import { Router } from 'express';
import { TeacherController } from '../controllers/teacher.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRoles } from '../middlewares/rbac.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { UserRole } from '../constants/roles';
import { createStudentSchema } from '../validations/teacher.validation';

const router = Router();

// All routes under /api/teacher require authentication and TEACHER role
router.use(authenticate, requireRoles(UserRole.TEACHER));

router.get('/students', TeacherController.getStudents);
router.post('/students', validateRequest(createStudentSchema), TeacherController.createStudent);

export default router;
