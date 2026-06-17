import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { DAY_KEYS, TIME_SLOTS } from '../utils/db';
import { getNextMonday, getCurrentMonday, getNowUY } from '../utils/dates';

// ---------------------------------------------------------------------------
// Helper: compute the reservation window status from DB settings.
// This is the single source of truth — used by the endpoint AND createReservation.
// ---------------------------------------------------------------------------
export async function computeWindowStatus() {
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    const deadlineDay = settings?.deadlineDay ?? 4;    // 0=Sun … 6=Sat, default Thu
    const deadlineTime = settings?.deadlineTime ?? '23:59';

    const now = getNowUY();
    const dayOfWeek = now.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const currentMonday = getCurrentMonday();
    const nextMonday = getNextMonday();

    let isClosed = false;
    if (!isWeekend) {
        const currentDayAdj = dayOfWeek === 0 ? 7 : dayOfWeek;
        const deadlineDayAdj = deadlineDay === 0 ? 7 : deadlineDay;

        if (currentDayAdj > deadlineDayAdj) {
            isClosed = true;
        } else if (currentDayAdj === deadlineDayAdj) {
            const [h, m] = deadlineTime.split(':').map(Number);
            const deadlineDate = new Date(now);
            deadlineDate.setHours(h, m, 0, 0);
            if (now > deadlineDate) isClosed = true;
        }
    }

    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const reason = isClosed
        ? `El período de reservas ha cerrado (cerró el ${dayNames[deadlineDay]} a las ${deadlineTime}).`
        : `Reservas abiertas hasta el ${dayNames[deadlineDay]} a las ${deadlineTime}.`;

    return {
        currentMonday,
        nextMonday,
        deadlineDay,
        deadlineTime,
        isReservationOpen: !isClosed,
        activeWeek: nextMonday,   // The week a new reservation should target
        reason,
    };
}

// ---------------------------------------------------------------------------
// GET /api/reservations/window  — authoritative open/closed status
// ---------------------------------------------------------------------------
export const getReservationWindow = async (req: Request, res: Response) => {
    try {
        const window = await computeWindowStatus();
        // ¿Este usuario tiene habilitada la semana en curso por un admin?
        let overrideWeek: string | null = null;
        if (req.user?.id) {
            const me = await prisma.user.findUnique({
                where: { id: req.user.id },
                select: { reservationOverrideWeek: true },
            });
            overrideWeek = me?.reservationOverrideWeek || null;
        }
        res.json({ ...window, overrideWeek });
    } catch (error) {
        console.error('getReservationWindow error:', error);
        res.status(500).json({ error: 'Error al obtener estado de reservas' });
    }
};

// ---------------------------------------------------------------------------
// POST /api/reservations
// ---------------------------------------------------------------------------
export const createReservation = async (req: Request, res: Response) => {
    const { selections, weekStart, timeSlot } = req.body || {};

    try {
        // 1. Get the authoritative window status
        const window = await computeWindowStatus();

        // ¿El usuario tiene habilitada la semana EN CURSO por un admin?
        const me = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { reservationOverrideWeek: true },
        });
        const hasOverride = !!me?.reservationOverrideWeek
            && me.reservationOverrideWeek === window.currentMonday
            && weekStart === window.currentMonday;

        // Semana objetivo: la habilitada (semana en curso) o la activa normal.
        let targetWeek: string;
        if (hasOverride) {
            targetWeek = window.currentMonday;
        } else {
            if (weekStart !== window.activeWeek) {
                return res.status(400).json({
                    error: `Las reservas solo se pueden hacer para la semana que inicia el ${window.activeWeek}.`
                });
            }
            if (!window.isReservationOpen) {
                return res.status(400).json({ error: window.reason });
            }
            targetWeek = window.activeWeek;
        }

        // 2. Validate payload shape
        if (!Array.isArray(selections) || selections.length !== DAY_KEYS.length) {
            return res.status(400).json({ error: 'Debe enviar una selección para cada día lunes-viernes.' });
        }
        if (!TIME_SLOTS.includes(timeSlot)) {
            return res.status(400).json({ error: 'Horario no válido.' });
        }

        // 3. Validate selections against the actual menu (de la semana objetivo)
        const nextMenu = await prisma.weeklyMenu.findUnique({ where: { weekStart: targetWeek } });
        if (!nextMenu) {
            return res.status(500).json({ error: `Menú no configurado para la semana ${targetWeek}.` });
        }
        const menuDays: any = JSON.parse(nextMenu.days as string);

        const normalizedSel: any[] = [];
        for (const day of DAY_KEYS) {
            const match = selections.find((s: any) => s.day === day);
            if (!match) {
                return res.status(400).json({ error: `Falta selección para ${day}.` });
            }
            const menuDay = menuDays[day];
            if (!menuDay) {
                return res.status(500).json({ error: `Menú no configurado para ${day}.` });
            }
            if (!menuDay.meals.includes(match.meal) || !menuDay.desserts.includes(match.dessert)) {
                return res.status(400).json({ error: `Opción inválida en ${day}.` });
            }
            normalizedSel.push({ day, meal: match.meal, dessert: match.dessert, bread: match.bread === true });
        }

        // 4. Upsert — DB @@unique([userId, weekStart]) guarantees atomicity against concurrent requests.
        await prisma.reservation.upsert({
            where: {
                userId_weekStart: {
                    userId: req.user.id,
                    weekStart: targetWeek,
                },
            },
            update: {
                selections: JSON.stringify(normalizedSel),
                timeSlot,
                updatedAt: new Date(),
            },
            create: {
                userId: req.user.id,
                weekStart: targetWeek,
                selections: JSON.stringify(normalizedSel),
                timeSlot,
            },
        });

        res.json({ ok: true, weekStart: targetWeek });
    } catch (error) {
        console.error('Create reservation error:', error);
        res.status(500).json({ error: 'Error al procesar reserva.' });
    }
};

