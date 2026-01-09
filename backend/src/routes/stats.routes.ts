import express from 'express';
import * as statsController from '../controllers/stats.controller';
import { authMiddleware, requireAdmin } from '../middleware/auth';

const router = express.Router();

router.get('/weeks', authMiddleware, requireAdmin, statsController.getAvailableWeeks);
router.get('/', authMiddleware, requireAdmin, statsController.getStats);

export default router;
