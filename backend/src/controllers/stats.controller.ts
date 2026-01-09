import { Request, Response } from 'express';
import prisma from '../utils/prisma';

const getNextMonday = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = (8 - day) % 7 || 7;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + diff);
    nextMonday.setHours(0, 0, 0, 0);
    return nextMonday.toISOString().slice(0, 10);
};

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
        
        // Remove duplicates again just in case
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
    const fs = require('fs');
    fs.appendFileSync('stats_debug.log', `\n[Stats] Request week: ${week}, Target: ${targetWeek}`);

    try {
        const reservations = await prisma.reservation.findMany({
            where: { weekStart: targetWeek },
            include: { user: true }
        });
        fs.appendFileSync('stats_debug.log', `\n[Stats] Week: ${targetWeek}, Res Count: ${reservations.length}`);


        // Structure: { [day]: { [timeSlot]: { meals: { [mealName]: count }, desserts: { [dessertName]: count }, bread: count } } }
        const stats: any = {};

        reservations.forEach(r => {
            const timeSlot: string = r.timeSlot as string;
            let selections: any[] = [];
            try {
                selections = JSON.parse(r.selections as string);
            } catch (e) {
                console.warn('Error parsing selections', r.id);
            }

            if (Array.isArray(selections)) {
                selections.forEach(sel => {
                    const day = sel.day;
                    if (!stats[day]) stats[day] = {};
                    if (!stats[day][timeSlot]) stats[day][timeSlot] = { meals: {}, desserts: {}, bread: 0 };

                    const slotStats = stats[day][timeSlot];

                    // Count meals
                    if (sel.meal) {
                        slotStats.meals[sel.meal] = (slotStats.meals[sel.meal] || 0) + 1;
                    }

                    // Count desserts
                    if (sel.dessert) {
                        slotStats.desserts[sel.dessert] = (slotStats.desserts[sel.dessert] || 0) + 1;
                    }

                    // Count bread
                    if (sel.bread) {
                        slotStats.bread += 1;
                    }
                });
            }
        });

        res.json({ stats, week: targetWeek });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
};
