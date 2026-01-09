import express from 'express';
import { getStats } from '../controllers/reportsController';
import { authMiddleware, requireAdmin } from '../middleware/auth';

const router = express.Router();

router.get('/stats', authMiddleware, requireAdmin, getStats);

export default router;
