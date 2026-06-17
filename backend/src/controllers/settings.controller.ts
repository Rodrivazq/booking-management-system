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

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

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
        const newSettings = { ...req.body };

        if (newSettings.logoUrl !== undefined && !validateImageUrl(newSettings.logoUrl)) {
            return res.status(400).json({ message: 'URL de logo inválida o demasiado larga. No se permiten imágenes base64.' });
        }

        const old = await prisma.settings.findUnique({ where: { id: 1 } });

        // ¿Cambió el cierre de reservas?
        const deadlineChanged = !!old && (
            (newSettings.deadlineDay !== undefined && Number(newSettings.deadlineDay) !== old.deadlineDay) ||
            (newSettings.deadlineTime !== undefined && newSettings.deadlineTime !== old.deadlineTime)
        );

        // ¿El admin publicó un aviso nuevo y no vacío (p. ej. un feriado)?
        const adminAnnouncement = typeof newSettings.announcementMessage === 'string'
            && newSettings.announcementMessage.trim() !== ''
            && newSettings.announcementMessage !== (old?.announcementMessage || '');

        const finalDay = newSettings.deadlineDay !== undefined ? Number(newSettings.deadlineDay) : (old?.deadlineDay ?? 4);
        const finalTime = newSettings.deadlineTime !== undefined ? newSettings.deadlineTime : (old?.deadlineTime ?? '23:59');

        // Si cambió el cierre y el admin no escribió un aviso propio, generamos
        // el cartel automáticamente para que todos los usuarios lo vean en la app.
        if (deadlineChanged && !adminAnnouncement) {
            newSettings.announcementMessage = `El cierre de reservas cambió: ahora cierra los ${DAY_NAMES[finalDay]} a las ${finalTime}. Acordate de reservar antes.`;
            newSettings.announcementType = 'warning';
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
