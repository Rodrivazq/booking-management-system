import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prismaMock } from './prisma.mock';
import { createReservation, getUsersWithoutReservation, computeWindowStatus } from '../src/controllers/reservation.controller';
import { getNextMonday, getCurrentMonday } from '../src/utils/dates';

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

    // ── Override: alta a mitad de semana ──────────────────────────────────
    it('permite reservar la semana EN CURSO si el usuario fue habilitado', async () => {
        const currentMonday = getCurrentMonday();
        const { req, res } = makeReqRes({
            weekStart: currentMonday,
            timeSlot: '12:00',
            selections: validSelections(),
        });
        prismaMock.settings.findUnique.mockResolvedValue(openSettings() as any);
        prismaMock.user.findUnique.mockResolvedValue({ reservationOverrideWeek: currentMonday } as any);
        prismaMock.weeklyMenu.findUnique.mockResolvedValue(validMenu() as any);
        prismaMock.reservation.upsert.mockResolvedValue(savedReservation() as any);

        await createReservation(req, res);

        expect(prismaMock.reservation.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { userId_weekStart: { userId: 'user-123', weekStart: currentMonday } },
            })
        );
        expect(res.json).toHaveBeenCalledWith({ ok: true, weekStart: currentMonday });
    });

    it('rechaza la semana en curso si el usuario NO fue habilitado', async () => {
        const currentMonday = getCurrentMonday();
        const { req, res } = makeReqRes({
            weekStart: currentMonday,
            timeSlot: '12:00',
            selections: validSelections(),
        });
        prismaMock.settings.findUnique.mockResolvedValue(openSettings() as any);
        prismaMock.user.findUnique.mockResolvedValue({ reservationOverrideWeek: null } as any);

        await createReservation(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });
});

describe('getUsersWithoutReservation', () => {
    it('filters out already-reserved users and includes all roles without reservation', async () => {
        const { req, res } = {
            req: { query: { week: nextMonday } } as any,
            res: { json: vi.fn(), status: vi.fn().mockReturnThis() } as any,
        };

        prismaMock.reservation.findMany.mockResolvedValue([
            { userId: 'reserved-user' },
        ] as any);
        prismaMock.user.findMany.mockResolvedValue([
            { id: 'regular-user', name: 'Usuario', email: 'user@test.com', funcNumber: '1', phoneNumber: null, photoUrl: null, role: 'user' },
            { id: 'admin-user', name: 'Admin', email: 'admin@test.com', funcNumber: '2', phoneNumber: null, photoUrl: null, role: 'admin' },
            { id: 'superadmin-user', name: 'Super Admin', email: 'super@test.com', funcNumber: '3', phoneNumber: null, photoUrl: null, role: 'superadmin' },
        ] as any);

        await getUsersWithoutReservation(req, res);

        expect(prismaMock.user.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: { notIn: ['reserved-user'] } },
            })
        );
        expect(res.json).toHaveBeenCalledWith({
            users: expect.arrayContaining([
                expect.objectContaining({ id: 'regular-user' }),
                expect.objectContaining({ id: 'admin-user' }),
                expect.objectContaining({ id: 'superadmin-user' }),
            ]),
            week: nextMonday,
        });
    });
});

describe('computeWindowStatus', () => {
    const setFakeTimeUY = (uyIsoString: string) => {
        vi.setSystemTime(new Date(uyIsoString + '-03:00'));
    };

    beforeEach(() => {
        vi.useFakeTimers();
        // Mock default settings: deadline Thursday (4) at 23:59
        prismaMock.settings.findUnique.mockResolvedValue({
            id: 1,
            deadlineDay: 4,
            deadlineTime: '23:59',
        } as any);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('jueves antes de deadlineTime => isReservationOpen true', async () => {
        setFakeTimeUY('2026-04-30T12:00:00'); // Jueves 12:00
        const status = await computeWindowStatus();
        expect(status.isReservationOpen).toBe(true);
    });

    it('jueves después de deadlineTime => isReservationOpen false', async () => {
        // Mock deadline to 15:00 to test same-day closure
        prismaMock.settings.findUnique.mockResolvedValue({
            id: 1,
            deadlineDay: 4,
            deadlineTime: '15:00',
        } as any);
        setFakeTimeUY('2026-04-30T16:00:00'); // Jueves 16:00
        const status = await computeWindowStatus();
        expect(status.isReservationOpen).toBe(false);
    });

    it('viernes => isReservationOpen false', async () => {
        setFakeTimeUY('2026-05-01T12:00:00'); // Viernes
        const status = await computeWindowStatus();
        expect(status.isReservationOpen).toBe(false);
    });

    it('sábado/domingo => isReservationOpen true (semana inminente)', async () => {
        setFakeTimeUY('2026-05-02T12:00:00'); // Sábado
        const statusSat = await computeWindowStatus();
        expect(statusSat.isReservationOpen).toBe(true);

        setFakeTimeUY('2026-05-03T12:00:00'); // Domingo
        const statusSun = await computeWindowStatus();
        expect(statusSun.isReservationOpen).toBe(true);
    });
});
