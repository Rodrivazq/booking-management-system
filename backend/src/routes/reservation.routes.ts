import express from 'express';
import * as reservationController from '../controllers/reservation.controller';
import { authMiddleware, requireAdmin } from '../middleware/auth';
import validate from '../middleware/validate';
import { reservationSchema } from '../schemas';

const router = express.Router();

router.post('/', authMiddleware, validate(reservationSchema), reservationController.createReservation);
router.get('/me', authMiddleware, reservationController.getMyReservations);
router.get('/admin', authMiddleware, requireAdmin, reservationController.getAllReservations);

export default router;
