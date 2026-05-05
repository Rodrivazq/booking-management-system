import express from 'express';
import * as qrController from '../controllers/qr.controller';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

// QR de acceso a la app: cualquier usuario autenticado puede generarlo para
// compartir el link público. El payload del QR es solo el FRONTEND_URL, sin
// información sensible. El botón "Compartir" del Layout aparece para todos los
// usuarios logueados, así que el endpoint debe ser accesible a 'user' también.
router.get('/', authMiddleware, qrController.generateQR);

export default router;
