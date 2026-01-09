import express from 'express';
import * as authController from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth';
import validate from '../middleware/validate';
import { registerSchema, loginSchema } from '../schemas';
import { loginLimiter } from '../middleware/rateLimiter';

const router = express.Router();

router.post('/register', validate(registerSchema), authController.register);
router.post('/login', loginLimiter, validate(loginSchema), authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset', authController.resetPassword);
router.put('/profile', authMiddleware, authController.updateProfile);
router.get('/me', authMiddleware, authController.me);

export default router;
