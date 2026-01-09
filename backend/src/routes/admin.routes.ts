import express from 'express';
import * as adminController from '../controllers/admin.controller';
import { authMiddleware, requireAdmin } from '../middleware/auth';

const router = express.Router();

router.put('/users/:userId/details', authMiddleware, requireAdmin, adminController.updateUserDetails);
router.post('/users', authMiddleware, requireAdmin, adminController.createUser);

export default router;
