import { describe, it, expect, vi } from 'vitest';
import { prismaMock } from './prisma.mock';
import { updateSettings } from '../src/controllers/settings.controller';

const makeRes = () => ({ json: vi.fn(), status: vi.fn().mockReturnThis() } as any);

describe('updateSettings — aviso por cambio de configuración', () => {
    it('genera el cartel automático cuando cambia el día de cierre', async () => {
        prismaMock.settings.findUnique.mockResolvedValue({ id: 1, deadlineDay: 4, deadlineTime: '23:59', announcementMessage: '' } as any);
        prismaMock.settings.upsert.mockResolvedValue({ id: 1, deadlineDay: 2 } as any);
        prismaMock.user.findMany.mockResolvedValue([] as any);

        const req = { body: { deadlineDay: 2 } } as any;
        const res = makeRes();
        await updateSettings(req, res);

        const upsertArg = prismaMock.settings.upsert.mock.calls[0][0] as any;
        expect(upsertArg.update.announcementMessage).toMatch(/cierre de reservas cambió/i);
        expect(upsertArg.update.announcementType).toBe('warning');
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    });

    it('no genera cartel automático si el deadline no cambió', async () => {
        prismaMock.settings.findUnique.mockResolvedValue({ id: 1, deadlineDay: 4, deadlineTime: '23:59', announcementMessage: '' } as any);
        prismaMock.settings.upsert.mockResolvedValue({ id: 1 } as any);
        prismaMock.user.findMany.mockResolvedValue([] as any);

        const req = { body: { companyName: 'Nuevo Nombre' } } as any;
        const res = makeRes();
        await updateSettings(req, res);

        const upsertArg = prismaMock.settings.upsert.mock.calls[0][0] as any;
        expect(upsertArg.update.announcementMessage).toBeUndefined();
    });

    it('respeta el aviso propio del admin si lo escribió (no lo pisa)', async () => {
        prismaMock.settings.findUnique.mockResolvedValue({ id: 1, deadlineDay: 4, deadlineTime: '23:59', announcementMessage: '' } as any);
        prismaMock.settings.upsert.mockResolvedValue({ id: 1 } as any);
        prismaMock.user.findMany.mockResolvedValue([] as any);

        const req = { body: { deadlineDay: 2, announcementMessage: 'Viernes feriado: no hay servicio.' } } as any;
        const res = makeRes();
        await updateSettings(req, res);

        const upsertArg = prismaMock.settings.upsert.mock.calls[0][0] as any;
        expect(upsertArg.update.announcementMessage).toBe('Viernes feriado: no hay servicio.');
    });
});
