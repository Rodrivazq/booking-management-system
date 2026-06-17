import express from 'express';
import * as adminController from '../controllers/admin.controller';
import { authMiddleware, requireAdmin, requireSuperAdmin } from '../middleware/auth';

const router = express.Router();

router.get('/users/overview', authMiddleware, requireAdmin, adminController.getUsersOverview);
router.put('/users/:userId/details', authMiddleware, requireAdmin, adminController.updateUserDetails);
router.put('/users/:userId/role', authMiddleware, requireSuperAdmin, adminController.changeUserRole);
router.post('/users', authMiddleware, requireAdmin, adminController.createUser);
router.post('/users/preview-csv', authMiddleware, requireSuperAdmin, adminController.previewUsersImport);
router.post('/users/import-csv', authMiddleware, requireSuperAdmin, adminController.importUsers);

export default router;
