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

export const getStats = async (req: Request, res: Response) => {
    console.log('ReportsController: Request received', req.query);
    try {
        const { week } = req.query;
        const targetWeek = (week as string) || getNextMonday();
        console.log('ReportsController: Target week:', targetWeek);

        // 1. Fetch Data
        const [reservations, users, weeklyMenu] = await Promise.all([
            prisma.reservation.findMany({
                where: { weekStart: targetWeek },
                include: { user: true }
            }),
            prisma.user.findMany(),
            prisma.weeklyMenu.findUnique({
                where: { weekStart: targetWeek }
            })
        ]);


        


        // 2. Process Data
        const dishCounts: any = {};
        const reservationsByDay: any = {};
        const breadStats = { withBread: 0, withoutBread: 0 };
        const timeSlotStats: any = {
            '11:45': 0,
            '12:30': 0,
            '13:15': 0,
            'Noche': 0
        };
        const detailedReservations: any[] = [];
        
        const DAY_OFFSETS: any = { 'lunes': 0, 'martes': 1, 'miercoles': 2, 'jueves': 3, 'viernes': 4 };

        try {
            const [year, month, day] = targetWeek.split('-').map(Number);
            Object.entries(DAY_OFFSETS).forEach(([dayName, offset]) => {
                const d = new Date(year, month - 1, day + (offset as number));
                const dateStr = d.toISOString().split('T')[0];
                reservationsByDay[dateStr] = { total: 0, withBread: 0, withoutBread: 0, dayName };
            });
        } catch (e) {
            console.warn('Error pre-initializing days', e);
        }

        reservations.forEach(r => {
            let selections: any[] = [];
            try {
                selections = JSON.parse(r.selections as string);
            } catch (e) {
                console.warn('Error parsing selections for reservation', r.id);
            }

            // Count Time Slots
            if (r.timeSlot) {
                timeSlotStats[r.timeSlot] = (timeSlotStats[r.timeSlot] || 0) + 1;
            }

            if (Array.isArray(selections)) {
                selections.forEach(sel => {
                    // Count dishes
                    if (sel.meal) {
                        dishCounts[sel.meal] = (dishCounts[sel.meal] || 0) + 1;

                        // Count Bread
                        if (sel.bread) {
                            breadStats.withBread++;
                        } else {
                            breadStats.withoutBread++;
                        }

                        // Count daily reservations
                        if (r.weekStart && sel.day && DAY_OFFSETS.hasOwnProperty(sel.day)) {
                            try {
                                const [year, month, day] = r.weekStart.split('-').map(Number);
                                const offset = DAY_OFFSETS[sel.day];
                                const d = new Date(year, month - 1, day + offset);
                                const dateStr = d.toISOString().split('T')[0];
                                
                                if (!reservationsByDay[dateStr]) {
                                    reservationsByDay[dateStr] = { total: 0, withBread: 0, withoutBread: 0 };
                                }
                                reservationsByDay[dateStr].total += 1;
                                if (sel.bread) reservationsByDay[dateStr].withBread += 1;
                                else reservationsByDay[dateStr].withoutBread += 1;

                                // Add to detailed list
                                detailedReservations.push({
                                    date: dateStr,
                                    day: sel.day,
                                    userName: r.user ? r.user.name : 'Desconocido',
                                    funcNumber: r.user ? r.user.funcNumber : '',
                                    meal: sel.meal,
                                    dessert: sel.dessert,
                                    bread: sel.bread ? 'Sí' : 'No',
                                    timeSlot: r.timeSlot
                                });

                            } catch (e) {
                                console.warn('Error calculating date for reservation', r.id, e);
                            }
                        }
                    }
                });
            }
        });

        // 3. Format Response
        const popularDishes = Object.entries(dishCounts)
            .map(([name, count]: [string, any]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        const dailyStats = Object.entries(reservationsByDay)
            .map(([date, counts]: [string, any]) => ({ date, ...counts }))
            .sort((a, b) => a.date.localeCompare(b.date));

        const totalUsers = users.length;
        const activeUsers = new Set(reservations.map(r => r.userId)).size;

        const responseData = {
            popularDishes,
            dailyStats,
            userStats: {
                totalUsers,
                activeUsers
            },
            breadStats,
            timeSlotStats: Object.entries(timeSlotStats).map(([time, count]: [string, any]) => ({ time, count })).sort((a, b) => a.time.localeCompare(b.time)),
            detailedReservations
        };

        console.log('ReportsController: Sending response');
        res.json(responseData);

    } catch (error: any) {
        console.error('ReportsController: Error getting report stats:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas: ' + error.message });
    }
};
