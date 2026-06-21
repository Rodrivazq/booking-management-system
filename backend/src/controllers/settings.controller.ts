import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { validateImageUrl } from '../utils/validators';

const DEFAULT_SETTINGS = {
    companyName: 'Sistema de Reservas Corporativo',
    logoUrl: '',
    primaryColor: '#16a34a',
    secondaryColor: '#1e293b',
    deadlineDay: 4,       // Thursday by default
    deadlineTime: '23:59',
};

export const getSettings = async (req: Request, res: Response) => {
    try {
        let settings = await prisma.settings.findUnique({ where: { id: 1 } });
        
        if (!settings) {
            settings = await prisma.settings.create({
                data: DEFAULT_SETTINGS
            });
        }

        res.json(settings);
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ message: 'Error fetching settings' });
    }
};

export const updateSettings = async (req: Request, res: Response) => {
    try {
        const newSettings = req.body;

        if (newSettings.logoUrl !== undefined && !validateImageUrl(newSettings.logoUrl)) {
            return res.status(400).json({ message: 'URL de logo inválida o demasiado larga. No se permiten imágenes base64.' });
        }

        if (newSettings.loginBackgroundImage !== undefined && !validateImageUrl(newSettings.loginBackgroundImage)) {
            return res.status(400).json({ message: 'URL de imagen de fondo inválida o demasiado larga. No se permiten imágenes base64.' });
        }

        // Clamp del difuminado a rangos seguros (evita filtros CSS absurdos).
        const clampInt = (v: any, min: number, max: number) => Math.max(min, Math.min(max, Math.round(Number(v) || 0)));
        if (newSettings.loginBackgroundBlur !== undefined) {
            newSettings.loginBackgroundBlur = clampInt(newSettings.loginBackgroundBlur, 0, 20);
        }
        if (newSettings.loginBackgroundDim !== undefined) {
            newSettings.loginBackgroundDim = clampInt(newSettings.loginBackgroundDim, 0, 100);
        }

        const settings = await prisma.settings.upsert({
            where: { id: 1 },
            update: newSettings,
            create: { ...DEFAULT_SETTINGS, ...newSettings }
        });

        res.json({ ok: true, settings });
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ message: 'Error updating settings' });
    }
};
