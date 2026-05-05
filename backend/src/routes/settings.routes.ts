import express from 'express';
import * as settingsController from '../controllers/settings.controller';
import { authMiddleware, requireSuperAdmin } from '../middleware/auth';
import validate from '../middleware/validate';
import { updateSettingsSchema } from '../schemas';

const router = express.Router();

// Public access to read settings (needed for login page before auth)
router.get('/', settingsController.getSettings);

// Only Super Admin can update settings
router.put('/', authMiddleware, requireSuperAdmin, validate(updateSettingsSchema), settingsController.updateSettings);

export default router;
