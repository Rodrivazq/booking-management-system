import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../utils/prisma';
import { DAY_KEYS, TIME_SLOTS } from '../utils/db'; // Still need constants

const getNextMonday = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = (8 - day) % 7 || 7;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + diff);
    nextMonday.setHours(0, 0, 0, 0);
    return nextMonday.toISOString().slice(0, 10);
};

export const createReservation = async (req: Request, res: Response) => {
    const { selections, weekStart, timeSlot } = req.body || {};
    const expectedWeek = getNextMonday();

    if (weekStart !== expectedWeek) return res.status(400).json({ error: `Las reservas solo se abren para la semana que inicia el ${expectedWeek}` });

    try {
        // Enforce deadline: Close reservations based on settings
        const settings = await prisma.settings.findUnique({ where: { id: 1 } });
        const deadlineDay = settings?.deadlineDay !== undefined ? settings.deadlineDay : 3; // Default Wednesday
        const deadlineTime = settings?.deadlineTime || '23:59';

        const now = new Date();
        const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

        let isClosed = false;
        const currentDayAdjusted = dayOfWeek === 0 ? 7 : dayOfWeek;
        const deadlineDayAdjusted = deadlineDay === 0 ? 7 : deadlineDay;

        if (currentDayAdjusted > deadlineDayAdjusted) {
            isClosed = true;
        } else if (currentDayAdjusted === deadlineDayAdjusted) {
            const [h, m] = deadlineTime.split(':').map(Number);
            const deadlineDate = new Date(now);
            deadlineDate.setHours(h, m, 0, 0);
            if (now > deadlineDate) {
                isClosed = true;
            }
        }

        if (isClosed) {
            const days = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
            return res.status(400).json({
                error: `El periodo de reservas ha cerrado (Cierra el ${days[deadlineDay]} a las ${deadlineTime}).`
            });
        }

        if (!Array.isArray(selections) || selections.length !== DAY_KEYS.length) return res.status(400).json({ error: 'Debe enviar una seleccion para cada dia lunes-viernes' });
        if (!TIME_SLOTS.includes(timeSlot)) return res.status(400).json({ error: 'Horario no valido' });

        const normalizedSel: any[] = [];
        
        // Fetch next week's menu to validate selections
        const nextMenu = await prisma.weeklyMenu.findUnique({ where: { weekStart: expectedWeek } });
        if (!nextMenu) {
            return res.status(500).json({ error: `Error interno: Menu no configurado para ${expectedWeek}` });
        }
        const menuDays: any = JSON.parse(nextMenu.days as string);

        for (const day of DAY_KEYS) {
            const match = selections.find((s: any) => s.day === day);
            if (!match) return res.status(400).json({ error: `Falta seleccion para ${day}` });

            const menuDay = menuDays[day];
            if (!menuDay) {
                return res.status(500).json({ error: `Error interno: Menu no configurado para ${day}` });
            }
            if (!menuDay.meals.includes(match.meal) || !menuDay.desserts.includes(match.dessert)) return res.status(400).json({ error: `Opcion invalida en ${day}` });

            normalizedSel.push({ day, meal: match.meal, dessert: match.dessert, bread: match.bread === true });
        }

        const existing = await prisma.reservation.findFirst({
            where: {
                userId: req.user.id,
                weekStart: expectedWeek
            }
        });

        if (existing) {
            await prisma.reservation.update({
                where: { id: existing.id },
                data: {
                    selections: JSON.stringify(normalizedSel),
                    timeSlot,
                    updatedAt: new Date()
                }
            });
        } else {
            await prisma.reservation.create({
                data: {
                    userId: req.user.id,
                    weekStart: expectedWeek,
                    selections: JSON.stringify(normalizedSel),
                    timeSlot
                }
            });
        }

        res.json({ ok: true, weekStart: expectedWeek });
    } catch (error) {
        console.error('Create reservation error:', error);
        res.status(500).json({ error: 'Error al procesar reserva' });
    }
};

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

export const getAllReservations = async (req: Request, res: Response) => {
    try {
        const reservations = await prisma.reservation.findMany({
            include: { user: true } // Include user details if needed, but we map manually below to match existing format
        });
        
        const users = await prisma.user.findMany({
            include: {
                reservations: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { weekStart: true }
                }
            }
        });

        const formattedReservations = reservations.map(r => ({
            ...r,
            selections: JSON.parse(r.selections as string),
            week: r.weekStart,
            name: r.user ? r.user.name : 'Usuario Desconocido',
            email: r.user ? r.user.email : '',
            funcNumber: r.user ? r.user.funcNumber : ''
        }));

        const formattedUsers = users.map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            funcNumber: u.funcNumber,
            documentId: u.documentId,
            phoneNumber: u.phoneNumber,
            role: u.role,
            photoUrl: u.photoUrl,
            lastReservation: u.reservations[0]?.weekStart || null
        }));

        res.json({
            reservations: formattedReservations,
            users: formattedUsers
        });
    } catch (error) {
        console.error('Get all reservations error:', error);
        res.status(500).json({ error: 'Error al obtener todas las reservas' });
    }
};
