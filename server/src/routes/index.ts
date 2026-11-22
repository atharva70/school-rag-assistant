import { Router } from 'express';
import authRoutes from './auth.routes';
import adminRoutes from './admin.routes';
import teacherRoutes from './teacher.routes';
import standardRoutes from './standard.routes';
import documentRoutes from './document.routes';
import chatRoutes from './chat.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/teacher', teacherRoutes);
router.use('/standards', standardRoutes);
router.use('/documents', documentRoutes);
router.use('/chat', chatRoutes);

export default router;