// ---------------------------------------------------------------------------
// GET /api/reservations/me
// ---------------------------------------------------------------------------
export const getMyReservations = async (req: Request, res: Response) => {
    try {
        const myReservations = await prisma.reservation.findMany({
            where: { userId: req.user.id }
        });

        const formatted = myReservations.map(r => ({
            ...r,
            selections: JSON.parse(r.selections as string),
            week: r.weekStart
        }));

        res.json({ reservations: formatted });
    } catch (error) {
        console.error('Get my reservations error:', error);
        res.status(500).json({ error: 'Error al obtener reservas' });
    }
};

// ---------------------------------------------------------------------------
// GET /api/reservations/admin  (paginated, with search + week filter)
// ---------------------------------------------------------------------------
export const getAllReservations = async (req: Request, res: Response) => {
    try {
        const { page = '1', limit = '10', type = 'reservations', search = '', week = '' } = req.query;
        const pageNumber = parseInt(page as string, 10);
        const limitNumber = parseInt(limit as string, 10);
        const skipNumber = (pageNumber - 1) * limitNumber;

        const searchFilter = search ? {
            OR: [
                { name: { contains: search as string, mode: 'insensitive' as const } },
                { email: { contains: search as string, mode: 'insensitive' as const } },
                { funcNumber: { contains: search as string, mode: 'insensitive' as const } }
            ]
        } : {};

        if (type === 'users') {
            const [users, total] = await Promise.all([
                prisma.user.findMany({
                    where: searchFilter,
                    skip: skipNumber,
                    take: limitNumber,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        reservations: {
                            orderBy: { createdAt: 'desc' },
                            take: 1,
                            select: { weekStart: true }
                        }
                    }
                }),
                prisma.user.count({ where: searchFilter })
            ]);

            const formattedUsers = users.map(u => ({
                id: u.id,
                name: u.name,
                email: u.email,
                funcNumber: u.funcNumber,
                documentId: u.documentId,
                phoneNumber: u.phoneNumber,
                role: u.role,
                photoUrl: u.photoUrl,
                reservationOverrideWeek: u.reservationOverrideWeek,
                lastReservation: u.reservations[0]?.weekStart || null
            }));

            return res.json({
                users: formattedUsers,
                total,
                page: pageNumber,
                totalPages: Math.ceil(total / limitNumber)
            });
        }

        let reservationFilter: any = {};
        if (week) reservationFilter.weekStart = week as string;
        if (search) reservationFilter.user = searchFilter;

        const [reservations, total] = await Promise.all([
            prisma.reservation.findMany({
                where: reservationFilter,
                skip: skipNumber,
                take: limitNumber,
                orderBy: { createdAt: 'desc' },
                include: { user: true }
            }),
            prisma.reservation.count({ where: reservationFilter })
        ]);

        const formattedReservations = reservations.map(r => ({
            ...r,
            selections: JSON.parse(r.selections as string),
            week: r.weekStart,
            name: r.user ? r.user.name : 'Usuario Desconocido',
            email: r.user ? r.user.email : '',
            funcNumber: r.user ? r.user.funcNumber : ''
        }));

        res.json({
            reservations: formattedReservations,
            total,
            page: pageNumber,
            totalPages: Math.ceil(total / limitNumber)
        });
    } catch (error) {
        console.error('Get all reservations error:', error);
        res.status(500).json({ error: 'Error al obtener datos paginados' });
    }
};

// ---------------------------------------------------------------------------
// GET /api/reservations/admin/without-reservation?week=YYYY-MM-DD
// ---------------------------------------------------------------------------
export const getUsersWithoutReservation = async (req: Request, res: Response) => {
    try {
        const { week } = req.query;
        if (!week || typeof week !== 'string') {
            return res.status(400).json({ error: 'Parámetro week es requerido (YYYY-MM-DD)' });
        }

        const reservedUserIds = await prisma.reservation.findMany({
            where: { weekStart: week },
            select: { userId: true }
        });
        const reservedSet = new Set(reservedUserIds.map(r => r.userId));

        const usersWithout = await prisma.user.findMany({
            where: {
                id: { notIn: Array.from(reservedSet) }
            },
            select: {
                id: true,
                name: true,
                email: true,
                funcNumber: true,
                phoneNumber: true,
                photoUrl: true,
                role: true
            },
            orderBy: { name: 'asc' }
        });

        res.json({ users: usersWithout, week });
    } catch (error) {
        console.error('Get users without reservation error:', error);
        res.status(500).json({ error: 'Error al obtener usuarios sin reserva' });
    }
};
