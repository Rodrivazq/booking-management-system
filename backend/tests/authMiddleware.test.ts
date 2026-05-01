import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prismaMock } from './prisma.mock';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../src/config/env';
import { authMiddleware, requireAdmin, requireSuperAdmin } from '../src/middleware/auth';

describe('Auth Middleware', () => {
    const makeReqRes = (token: string | null) => ({
        req: {
            headers: { authorization: token ? `Bearer ${token}` : '' },
            user: undefined
        } as any,
        res: {
            json: vi.fn(),
            status: vi.fn().mockReturnThis()
        } as any,
        next: vi.fn()
    });

    const createToken = (payload: object) => jwt.sign(payload, JWT_SECRET);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('token válido pero usuario no existe => 401', async () => {
        const token = createToken({ id: 'ghost-user', role: 'user' });
        const { req, res, next } = makeReqRes(token);

        prismaMock.user.findUnique.mockResolvedValue(null);

        await authMiddleware(req, res, next);

        expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
            where: { id: 'ghost-user' },
            select: expect.any(Object)
        });
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('Usuario no encontrado') }));
        expect(next).not.toHaveBeenCalled();
    });

    it('token dice admin pero BD dice user => requireAdmin debe rechazar', async () => {
        const token = createToken({ id: 'demoted-user', role: 'admin' }); // JWT says admin
        const { req, res, next } = makeReqRes(token);

        // DB says user
        prismaMock.user.findUnique.mockResolvedValue({
            id: 'demoted-user', role: 'user', name: 'Test', email: 'test@test.com'
        } as any);

        await authMiddleware(req, res, next);
        
        expect(next).toHaveBeenCalled();
        expect(req.user.role).toBe('user'); // Rebuilt from DB

        // Now test requireAdmin
        requireAdmin(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Solo administradores' }));
    });

    it('token dice user pero BD dice admin => requireAdmin debe permitir', async () => {
        const token = createToken({ id: 'promoted-user', role: 'user' }); // JWT says user
        const { req, res, next } = makeReqRes(token);

        // DB says admin
        prismaMock.user.findUnique.mockResolvedValue({
            id: 'promoted-user', role: 'admin', name: 'Test', email: 'test@test.com'
        } as any);

        await authMiddleware(req, res, next);
        
        expect(next).toHaveBeenCalledTimes(1);
        expect(req.user.role).toBe('admin');

        // Now test requireAdmin
        requireAdmin(req, res, next);

        expect(next).toHaveBeenCalledTimes(2); // allowed
    });

    it('superadmin desde BD mantiene acceso a requireSuperAdmin', async () => {
        const token = createToken({ id: 'super-user', role: 'user' }); 
        const { req, res, next } = makeReqRes(token);

        // DB says superadmin
        prismaMock.user.findUnique.mockResolvedValue({
            id: 'super-user', role: 'superadmin', name: 'Test', email: 'test@test.com'
        } as any);

        await authMiddleware(req, res, next);
        
        expect(next).toHaveBeenCalledTimes(1);
        expect(req.user.role).toBe('superadmin');

        // Now test requireSuperAdmin
        requireSuperAdmin(req, res, next);

        expect(next).toHaveBeenCalledTimes(2); // allowed
    });
});
