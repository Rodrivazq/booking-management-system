import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prismaMock } from './prisma.mock';
import { changeUserRole, createUser, updateUserDetails, setReservationOverride } from '../src/controllers/admin.controller';

vi.mock('../src/services/email.service', () => ({
  sendAdminCreatedUserEmail: vi.fn().mockResolvedValue(true)
}));

import { sendAdminCreatedUserEmail } from '../src/services/email.service';

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

const makeDetailsReqRes = (
    actorRole: string,
    targetId: string,
    body: Record<string, unknown> = { email: 'updated@example.com' }
) => ({
    req: {
        user: { id: 'actor-1', role: actorRole },
        params: { userId: targetId },
        body,
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

describe('createUser', () => {
    it('responde ok aunque falle email, incluyendo warning y emailSent:false', async () => {
        const req = {
            user: { id: 'admin-1', role: 'admin' },
            body: {
                name: 'New User', email: 'new@example.com', password: 'password123',
                funcNumber: 'NEW001', documentId: '99999999'
            }
        } as any;
        const res = { json: vi.fn(), status: vi.fn().mockReturnThis() } as any;

        prismaMock.user.findUnique.mockResolvedValue(null);
        prismaMock.user.create.mockResolvedValue({ id: 'usr-new' } as any);

        // Force email failure
        vi.mocked(sendAdminCreatedUserEmail).mockResolvedValueOnce(false);

        await createUser(req, res);

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            ok: true,
            emailSent: false,
            warning: expect.stringContaining('proveedor de correo no está configurado o falló')
        }));
    });
});

describe('updateUserDetails', () => {
    it('rejects a standard admin editing a superadmin profile', async () => {
        const { req, res } = makeDetailsReqRes('admin', 'super-1', {
            email: 'takeover@example.com',
        });

        prismaMock.user.findUnique.mockResolvedValue(userRecord('super-1', 'superadmin') as any);

        await updateUserDetails(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ error: expect.stringContaining('Super Admin') })
        );
        expect(prismaMock.user.findFirst).not.toHaveBeenCalled();
        expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('allows a superadmin editing another superadmin profile', async () => {
        const { req, res } = makeDetailsReqRes('superadmin', 'super-2', {
            email: ' Owner@Example.COM ',
            funcNumber: ' adm 001 ',
            documentId: ' 1 2 3 4 ',
            phoneNumber: ' 099123456 ',
        });

        prismaMock.user.findUnique.mockResolvedValue(userRecord('super-2', 'superadmin') as any);
        prismaMock.user.findFirst.mockResolvedValue(null);
        prismaMock.user.update.mockResolvedValue({
            ...userRecord('super-2', 'superadmin'),
            email: 'owner@example.com',
            funcNumber: 'ADM001',
            documentId: '1 2 3 4',
            phoneNumber: '099123456',
        } as any);

        await updateUserDetails(req, res);

        expect(prismaMock.user.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'super-2' },
                data: expect.objectContaining({
                    email: 'owner@example.com',
                    funcNumber: 'ADM001',
                    documentId: '1 2 3 4',
                    phoneNumber: '099123456',
                }),
            })
        );
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ ok: true, user: expect.objectContaining({ email: 'owner@example.com' }) })
        );
    });

    it('allows a standard admin editing a regular user profile', async () => {
        const { req, res } = makeDetailsReqRes('admin', 'user-1', {
            phoneNumber: ' 091234567 ',
        });

        prismaMock.user.findUnique.mockResolvedValue(userRecord('user-1', 'user') as any);
        prismaMock.user.update.mockResolvedValue({
            ...userRecord('user-1', 'user'),
            phoneNumber: '091234567',
        } as any);

        await updateUserDetails(req, res);

        expect(prismaMock.user.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'user-1' },
                data: expect.objectContaining({ phoneNumber: '091234567' }),
            })
        );
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    });

    it('returns 404 when the target user does not exist', async () => {
        const { req, res } = makeDetailsReqRes('admin', 'missing-user');

        prismaMock.user.findUnique.mockResolvedValue(null);

        await updateUserDetails(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ error: expect.stringContaining('Usuario no encontrado') })
        );
        expect(prismaMock.user.update).not.toHaveBeenCalled();
    });
});

