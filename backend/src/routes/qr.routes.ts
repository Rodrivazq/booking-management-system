import express from 'express';
import * as qrController from '../controllers/qr.controller';

const router = express.Router();

router.get('/', qrController.generateQR);

export default router;
