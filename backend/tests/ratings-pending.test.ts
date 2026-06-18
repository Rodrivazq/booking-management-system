import { describe, it, expect, vi } from 'vitest';
import { prismaMock } from './prisma.mock';
import { getPendingRatings, getUserRatingsAdmin } from '../src/controllers/ratings.controller';

// Semanas fijas para que el test sea determinístico sin mockear el reloj:
// PAST_WEEK ya ocurrió por completo; FUTURE_WEEK aún no se sirvió.
const PAST_WEEK = '2020-01-06';   // lunes
const FUTURE_WEEK = '2999-01-04'; // lunes lejano

const makeReqRes = () => ({
    req: { user: { id: 'user-123' } } as any,
    res: { json: vi.fn(), status: vi.fn().mockReturnThis() } as any,
});

describe('getPendingRatings', () => {
    it('lista platos ya servidos sin calificar y excluye los calificados', async () => {
        const { req, res } = makeReqRes();
        prismaMock.reservation.findMany.mockResolvedValue([
            {
                weekStart: PAST_WEEK,
                selections: JSON.stringify([
                    { day: 'lunes', meal: 'Milanesa', dessert: 'Flan' },
                    { day: 'martes', meal: 'Pizza', dessert: 'Helado' },
                ]),
            },
        ] as any);
        prismaMock.dishRating.findMany.mockResolvedValue([
            { weekStart: PAST_WEEK, day: 'lunes', itemType: 'meal', itemName: 'Milanesa' },
        ] as any);

        await getPendingRatings(req, res);

        const data = res.json.mock.calls[0][0];
        // 4 ítems posibles (2 días × comida+postre) − 1 ya calificado = 3 pendientes
        expect(data).toHaveLength(3);
        expect(data.find((p: any) => p.itemName === 'Milanesa')).toBeUndefined();
        expect(data.find((p: any) => p.itemType === 'dessert' && p.itemName === 'Flan')).toBeTruthy();
        expect(data.find((p: any) => p.itemName === 'Pizza')).toBeTruthy();
        expect(data.find((p: any) => p.itemName === 'Helado')).toBeTruthy();
    });

    it('excluye días anteriores a la creación de la reserva (alta a mitad de semana)', async () => {
        const { req, res } = makeReqRes();
        prismaMock.reservation.findMany.mockResolvedValue([
            {
                weekStart: PAST_WEEK,
                createdAt: new Date('2021-01-01T00:00:00Z'), // mucho después de esa semana
                selections: JSON.stringify([{ day: 'lunes', meal: 'Milanesa', dessert: 'Flan' }]),
            },
        ] as any);
        prismaMock.dishRating.findMany.mockResolvedValue([] as any);

        await getPendingRatings(req, res);

        // La reserva se creó después: ese día no se pudo comer → nada calificable.
        expect(res.json).toHaveBeenCalledWith([]);
    });

    it('no incluye días aún no servidos (semana futura)', async () => {
        const { req, res } = makeReqRes();
        prismaMock.reservation.findMany.mockResolvedValue([
            {
                weekStart: FUTURE_WEEK,
                selections: JSON.stringify([{ day: 'lunes', meal: 'Tarta', dessert: 'Fruta' }]),
            },
        ] as any);
        prismaMock.dishRating.findMany.mockResolvedValue([] as any);

        await getPendingRatings(req, res);

        expect(res.json).toHaveBeenCalledWith([]);
    });

    it('responde 401 si no hay usuario autenticado', async () => {
        const res = { json: vi.fn(), status: vi.fn().mockReturnThis() } as any;
        await getPendingRatings({} as any, res);
        expect(res.status).toHaveBeenCalledWith(401);
    });

    it('ignora reservas con selections corruptas sin romper', async () => {
        const { req, res } = makeReqRes();
        prismaMock.reservation.findMany.mockResolvedValue([
            { weekStart: PAST_WEEK, selections: 'no-es-json' },
        ] as any);
        prismaMock.dishRating.findMany.mockResolvedValue([] as any);

        await getPendingRatings(req, res);

        expect(res.json).toHaveBeenCalledWith([]);
    });
});

describe('getUserRatingsAdmin', () => {
    it('agrega satisfacción, favoritos y platos no gustados', async () => {
        const res = { json: vi.fn(), status: vi.fn().mockReturnThis() } as any;
        const req = { params: { userId: 'u1' } } as any;
        prismaMock.dishRating.findMany.mockResolvedValue([
            { itemName: 'Milanesa', itemType: 'meal', rating: 'liked', day: 'lunes', weekStart: '2020-01-06', updatedAt: new Date() },
            { itemName: 'Milanesa', itemType: 'meal', rating: 'liked', day: 'lunes', weekStart: '2020-01-13', updatedAt: new Date() },
            { itemName: 'Pescado', itemType: 'meal', rating: 'disliked', day: 'martes', weekStart: '2020-01-06', updatedAt: new Date() },
            { itemName: 'Flan', itemType: 'dessert', rating: 'neutral', day: 'lunes', weekStart: '2020-01-06', updatedAt: new Date() },
        ] as any);

        await getUserRatingsAdmin(req, res);

        const data = res.json.mock.calls[0][0];
        expect(data.total).toBe(4);
        expect(data.liked).toBe(2);
        expect(data.satisfactionPercent).toBe(50);
        expect(data.favorites[0].itemName).toBe('Milanesa');
        expect(data.dislikedDishes[0].itemName).toBe('Pescado');
    });

    it('responde 400 sin userId', async () => {
        const res = { json: vi.fn(), status: vi.fn().mockReturnThis() } as any;
        await getUserRatingsAdmin({ params: {} } as any, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });
});