describe('previewUsersImport', () => {
    it('returns error if payload is not an array', async () => {
        const { previewUsersImport } = await import('../src/controllers/admin.controller');
        const req = { body: { users: 'not an array' } } as any;
        const res = { json: vi.fn(), status: vi.fn().mockReturnThis() } as any;

        await previewUsersImport(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('array') }));
    });

    it('identifies missing fields and internal duplicates', async () => {
        const { previewUsersImport } = await import('../src/controllers/admin.controller');
        const req = {
            body: {
                users: [
                    { name: 'John', email: 'john@test.com', funcNumber: 'F01', documentId: 'D01' },
                    { name: 'Missing', email: 'john@test.com' }, // duplicate email, missing func and doc
                ]
            }
        } as any;
        const res = { json: vi.fn(), status: vi.fn().mockReturnThis() } as any;

        prismaMock.user.findMany.mockResolvedValue([]);

        await previewUsersImport(req, res);

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            ok: true,
            summary: expect.objectContaining({ totalReceived: 2, validCount: 1, errorCount: 1 }),
        }));

        const responseData = res.json.mock.calls[0][0];
        expect(responseData.validRows).toHaveLength(1);
        expect(responseData.errors).toHaveLength(1);
        expect(responseData.errors[0].reasons.some((r: string) => r.includes('Faltan campos'))).toBe(true);
        expect(responseData.errors[0].reasons.some((r: string) => r.includes('Email duplicado en el mismo archivo'))).toBe(true);
    });

    it('identifies duplicates against the database', async () => {
        const { previewUsersImport } = await import('../src/controllers/admin.controller');
        const req = {
            body: {
                users: [
                    { name: 'Jane', email: 'jane@db.com', funcNumber: 'F02', documentId: 'D02' }
                ]
            }
        } as any;
        const res = { json: vi.fn(), status: vi.fn().mockReturnThis() } as any;

        // Mock that jane@db.com exists
        prismaMock.user.findMany
            .mockResolvedValueOnce([{ email: 'jane@db.com' }] as any) // email check
            .mockResolvedValueOnce([]) // funcNumber check
            .mockResolvedValueOnce([]); // documentId check

        await previewUsersImport(req, res);

        const responseData = res.json.mock.calls[0][0];
        expect(responseData.validRows).toHaveLength(0);
        expect(responseData.errors).toHaveLength(1);
        expect(responseData.errors[0].reasons.some((r: string) => r.includes('Email ya existe en el sistema'))).toBe(true);
    });

    it('does not echo unexpected sensitive fields in invalid row data', async () => {
        const { previewUsersImport } = await import('../src/controllers/admin.controller');
        const req = {
            body: {
                users: [
                    {
                        name: 'Unsafe',
                        email: 'bad-email',
                        funcNumber: 'F03',
                        documentId: 'D03',
                        password: 'plain-password',
                        token: 'secret-token',
                        photoUrl: 'data:image/png;base64,huge',
                    }
                ]
            }
        } as any;
        const res = { json: vi.fn(), status: vi.fn().mockReturnThis() } as any;

        prismaMock.user.findMany.mockResolvedValue([]);

        await previewUsersImport(req, res);

        const responseData = res.json.mock.calls[0][0];
        expect(responseData.errors).toHaveLength(1);
        expect(responseData.errors[0].data).toEqual({
            name: 'Unsafe',
            email: 'bad-email',
            funcNumber: 'F03',
            documentId: 'D03',
            phoneNumber: null,
            role: 'user',
        });
        expect(responseData.errors[0].data.password).toBeUndefined();
        expect(responseData.errors[0].data.token).toBeUndefined();
        expect(responseData.errors[0].data.photoUrl).toBeUndefined();
    });

    it('rejects oversized import previews', async () => {
        const { previewUsersImport } = await import('../src/controllers/admin.controller');
        const req = {
            body: {
                users: Array.from({ length: 501 }, (_, index) => ({
                    name: `User ${index}`,
                    email: `user${index}@test.com`,
                    funcNumber: `F${index}`,
                    documentId: `D${index}`,
                }))
            }
        } as any;
        const res = { json: vi.fn(), status: vi.fn().mockReturnThis() } as any;

        await previewUsersImport(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(prismaMock.user.findMany).not.toHaveBeenCalled();
    });
});

