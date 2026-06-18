import { describe, it, expect, vi } from 'vitest';
import { prismaMock } from './prisma.mock';
import { updateSettings } from '../src/controllers/settings.controller';

const makeRes = () => ({ json: vi.fn(), status: vi.fn().mockReturnThis() } as any);

describe('updateSettings', () => {
    it('guarda los settings (upsert) y responde ok', async () => {
        prismaMock.settings.upsert.mockResolvedValue({ id: 1, deadlineDay: 2 } as any);

        const req = { body: { deadlineDay: 2 } } as any;
        const res = makeRes();
        await updateSettings(req, res);

        expect(prismaMock.settings.upsert).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    });

    it('rechaza un logoUrl inválido (base64)', async () => {
        const req = { body: { logoUrl: 'data:image/png;base64,AAAA' } } as any;
        const res = makeRes();
        await updateSettings(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });
});
