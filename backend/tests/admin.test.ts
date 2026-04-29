import { describe, it, expect, vi } from 'vitest';
import { prismaMock } from './prisma.mock';
import { changeUserRole } from '../src/controllers/admin.controller';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeReqRes = (actorId: string, targetId: string, newRole: string) => ({
    req: {
        user: { id: actorId, role: 'superadmin' },
        params: { userId: targetId },
        body: { role: newRole },
    } as any,
    res: {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
    } as any,
});

const userRecord = (id: string, role: string) => ({
    id,
    name: `User ${id}`,
    email: `${id}@test.com`,
    role,
    funcNumber: id,
    documentId: id,
    phoneNumber: null,
    photoUrl: null,
    passwordHash: 'hash',
    createdAt: new Date(),
    updatedAt: new Date(),
    isEmailVerified: true,
    lastReservation: null,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('changeUserRole', () => {

    // ── 1. Self-change always rejected ────────────────────────────────────
    it('rejects when actor tries to change their own role', async () => {
        const { req, res } = makeReqRes('actor-1', 'actor-1', 'admin');

        await changeUserRole(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ error: expect.stringContaining('propio rol') })
        );
    });

    // ── 2. Invalid role rejected ──────────────────────────────────────────
    it('rejects an invalid role value', async () => {
        const { req, res } = makeReqRes('actor-1', 'target-2', 'god');

        await changeUserRole(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ error: expect.stringContaining('Rol inválido') })
        );
    });

    // ── 3. Regular user → admin (allowed) ────────────────────────────────
    it('allows promoting a regular user to admin', async () => {
        const { req, res } = makeReqRes('actor-1', 'target-2', 'admin');

        prismaMock.user.findUnique.mockResolvedValue(userRecord('target-2', 'user') as any);
        prismaMock.user.update.mockResolvedValue(userRecord('target-2', 'admin') as any);

        await changeUserRole(req, res);

        expect(prismaMock.user.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: { role: 'admin' } })
        );
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ ok: true, user: expect.objectContaining({ role: 'admin' }) })
        );
    });

    // ── 4. Admin → user (allowed) ─────────────────────────────────────────
    it('allows demoting an admin to user', async () => {
        const { req, res } = makeReqRes('actor-1', 'target-3', 'user');

        prismaMock.user.findUnique.mockResolvedValue(userRecord('target-3', 'admin') as any);
        prismaMock.user.update.mockResolvedValue(userRecord('target-3', 'user') as any);

        await changeUserRole(req, res);

        expect(prismaMock.user.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: { role: 'user' } })
        );
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ ok: true })
        );
    });

    // ── 5. Demote the ONLY superadmin → rejected ──────────────────────────
    it('rejects demoting the last superadmin', async () => {
        const { req, res } = makeReqRes('actor-1', 'target-4', 'admin');

        prismaMock.user.findUnique.mockResolvedValue(userRecord('target-4', 'superadmin') as any);
        // Only 1 superadmin in the system
        prismaMock.user.count.mockResolvedValue(1);

        await changeUserRole(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ error: expect.stringContaining('único Super Admin') })
        );
        expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    // ── 6. Demote a superadmin when 2+ exist → allowed ───────────────────
    it('allows demoting a superadmin when at least 2 superadmins exist', async () => {
        const { req, res } = makeReqRes('actor-1', 'target-5', 'admin');

        prismaMock.user.findUnique.mockResolvedValue(userRecord('target-5', 'superadmin') as any);
        // 2 superadmins — safe to demote one
        prismaMock.user.count.mockResolvedValue(2);
        prismaMock.user.update.mockResolvedValue(userRecord('target-5', 'admin') as any);

        await changeUserRole(req, res);

        expect(prismaMock.user.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: { role: 'admin' } })
        );
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ ok: true, user: expect.objectContaining({ role: 'admin' }) })
        );
    });

    // ── 7. Promoting to superadmin (no count check needed) ───────────────
    it('allows promoting a user to superadmin without count check', async () => {
        const { req, res } = makeReqRes('actor-1', 'target-6', 'superadmin');

        prismaMock.user.findUnique.mockResolvedValue(userRecord('target-6', 'user') as any);
        prismaMock.user.update.mockResolvedValue(userRecord('target-6', 'superadmin') as any);

        await changeUserRole(req, res);

        // count should NOT be called when promoting (only when demoting a superadmin)
        expect(prismaMock.user.count).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ ok: true, user: expect.objectContaining({ role: 'superadmin' }) })
        );
    });
});