describe('importUsers', () => {
    beforeEach(() => {
        // Reset call counts on shared mocks (sendAdminCreatedUserEmail, prisma)
        // since other describes in this file also exercise them.
        vi.clearAllMocks();
    });

    const validRow = (overrides: Record<string, unknown> = {}) => ({
        name: 'Juan Perez',
        email: 'juan@test.com',
        funcNumber: 'F100',
        documentId: '11111111',
        phoneNumber: '099000000',
        role: 'user',
        ...overrides,
    });

    const buildReqRes = (body: Record<string, unknown>) => ({
        req: { user: { id: 'super-1', role: 'superadmin' }, body } as any,
        res: { json: vi.fn(), status: vi.fn().mockReturnThis() } as any,
    });

    it('rejects when confirm flag is missing or false', async () => {
        const { importUsers } = await import('../src/controllers/admin.controller');
        const { req, res } = buildReqRes({ users: [validRow()] });

        await importUsers(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ error: expect.stringContaining('Confirmación') })
        );
        expect(prismaMock.user.create).not.toHaveBeenCalled();
    });

    it('happy path: creates valid users, sends welcome emails, returns structured report', async () => {
        const { importUsers } = await import('../src/controllers/admin.controller');
        const { req, res } = buildReqRes({
            confirm: true,
            users: [
                validRow({ email: 'a@test.com', funcNumber: 'F-A', documentId: 'D-A' }),
                validRow({ email: 'b@test.com', funcNumber: 'F-B', documentId: 'D-B', name: 'Maria Lopez' }),
            ],
        });

        prismaMock.user.findMany.mockResolvedValue([]); // no DB duplicates
        prismaMock.user.create
            .mockResolvedValueOnce({ id: 'usr-a', email: 'a@test.com', name: 'Juan Perez' } as any)
            .mockResolvedValueOnce({ id: 'usr-b', email: 'b@test.com', name: 'Maria Lopez' } as any);

        await importUsers(req, res);

        expect(prismaMock.user.create).toHaveBeenCalledTimes(2);
        expect(sendAdminCreatedUserEmail).toHaveBeenCalledTimes(2);

        const responseData = res.json.mock.calls[0][0];
        expect(responseData.ok).toBe(true);
        expect(responseData.summary).toEqual(expect.objectContaining({
            totalReceived: 2,
            createdCount: 2,
            skippedCount: 0,
            failedCount: 0,
        }));
        expect(responseData.created).toHaveLength(2);
        expect(responseData.skipped).toHaveLength(0);
        expect(responseData.failed).toHaveLength(0);
    });

    it('idempotency: skips users that already exist in the DB', async () => {
        const { importUsers } = await import('../src/controllers/admin.controller');
        const { req, res } = buildReqRes({
            confirm: true,
            users: [
                validRow({ email: 'existing@test.com', funcNumber: 'F-X', documentId: 'D-X' }),
                validRow({ email: 'new@test.com', funcNumber: 'F-N', documentId: 'D-N', name: 'New User' }),
            ],
        });

        prismaMock.user.findMany
            .mockResolvedValueOnce([{ email: 'existing@test.com' }] as any) // email check
            .mockResolvedValueOnce([]) // funcNumber check
            .mockResolvedValueOnce([]); // documentId check
        prismaMock.user.create.mockResolvedValueOnce({ id: 'usr-new', email: 'new@test.com', name: 'New User' } as any);

        await importUsers(req, res);

        const responseData = res.json.mock.calls[0][0];
        expect(responseData.summary.createdCount).toBe(1);
        expect(responseData.summary.skippedCount).toBe(1);
        expect(responseData.skipped[0].email).toBe('existing@test.com');
        expect(responseData.skipped[0].reason).toContain('Ya existe');
        expect(prismaMock.user.create).toHaveBeenCalledTimes(1);
    });

    it('detects internal duplicates within the same payload', async () => {
        const { importUsers } = await import('../src/controllers/admin.controller');
        const { req, res } = buildReqRes({
            confirm: true,
            users: [
                validRow({ email: 'dup@test.com', funcNumber: 'F-D1', documentId: 'D-D1' }),
                validRow({ email: 'dup@test.com', funcNumber: 'F-D2', documentId: 'D-D2', name: 'Dup' }),
            ],
        });

        prismaMock.user.findMany.mockResolvedValue([]);
        prismaMock.user.create.mockResolvedValueOnce({ id: 'usr-1', email: 'dup@test.com', name: 'Juan Perez' } as any);

        await importUsers(req, res);

        const responseData = res.json.mock.calls[0][0];
        expect(responseData.summary.createdCount).toBe(1);
        expect(responseData.summary.skippedCount).toBe(1);
        expect(responseData.skipped[0].reason).toContain('Duplicado');
    });

    it('rejects rows with invalid data without aborting the whole import', async () => {
        const { importUsers } = await import('../src/controllers/admin.controller');
        const { req, res } = buildReqRes({
            confirm: true,
            users: [
                { name: '', email: 'incomplete@test.com', funcNumber: 'F-I', documentId: 'D-I' }, // missing name
                validRow({ email: 'bad-email-no-at', funcNumber: 'F-B', documentId: 'D-B' }), // bad email
                validRow({ email: 'badrole@test.com', funcNumber: 'F-R', documentId: 'D-R', role: 'superadmin' }), // disallowed role
                validRow({ email: 'ok@test.com', funcNumber: 'F-OK', documentId: 'D-OK' }),
            ],
        });

        prismaMock.user.findMany.mockResolvedValue([]);
        prismaMock.user.create.mockResolvedValueOnce({ id: 'usr-ok', email: 'ok@test.com', name: 'Juan Perez' } as any);

        await importUsers(req, res);

        const responseData = res.json.mock.calls[0][0];
        expect(responseData.summary.totalReceived).toBe(4);
        expect(responseData.summary.createdCount).toBe(1);
        expect(responseData.summary.failedCount).toBe(3);
        const reasons = responseData.failed.map((f: { reason: string }) => f.reason);
        expect(reasons).toEqual(expect.arrayContaining([
            expect.stringContaining('Faltan campos'),
            expect.stringContaining('Email inválido'),
            expect.stringContaining('Rol inválido'),
        ]));
    });

    it('email failure does not abort user creation', async () => {
        const { importUsers } = await import('../src/controllers/admin.controller');
        const { req, res } = buildReqRes({
            confirm: true,
            users: [validRow({ email: 'noemail@test.com', funcNumber: 'F-NE', documentId: 'D-NE' })],
        });

        prismaMock.user.findMany.mockResolvedValue([]);
        prismaMock.user.create.mockResolvedValueOnce({ id: 'usr-ne', email: 'noemail@test.com', name: 'Juan Perez' } as any);
        vi.mocked(sendAdminCreatedUserEmail).mockResolvedValueOnce(false);

        await importUsers(req, res);

        const responseData = res.json.mock.calls[0][0];
        expect(responseData.summary.createdCount).toBe(1);
        expect(responseData.summary.emailsFailed).toBe(1);
        expect(responseData.created[0].emailSent).toBe(false);
    });

    it('rejects non-array payloads and oversized imports', async () => {
        const { importUsers } = await import('../src/controllers/admin.controller');
        const tooMany = Array.from({ length: 501 }, (_, i) => validRow({
            email: `u${i}@test.com`, funcNumber: `F${i}`, documentId: `D${i}`,
        }));

        const { req: reqNotArray, res: resNotArray } = buildReqRes({ confirm: true, users: 'not array' });
        await importUsers(reqNotArray, resNotArray);
        expect(resNotArray.status).toHaveBeenCalledWith(400);

        const { req: reqOversize, res: resOversize } = buildReqRes({ confirm: true, users: tooMany });
        await importUsers(reqOversize, resOversize);
        expect(resOversize.status).toHaveBeenCalledWith(400);
        expect(prismaMock.user.create).not.toHaveBeenCalled();
    });
});

