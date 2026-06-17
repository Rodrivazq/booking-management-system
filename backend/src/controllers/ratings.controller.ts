import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { getNowUY } from '../utils/dates';

const VALID_RATINGS = ['liked', 'neutral', 'disliked'] as const;
const VALID_ITEM_TYPES = ['meal', 'dessert'] as const;
const DAYS_ES = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];

type Rating = typeof VALID_RATINGS[number];

// ─── GET /api/ratings/my?week=YYYY-MM-DD ─────────────────────────────────────
// Returns the current user's ratings for a given week.
export async function getMyRatings(req: Request, res: Response) {
    const userId = req.user?.id;
    const week = req.query.week as string;

    if (!userId) return res.status(401).json({ error: 'No autorizado' });
    if (!week || !/^\d{4}-\d{2}-\d{2}$/.test(week)) {
        return res.status(400).json({ error: 'Parámetro week requerido (YYYY-MM-DD)' });
    }

    try {
        const ratings = await prisma.dishRating.findMany({
            where: { userId, weekStart: week },
            select: { id: true, day: true, itemType: true, itemName: true, rating: true, updatedAt: true },
        });
        return res.json(ratings);
    } catch (e) {
        console.error('[getMyRatings]', e);
        return res.status(500).json({ error: 'Error al obtener calificaciones' });
    }
}

// ─── GET /api/ratings/pending ────────────────────────────────────────────────
// Devuelve los platos que el usuario YA comió (día servido) pero todavía no
// calificó, mirando las últimas WEEKS_LOOKBACK semanas. Es la base del panel
// "Calificaciones pendientes": no hay tope de tiempo para calificar, sólo se
// limita la ventana hacia atrás para no acumular indefinidamente.
const WEEKS_LOOKBACK = 8;

