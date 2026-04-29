import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { getNextMonday } from '../utils/dates';

export const getAvailableWeeks = async (req: Request, res: Response) => {
    try {
        const reservations = await prisma.reservation.findMany({
            select: { weekStart: true },
            distinct: ['weekStart']
        });

        let weeks = reservations.map(r => r.weekStart).sort().reverse();

        // Ensure the upcoming week is always in the list
        const nextMonday = getNextMonday();
        if (!weeks.includes(nextMonday)) {
            weeks.unshift(nextMonday);
        }

        weeks = [...new Set(weeks)];

        res.json({ weeks });
    } catch (error) {
        console.error('Get available weeks error:', error);
        res.status(500).json({ error: 'Error al obtener semanas' });
    }
};

export const getStats = async (req: Request, res: Response) => {
    const { week } = req.query;
    const targetWeek = (week as string) || getNextMonday();

    try {
        const reservations = await prisma.reservation.findMany({
            where: { weekStart: targetWeek },
            include: { user: true }
        });

        // Structure: { [day]: { [timeSlot]: { meals: {}, desserts: {}, bread: 0, total: 0 } } }
        const stats: any = {};

        reservations.forEach(r => {
            const timeSlot: string = r.timeSlot as string;
            let selections: any[] = [];
            try {
                selections = JSON.parse(r.selections as string);
            } catch (e) {
                console.warn('Error parsing selections for reservation', r.id);
            }

            if (Array.isArray(selections)) {
                selections.forEach(sel => {
                    const day = sel.day;
                    if (!stats[day]) stats[day] = {};
                    if (!stats[day][timeSlot]) {
                        stats[day][timeSlot] = { meals: {}, desserts: {}, bread: 0, total: 0 };
                    }

                    const slotStats = stats[day][timeSlot];
                    slotStats.total += 1;

                    if (sel.meal) {
                        slotStats.meals[sel.meal] = (slotStats.meals[sel.meal] || 0) + 1;
                    }
                    if (sel.dessert) {
                        slotStats.desserts[sel.dessert] = (slotStats.desserts[sel.dessert] || 0) + 1;
                    }
                    if (sel.bread) {
                        slotStats.bread += 1;
                    }
                });
            }
        });

        res.json({ stats, week: targetWeek, totalReservations: reservations.length });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
};