describe('setReservationOverride', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it('habilita: guarda un lunes (YYYY-MM-DD)', async () => {
        prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' } as any);
        prismaMock.user.update.mockResolvedValue({ id: 'u1', reservationOverrideWeek: '2026-06-15' } as any);

        const req = { params: { userId: 'u1' }, body: { enable: true } } as any;
        const res = { json: vi.fn(), status: vi.fn().mockReturnThis() } as any;
        await setReservationOverride(req, res);

        const updateArg = prismaMock.user.update.mock.calls[0][0] as any;
        expect(updateArg.data.reservationOverrideWeek).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    });

    it('deshabilita: setea null', async () => {
        prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' } as any);
        prismaMock.user.update.mockResolvedValue({ id: 'u1', reservationOverrideWeek: null } as any);

        const req = { params: { userId: 'u1' }, body: { enable: false } } as any;
        const res = { json: vi.fn(), status: vi.fn().mockReturnThis() } as any;
        await setReservationOverride(req, res);

        const updateArg = prismaMock.user.update.mock.calls[0][0] as any;
        expect(updateArg.data.reservationOverrideWeek).toBeNull();
    });

    it('responde 404 si el usuario no existe', async () => {
        prismaMock.user.findUnique.mockResolvedValue(null as any);
        const req = { params: { userId: 'x' }, body: { enable: true } } as any;
        const res = { json: vi.fn(), status: vi.fn().mockReturnThis() } as any;
        await setReservationOverride(req, res);
        expect(res.status).toHaveBeenCalledWith(404);
    });
});
