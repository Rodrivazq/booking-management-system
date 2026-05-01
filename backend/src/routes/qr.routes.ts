import express from 'express';
import * as qrController from '../controllers/qr.controller';
import { authMiddleware, requireAdmin } from '../middleware/auth';

const router = express.Router();

router.get('/', authMiddleware, requireAdmin, qrController.generateQR);

export default router;
