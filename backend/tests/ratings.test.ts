import { describe, it, expect, vi } from 'vitest';
import { prismaMock } from './prisma.mock';
import { getMyRatings, upsertRating, getAdminRatings } from '../src/controllers/ratings.controller';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WEEK = '2025-01-06'; // lunes
const makeRes = () => ({ json: vi.fn(), status: vi.fn().mockReturnThis() } as any);

const fakeReservation = {
    id: 'res-1',
    userId: 'usr-1',
    weekStart: WEEK,
    timeSlot: '12:00',
    createdAt: new Date(),
    updatedAt: new Date(),
    selections: JSON.stringify([
        { day: 'lunes', meal: 'Milanesa', dessert: 'Flan', bread: true },
        { day: 'martes', meal: 'Pollo', dessert: 'Fruta', bread: false },
    ]),
};

const fakeRating = {
    id: 'rat-1',
    userId: 'usr-1',
    reservationId: 'res-1',
    weekStart: WEEK,
    day: 'lunes',
    itemType: 'meal',
    itemName: 'Milanesa',
    rating: 'liked',
    createdAt: new Date('2025-01-06T23:00:00Z'),
    updatedAt: new Date('2025-01-06T23:00:00Z'),
};

// ─── GET /my ─────────────────────────────────────────────────────────────────

describe('getMyRatings', () => {
    it('returns ratings for the user and week', async () => {
        const req = { user: { id: 'usr-1' }, query: { week: WEEK } } as any;
        const res = makeRes();

        prismaMock.dishRating.findMany.mockResolvedValue([fakeRating as any]);

        await getMyRatings(req, res);

        expect(prismaMock.dishRating.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { userId: 'usr-1', weekStart: WEEK } })
        );
        expect(res.json).toHaveBeenCalledWith([fakeRating]);
    });

    it('returns 400 if week is missing', async () => {
        const req = { user: { id: 'usr-1' }, query: {} } as any;
        const res = makeRes();

        await getMyRatings(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });
});

// ─── PUT / ───────────────────────────────────────────────────────────────────

describe('upsertRating', () => {
    it('saves a valid rating for a reserved dish', async () => {
        // lunes already passed (fakeRating date is in the past relative to 2025)
        const req = {
            user: { id: 'usr-1' },
            body: { weekStart: WEEK, day: 'lunes', itemType: 'meal', itemName: 'Milanesa', rating: 'liked' },
        } as any;
        const res = makeRes();

        prismaMock.reservation.findUnique.mockResolvedValue(fakeReservation as any);
        prismaMock.dishRating.upsert.mockResolvedValue(fakeRating as any);

        await upsertRating(req, res);

        expect(prismaMock.dishRating.upsert).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(fakeRating);
    });

    it('returns 403 if user has no reservation for that week', async () => {
        const req = {
            user: { id: 'usr-2' },
            body: { weekStart: WEEK, day: 'lunes', itemType: 'meal', itemName: 'Milanesa', rating: 'liked' },
        } as any;
        const res = makeRes();

        prismaMock.reservation.findUnique.mockResolvedValue(null);

        await upsertRating(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ error: expect.stringMatching(/reserva/) })
        );
    });

    it('returns 403 if the dish was not in the reservation', async () => {
        const req = {
            user: { id: 'usr-1' },
            body: { weekStart: WEEK, day: 'lunes', itemType: 'meal', itemName: 'Asado', rating: 'liked' },
        } as any;
        const res = makeRes();

        prismaMock.reservation.findUnique.mockResolvedValue(fakeReservation as any);

        await upsertRating(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ error: expect.stringMatching(/No reservaste/) })
        );
    });

    it('returns 400 for invalid rating value', async () => {
        const req = {
            user: { id: 'usr-1' },
            body: { weekStart: WEEK, day: 'lunes', itemType: 'meal', itemName: 'Milanesa', rating: 'excellent' },
        } as any;
        const res = makeRes();

        await upsertRating(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 400 for invalid itemType', async () => {
        const req = {
            user: { id: 'usr-1' },
            body: { weekStart: WEEK, day: 'lunes', itemType: 'bread', itemName: 'Pan', rating: 'liked' },
        } as any;
        const res = makeRes();

        await upsertRating(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 403 for a future day (not yet passed)', async () => {
        // Use a week far in the future
        const futureWeek = '2099-01-06';
        const req = {
            user: { id: 'usr-1' },
            body: { weekStart: futureWeek, day: 'lunes', itemType: 'meal', itemName: 'Milanesa', rating: 'liked' },
        } as any;
        const res = makeRes();

        const futureReservation = {
            ...fakeReservation,
            weekStart: futureWeek,
        };
        prismaMock.reservation.findUnique.mockResolvedValue(futureReservation as any);

        await upsertRating(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ error: expect.stringMatching(/después del día/) })
        );
    });
});

// ─── GET /admin ───────────────────────────────────────────────────────────────

describe('getAdminRatings', () => {
    it('returns aggregated data for admins', async () => {
        const req = { user: { id: 'adm-1', role: 'admin' }, query: { week: WEEK } } as any;
        const res = makeRes();

        prismaMock.dishRating.findMany.mockResolvedValue([
            { itemName: 'Milanesa', itemType: 'meal', rating: 'liked', day: 'lunes' } as any,
            { itemName: 'Milanesa', itemType: 'meal', rating: 'liked', day: 'lunes' } as any,
            { itemName: 'Milanesa', itemType: 'meal', rating: 'disliked', day: 'lunes' } as any,
        ]);

        await getAdminRatings(req, res);

        expect(res.json).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({
                    itemName: 'Milanesa',
                    liked: 2,
                    disliked: 1,
                    total: 3,
                    positivePercent: 67,
                }),
            ])
        );
    });

    it('returns 400 if week param is missing', async () => {
        const req = { user: { id: 'adm-1', role: 'admin' }, query: {} } as any;
        const res = makeRes();

        await getAdminRatings(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });
});
