import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prismaMock } from './prisma.mock';
import { createReservation } from '../src/controllers/reservation.controller';
import { getNextMonday } from '../src/utils/dates';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const nextMonday = getNextMonday();

/** Minimal valid settings object (reservations OPEN — deadline far in the future) */
const openSettings = () => ({
    id: 1,
    deadlineDay: 6,           // Saturday → always after Mon-Fri
    deadlineTime: '23:59',
    companyName: 'Test',
    logoUrl: null,
    primaryColor: null,
    secondaryColor: null,
    secondaryColor2: null,
    supportEmail: null,
    supportPhone: null,
    supportWhatsApp: null,
    welcomeTitle: null,
    welcomeMessage: null,
    loginBackgroundImage: null,
    maintenanceMode: false,
    announcementMessage: null,
    announcementType: null,
});

/** Minimal valid menu for nextMonday */
const validMenu = () => ({
    id: 'menu-1',
    weekStart: nextMonday,
    breadAvailable: true,
    days: JSON.stringify({
        lunes:     { meals: ['Meal A'], desserts: ['Dessert A'] },
        martes:    { meals: ['Meal B'], desserts: ['Dessert B'] },
        miercoles: { meals: ['Meal A'], desserts: ['Dessert A'] },
        jueves:    { meals: ['Meal B'], desserts: ['Dessert B'] },
        viernes:   { meals: ['Meal A'], desserts: ['Dessert A'] },
    }),
    createdAt: new Date(),
    updatedAt: new Date(),
});

/** Five valid day selections */
const validSelections = () => [
    { day: 'lunes',     meal: 'Meal A', dessert: 'Dessert A', bread: true  },
    { day: 'martes',    meal: 'Meal B', dessert: 'Dessert B', bread: false },
    { day: 'miercoles', meal: 'Meal A', dessert: 'Dessert A', bread: false },
    { day: 'jueves',    meal: 'Meal B', dessert: 'Dessert B', bread: true  },
    { day: 'viernes',   meal: 'Meal A', dessert: 'Dessert A', bread: false },
];

/** Build a minimal Express req/res pair */
const makeReqRes = (body: object) => ({
    req: { user: { id: 'user-123' }, body } as any,
    res: { json: vi.fn(), status: vi.fn().mockReturnThis() } as any,
});

const savedReservation = () => ({
    id: 'res-456',
    userId: 'user-123',
    weekStart: nextMonday,
    timeSlot: '12:00',
    selections: JSON.stringify(validSelections()),
    createdAt: new Date(),
    updatedAt: new Date(),
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createReservation', () => {
    beforeEach(() => {
        vi.useRealTimers();
    });

    // ── 1. Happy path: first reservation ──────────────────────────────────
    it('creates a new reservation when none exists', async () => {
        const { req, res } = makeReqRes({
            weekStart: nextMonday,
            timeSlot: '12:00',
            selections: validSelections(),
        });

        prismaMock.settings.findUnique.mockResolvedValue(openSettings() as any);
        prismaMock.weeklyMenu.findUnique.mockResolvedValue(validMenu() as any);
        prismaMock.reservation.upsert.mockResolvedValue(savedReservation() as any);

        await createReservation(req, res);

        expect(prismaMock.reservation.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { userId_weekStart: { userId: 'user-123', weekStart: nextMonday } },
            })
        );
        expect(res.json).toHaveBeenCalledWith({ ok: true, weekStart: nextMonday });
    });

    // ── 2. Upsert on second reservation (update path) ─────────────────────
    it('updates existing reservation when called again for the same week', async () => {
        const { req, res } = makeReqRes({
            weekStart: nextMonday,
            timeSlot: '13:00',
            selections: validSelections(),
        });

        prismaMock.settings.findUnique.mockResolvedValue(openSettings() as any);
        prismaMock.weeklyMenu.findUnique.mockResolvedValue(validMenu() as any);
        prismaMock.reservation.upsert.mockResolvedValue({ ...savedReservation(), timeSlot: '13:00' } as any);

        await createReservation(req, res);

        expect(prismaMock.reservation.upsert).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({ ok: true, weekStart: nextMonday });
    });

    // ── 3. Reject wrong week ──────────────────────────────────────────────
    it('rejects a reservation for the wrong weekStart', async () => {
        const { req, res } = makeReqRes({
            weekStart: '2020-01-06',   // clearly wrong
            timeSlot: '12:00',
            selections: validSelections(),
        });

        prismaMock.settings.findUnique.mockResolvedValue(openSettings() as any);
        // weeklyMenu not needed — blocked before we get there

        await createReservation(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ error: expect.stringContaining('solo se pueden hacer para la semana') })
        );
    });

    // ── 4. Reject when deadline has passed ───────────────────────────────
    it('rejects reservation when the deadline has already passed', async () => {
        vi.useFakeTimers();
        const tuesday = new Date();
        const daysUntilTuesday = (2 - tuesday.getDay() + 7) % 7 || 7;
        tuesday.setDate(tuesday.getDate() + daysUntilTuesday);
        vi.setSystemTime(tuesday);

        const closedWeek = getNextMonday();
        const { req, res } = makeReqRes({
            weekStart: closedWeek,
            timeSlot: '12:00',
            selections: validSelections(),
        });

        // deadlineDay = 1 (Monday) at 00:01 → always in the past during a normal weekday run
        prismaMock.settings.findUnique.mockResolvedValue({
            ...openSettings(),
            deadlineDay: 1,
            deadlineTime: '00:01',
        } as any);

        await createReservation(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ error: expect.stringContaining('ha cerrado') })
        );

        vi.useRealTimers();
    });

    // ── 5. Reject invalid meal selection ─────────────────────────────────
    it('rejects a reservation with an invalid meal option', async () => {
        const badSelections = validSelections();
        badSelections[0] = { day: 'lunes', meal: 'INVALID_MEAL', dessert: 'Dessert A', bread: false };

        const { req, res } = makeReqRes({
            weekStart: nextMonday,
            timeSlot: '12:00',
            selections: badSelections,
        });

        prismaMock.settings.findUnique.mockResolvedValue(openSettings() as any);
        prismaMock.weeklyMenu.findUnique.mockResolvedValue(validMenu() as any);

        await createReservation(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ error: expect.stringContaining('Opción inválida en lunes') })
        );
    });

    // ── 6. Reject missing selections (only 4 days) ───────────────────────
    it('rejects when fewer than 5 day selections are provided', async () => {
        const { req, res } = makeReqRes({
            weekStart: nextMonday,
            timeSlot: '12:00',
            selections: validSelections().slice(0, 4),   // 4 instead of 5
        });

        prismaMock.settings.findUnique.mockResolvedValue(openSettings() as any);

        await createReservation(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ error: expect.stringContaining('selección para cada día') })
        );
    });
});
