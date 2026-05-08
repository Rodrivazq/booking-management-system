import express from 'express';
import * as authController from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth';
import validate from '../middleware/validate';
import { registerSchema, loginSchema, resendVerificationSchema } from '../schemas';
import { loginLimiter, forgotPasswordLimiter, resendVerificationLimiter, registerLimiter } from '../middleware/rateLimiter';

const router = express.Router();

router.post('/register', registerLimiter, validate(registerSchema), authController.register);
router.post('/login', loginLimiter, validate(loginSchema), authController.login);
router.get('/verify-email', authController.verifyEmail);
router.post('/resend-verification', resendVerificationLimiter, validate(resendVerificationSchema), authController.resendVerification);
router.post('/forgot-password', forgotPasswordLimiter, authController.forgotPassword);
router.post('/reset', authController.resetPassword);
router.put('/profile', authMiddleware, authController.updateProfile);
router.get('/me', authMiddleware, authController.me);

export default router;