function mondayStringMinusDays(weekStart: string, days: number): string {
    const [y, m, d] = weekStart.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() - days);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export async function getPendingRatings(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'No autorizado' });

    try {
        const now = getNowUY();
        // Lunes operativo actual (en hora UY) para fijar la ventana de lookback.
        const todayMonday = (() => {
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(now);
            monday.setDate(diff);
            const pad = (n: number) => String(n).padStart(2, '0');
            return `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
        })();
        const cutoff = mondayStringMinusDays(todayMonday, WEEKS_LOOKBACK * 7);

        const [reservations, existingRatings] = await Promise.all([
            prisma.reservation.findMany({
                where: { userId, weekStart: { gte: cutoff } },
                select: { weekStart: true, selections: true },
            }),
            prisma.dishRating.findMany({
                where: { userId, weekStart: { gte: cutoff } },
                select: { weekStart: true, day: true, itemType: true, itemName: true },
            }),
        ]);

        const rated = new Set(
            existingRatings.map(r => `${r.weekStart}::${r.day}::${r.itemType}::${r.itemName}`)
        );

        type Pending = { weekStart: string; day: string; itemType: 'meal' | 'dessert'; itemName: string };
        const pending: Pending[] = [];

        for (const r of reservations) {
            let selections: Array<{ day: string; meal: string; dessert: string }> = [];
            try {
                selections = JSON.parse(r.selections);
            } catch {
                continue; // reserva con selections corruptas: la ignoramos
            }
            if (!Array.isArray(selections)) continue;

            for (const sel of selections) {
                const dayIndex = DAYS_ES.indexOf(sel.day);
                if (dayIndex === -1) continue;

                // Mismo criterio que upsertRating: servido desde las 00:00 del día.
                const [y, m, d] = r.weekStart.split('-').map(Number);
                const mealDate = new Date(y, m - 1, d + dayIndex);
                mealDate.setHours(0, 0, 0, 0);
                if (now < mealDate) continue; // todavía no servido

                for (const itemType of VALID_ITEM_TYPES) {
                    const itemName = itemType === 'meal' ? sel.meal : sel.dessert;
                    if (!itemName) continue;
                    const key = `${r.weekStart}::${sel.day}::${itemType}::${itemName}`;
                    if (rated.has(key)) continue;
                    pending.push({ weekStart: r.weekStart, day: sel.day, itemType, itemName });
                }
            }
        }

        // Orden: semana más reciente primero, luego por día de la semana.
        pending.sort((a, b) => {
            if (a.weekStart !== b.weekStart) return b.weekStart.localeCompare(a.weekStart);
            return DAYS_ES.indexOf(a.day) - DAYS_ES.indexOf(b.day);
        });

        return res.json(pending);
    } catch (e) {
        console.error('[getPendingRatings]', e);
        return res.status(500).json({ error: 'Error al obtener calificaciones pendientes' });
    }
}

// ─── PUT /api/ratings ─────────────────────────────────────────────────────────
// Upserts a rating. Validates the user actually reserved that dish and the day has passed.
export async function upsertRating(req: Request, res: Response) {
    const userId = req.user?.id;
    const { weekStart, day, itemType, itemName, rating } = req.body;

    if (!userId) return res.status(401).json({ error: 'No autorizado' });

    // — Basic input validation
    if (!weekStart || !day || !itemType || !itemName || !rating) {
        return res.status(400).json({ error: 'Faltan campos requeridos: weekStart, day, itemType, itemName, rating' });
    }
    if (!VALID_RATINGS.includes(rating as Rating)) {
        return res.status(400).json({ error: `rating debe ser uno de: ${VALID_RATINGS.join(', ')}` });
    }
    if (!VALID_ITEM_TYPES.includes(itemType)) {
        return res.status(400).json({ error: `itemType debe ser "meal" o "dessert"` });
    }
    if (!DAYS_ES.includes(day)) {
        return res.status(400).json({ error: `day inválido. Debe ser: ${DAYS_ES.join(', ')}` });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
        return res.status(400).json({ error: 'weekStart debe ser YYYY-MM-DD' });
    }

    try {
        // — Find the reservation for this user + week
        const reservation = await prisma.reservation.findUnique({
            where: { userId_weekStart: { userId, weekStart } },
        });

        if (!reservation) {
            return res.status(403).json({ error: 'No tienes una reserva para esta semana' });
        }

        // — Verify the dish was actually in the reservation
        let selections: Array<{ day: string; meal: string; dessert: string; bread?: boolean }>;
        try {
            selections = JSON.parse(reservation.selections);
        } catch {
            return res.status(500).json({ error: 'Error al procesar la reserva' });
        }

        const daySelection = selections.find(s => s.day === day);
        if (!daySelection) {
            return res.status(403).json({ error: `No reservaste el día ${day}` });
        }

        const reservedItem = itemType === 'meal' ? daySelection.meal : daySelection.dessert;
        if (!reservedItem || reservedItem !== itemName) {
            return res.status(403).json({
                error: `No reservaste "${itemName}" como ${itemType === 'meal' ? 'comida' : 'postre'} el ${day}`,
            });
        }

        // — Verify the day has passed (or is today)
        const dayIndex = DAYS_ES.indexOf(day); // 0 = lunes
        const [y, m, d_] = weekStart.split('-').map(Number);
        const mealDate = new Date(y, m - 1, d_ + dayIndex); // lunes + offset
        mealDate.setHours(0, 0, 0, 0); // Desde las 00:00 del día correspondiente
        
        const now = getNowUY();

        if (now < mealDate) {
            return res.status(403).json({
                error: `Solo puedes calificar platos a partir del día correspondiente (${day})`,
            });
        }

        // — Upsert
        const result = await prisma.dishRating.upsert({
            where: {
                userId_weekStart_day_itemType_itemName: { userId, weekStart, day, itemType, itemName },
            },
            update: { rating, updatedAt: new Date() },
            create: {
                userId,
                reservationId: reservation.id,
                weekStart,
                day,
                itemType,
                itemName,
                rating,
            },
        });

        return res.json(result);
    } catch (e) {
        console.error('[upsertRating]', e);
        return res.status(500).json({ error: 'Error al guardar calificación' });
    }
}

// ─── GET /api/ratings/admin/global ────────────────────────────────────────────
// Admin: aggregated ratings per dish across ALL weeks. Useful for the menu
// committee to identify dishes that consistently rank high or low regardless
// of when they were served. Aggregates by itemName + itemType (no day or week).
export async function getGlobalAdminRatings(_req: Request, res: Response) {
    try {
        const ratings = await prisma.dishRating.findMany({
            select: { itemName: true, itemType: true, rating: true },
        });

        const map = new Map<string, { itemName: string; itemType: string; liked: number; neutral: number; disliked: number }>();

        for (const r of ratings) {
            const key = `${r.itemType}::${r.itemName}`;
            if (!map.has(key)) {
                map.set(key, { itemName: r.itemName, itemType: r.itemType, liked: 0, neutral: 0, disliked: 0 });
            }
            const entry = map.get(key)!;
            if (r.rating === 'liked') entry.liked++;
            else if (r.rating === 'neutral') entry.neutral++;
            else if (r.rating === 'disliked') entry.disliked++;
        }

        const result = Array.from(map.values()).map(entry => {
            const total = entry.liked + entry.neutral + entry.disliked;
            return {
                ...entry,
                total,
                positivePercent: total > 0 ? Math.round((entry.liked / total) * 100) : 0,
            };
        });

        // Sort: meals first, then desserts; within each group sort by positivePercent desc.
        // Items without ratings (total=0) go to the end.
        result.sort((a, b) => {
            if (a.itemType !== b.itemType) return a.itemType === 'meal' ? -1 : 1;
            if (a.total === 0 && b.total > 0) return 1;
            if (b.total === 0 && a.total > 0) return -1;
            return b.positivePercent - a.positivePercent;
        });

        return res.json(result);
    } catch (e) {
        console.error('[getGlobalAdminRatings]', e);
        return res.status(500).json({ error: 'Error al obtener reporte global de calificaciones' });
    }
}

// ─── GET /api/ratings/admin?week=YYYY-MM-DD ───────────────────────────────────
// Admin: aggregated ratings per dish for a given week.
export async function getAdminRatings(req: Request, res: Response) {
    const week = req.query.week as string;

    if (!week || !/^\d{4}-\d{2}-\d{2}$/.test(week)) {
        return res.status(400).json({ error: 'Parámetro week requerido (YYYY-MM-DD)' });
    }

    try {
        const ratings = await prisma.dishRating.findMany({
            where: { weekStart: week },
            select: { itemName: true, itemType: true, rating: true, day: true },
        });

        // Group by itemName + itemType + day
        const map = new Map<string, { itemName: string; itemType: string; day: string; liked: number; neutral: number; disliked: number }>();

        for (const r of ratings) {
            const key = `${r.itemType}::${r.day}::${r.itemName}`;
            if (!map.has(key)) {
                map.set(key, { itemName: r.itemName, itemType: r.itemType, day: r.day, liked: 0, neutral: 0, disliked: 0 });
            }
            const entry = map.get(key)!;
            if (r.rating === 'liked') entry.liked++;
            else if (r.rating === 'neutral') entry.neutral++;
            else if (r.rating === 'disliked') entry.disliked++;
        }

        const result = Array.from(map.values()).map(entry => {
            const total = entry.liked + entry.neutral + entry.disliked;
            return {
                ...entry,
                total,
                positivePercent: total > 0 ? Math.round((entry.liked / total) * 100) : 0,
            };
        });

        // Sort: meals first, then desserts; within each group sort by positivePercent desc
        result.sort((a, b) => {
            if (a.itemType !== b.itemType) return a.itemType === 'meal' ? -1 : 1;
            return b.positivePercent - a.positivePercent;
        });

        return res.json(result);
    } catch (e) {
        console.error('[getAdminRatings]', e);
        return res.status(500).json({ error: 'Error al obtener reporte de calificaciones' });
    }
}
