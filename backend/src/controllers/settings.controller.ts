import { Request, Response } from 'express';
import prisma from '../utils/prisma';

const DEFAULT_SETTINGS = {
    companyName: 'Sistema de Reservas Corporativo',
    logoUrl: '',
    primaryColor: '#16a34a',
    secondaryColor: '#1e293b',
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

        // Basic validation could go here

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
