import { Router } from 'express';
import { authMiddleware, requireAdmin } from '../middleware/auth';
import { getMyRatings, upsertRating, getAdminRatings, getGlobalAdminRatings } from '../controllers/ratings.controller';

const router = Router();

// User: get own ratings for a week
router.get('/my', authMiddleware, getMyRatings);

// User: create or update a rating
router.put('/', authMiddleware, upsertRating);

// Admin: aggregated ratings across ALL weeks (must be declared before /admin
// to avoid clashing with the dynamic week query param)
router.get('/admin/global', authMiddleware, requireAdmin, getGlobalAdminRatings);

// Admin: aggregated ratings for a single week
router.get('/admin', authMiddleware, requireAdmin, getAdminRatings);

export default router;
