import express from 'express';
import * as menuController from '../controllers/menu.controller';
import { authMiddleware, requireAdmin, requireSuperAdmin } from '../middleware/auth';

const router = express.Router();

router.get('/', menuController.getMenu);
router.put('/', authMiddleware, requireSuperAdmin, menuController.updateMenu);

export default router;
