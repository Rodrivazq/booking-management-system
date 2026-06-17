import { describe, it, expect, vi } from 'vitest';
import { prismaMock } from './prisma.mock';
import { updateMenu, getMenuCatalog } from '../src/controllers/menu.controller';

describe('Menu Controller Validations', () => {
    it('should return error if invalid type is provided', async () => {
        const req = { body: { type: 'invalid_type', days: {} } } as any;
        const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

        await updateMenu(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringMatching(/Tipo de menu invalido/) }));
    });

    it('should return error if day is missing meals or desserts', async () => {
        const req = { 
            body: { 
                type: 'current', 
                days: {
                    lunes: { meals: [], desserts: ['Fruta'] }
                } 
            } 
        } as any;
        const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

        prismaMock.weeklyMenu.findUnique.mockResolvedValue({
            weekStart: '2023-01-01',
            days: JSON.stringify({}),
            breadAvailable: true
        } as any);

        await updateMenu(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringMatching(/Cada dia debe tener al menos 1 comida y 1 postre/) }));
    });

    it('should create a base menu when days is an empty object', async () => {
        const req = {
            body: {
                type: 'next',
                days: {}
            }
        } as any;
        const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
        const createdMenu = {
            id: 'menu-1',
            weekStart: '2026-05-04',
            days: JSON.stringify({
                lunes: { meals: ['Milanesa'], desserts: ['Fruta'] },
                martes: { meals: ['Pasta'], desserts: ['Gelatina'] },
                miercoles: { meals: ['Pollo'], desserts: ['Flan'] },
                jueves: { meals: ['Carne'], desserts: ['Yogur'] },
                viernes: { meals: ['Pescado'], desserts: ['Ensalada de frutas'] },
            }),
            breadAvailable: true,
        };

        prismaMock.weeklyMenu.findUnique
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null);
        prismaMock.weeklyMenu.create.mockResolvedValue(createdMenu as any);

        await updateMenu(req, res);

        expect(prismaMock.weeklyMenu.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    breadAvailable: true,
                    days: expect.any(String),
                }),
            })
        );
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                menu: expect.objectContaining({
                    next: expect.objectContaining({ breadAvailable: true }),
                }),
            })
        );
    });
});

describe('getMenuCatalog', () => {
    it('devuelve comidas y postres distintos, ordenados y sin vacíos', async () => {
        prismaMock.weeklyMenu.findMany.mockResolvedValue([
            { days: JSON.stringify({
                lunes: { meals: ['Milanesa', 'Pizza'], desserts: ['Flan', ''] },
                martes: { meals: ['Pizza', '  Carne  '], desserts: ['Helado'] },
            }) },
            { days: JSON.stringify({
                lunes: { meals: ['Milanesa'], desserts: ['Flan'] },
            }) },
            { days: 'no-json' }, // se ignora sin romper
        ] as any);

        const res = { json: vi.fn(), status: vi.fn().mockReturnThis() } as any;
        await getMenuCatalog({} as any, res);

        const data = res.json.mock.calls[0][0];
        expect(data.meals).toEqual(['Carne', 'Milanesa', 'Pizza']); // distintos, trim, ordenados
        expect(data.desserts).toEqual(['Flan', 'Helado']);
    });
});
