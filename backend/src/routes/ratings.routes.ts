import { Router } from 'express';
import { authMiddleware, requireAdmin } from '../middleware/auth';
import { getMyRatings, upsertRating, getAdminRatings } from '../controllers/ratings.controller';

const router = Router();

// User: get own ratings for a week
router.get('/my', authMiddleware, getMyRatings);

// User: create or update a rating
router.put('/', authMiddleware, upsertRating);

// Admin: aggregated ratings for a week
router.get('/admin', authMiddleware, requireAdmin, getAdminRatings);

export default router;
