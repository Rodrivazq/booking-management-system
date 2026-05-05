import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/utils/prisma';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../src/config/env';

// ─── Full Prisma Mock ────────────────────────────────────────────────────────
// Must cover every method called by authMiddleware + all tested controllers.
vi.mock('../src/utils/prisma', () => ({
  default: {
    $queryRaw: vi.fn(),
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    settings: {
      findFirst: vi.fn(),     // authMiddleware - maintenance mode check
      findUnique: vi.fn(),    // settings controller
      create: vi.fn(),        // settings controller fallback when no settings row exists
      upsert: vi.fn(),
    },
    reservation: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
    },
    weeklyMenu: {
      findUnique: vi.fn(),
    },
  }
}));

// ─── Token Factories ─────────────────────────────────────────────────────────
const userRecord    = { id: 'uid-user',  name: 'Normal', email: 'user@t.com',  role: 'user',       funcNumber: 'U001' };
const adminRecord   = { id: 'uid-admin', name: 'Admin',  email: 'admin@t.com', role: 'admin',      funcNumber: 'A001' };
const superRecord   = { id: 'uid-super', name: 'Super',  email: 'super@t.com', role: 'superadmin', funcNumber: 'S001' };

const userToken  = jwt.sign({ id: userRecord.id },  JWT_SECRET, { expiresIn: '1h' });
const adminToken = jwt.sign({ id: adminRecord.id }, JWT_SECRET, { expiresIn: '1h' });
const superToken = jwt.sign({ id: superRecord.id }, JWT_SECRET, { expiresIn: '1h' });

// ─── Auth Middleware Setup Helpers ───────────────────────────────────────────
// Each test that hits a protected endpoint must configure these two mocks so
// authMiddleware doesn't throw "is not a function" errors.
function authAs(record: typeof userRecord) {
  vi.mocked(prisma.user.findUnique).mockResolvedValue(record as any);
  vi.mocked(prisma.settings.findFirst).mockResolvedValue(null as any); // no maintenance mode
}

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('Permission Matrix — Role Enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. Public endpoints ────────────────────────────────────────────────────
  describe('Public endpoints (no auth required)', () => {
    it('GET /api/health → 200', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it('GET /api/settings → not 401 and not 403', async () => {
      const defaultSettings = { id: 1, companyName: 'Test', logoUrl: null, primaryColor: '#fff', secondaryColor: '#000', deadlineDay: 4, deadlineTime: '23:59', maintenanceMode: false };
      vi.mocked(prisma.settings.findUnique).mockResolvedValue(defaultSettings as any);
      const res = await request(app).get('/api/settings');
      expect(res.status).toBe(200);
    });

    it('GET /api/menu → not 401 and not 403', async () => {
      vi.mocked(prisma.weeklyMenu.findUnique).mockResolvedValue(null as any);
      const res = await request(app).get('/api/menu');
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });
  });

  // ── 2. No token → 401 ────────────────────────────────────────────────────
  describe('Missing token → 401', () => {
    it('GET /api/reservations/me without token → 401', async () => {
      const res = await request(app).get('/api/reservations/me');
      expect(res.status).toBe(401);
    });

    it('PUT /api/auth/profile without token → 401', async () => {
      const res = await request(app).put('/api/auth/profile').send({});
      expect(res.status).toBe(401);
    });

    it('GET /api/qr without token → 401', async () => {
      const res = await request(app).get('/api/qr');
      expect(res.status).toBe(401);
    });

    it('GET /api/stats without token → 401', async () => {
      const res = await request(app).get('/api/stats');
      expect(res.status).toBe(401);
    });
  });

  // ── 3. Admin-only endpoints ───────────────────────────────────────────────
  describe('Admin-only endpoints', () => {
    it('user → GET /api/reservations/admin → 403', async () => {
      authAs(userRecord);
      const res = await request(app)
        .get('/api/reservations/admin')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(403);
    });

    it('admin → GET /api/reservations/admin → 200', async () => {
      authAs(adminRecord);
      vi.mocked(prisma.reservation.findMany).mockResolvedValue([] as any);
      const res = await request(app)
        .get('/api/reservations/admin')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });

    it('user → GET /api/stats → 403', async () => {
      authAs(userRecord);
      const res = await request(app)
        .get('/api/stats')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(403);
    });

    it('user → GET /api/reports/stats → 403', async () => {
      authAs(userRecord);
      const res = await request(app)
        .get('/api/reports/stats')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(403);
    });

    it('user → GET /api/qr → 200 (any logged-in user can share access)', async () => {
      authAs(userRecord);
      const res = await request(app)
        .get('/api/qr')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('dataUrl');
    });

    it('admin → GET /api/qr → 200', async () => {
      authAs(adminRecord);
      const res = await request(app)
        .get('/api/qr')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('dataUrl');
    });
  });

  // ── 4. SuperAdmin-only endpoints ──────────────────────────────────────────
  describe('SuperAdmin-only endpoints', () => {
    it('user → PUT /api/admin/users/:id/role → 403', async () => {
      authAs(userRecord);
      const res = await request(app)
        .put('/api/admin/users/some-id/role')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ role: 'admin' });
      expect(res.status).toBe(403);
    });

    it('admin → PUT /api/admin/users/:id/role → 403', async () => {
      authAs(adminRecord);
      const res = await request(app)
        .put('/api/admin/users/some-id/role')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'admin' });
      expect(res.status).toBe(403);
    });

    it('superadmin → PUT /api/admin/users/:id/role → 404 (user not found, not 403)', async () => {
      authAs(superRecord);
      // superadmin clears all middleware; controller returns 404 for unknown userId
      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce(superRecord as any)  // authMiddleware lookup
        .mockResolvedValueOnce(null as any);         // controller target lookup
      vi.mocked(prisma.settings.findFirst).mockResolvedValue(null as any);
      const res = await request(app)
        .put('/api/admin/users/non-existent-id/role')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ role: 'admin' });
      expect(res.status).toBe(404);
    });

    it('user → PUT /api/settings → 403', async () => {
      authAs(userRecord);
      const res = await request(app)
        .put('/api/settings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ companyName: 'Hacked' });
      expect(res.status).toBe(403);
    });

    it('admin → PUT /api/settings → 403', async () => {
      authAs(adminRecord);
      const res = await request(app)
        .put('/api/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ companyName: 'Hacked' });
      expect(res.status).toBe(403);
    });

    it('user → PUT /api/menu → 403', async () => {
      authAs(userRecord);
      const res = await request(app)
        .put('/api/menu')
        .set('Authorization', `Bearer ${userToken}`)
        .send({});
      expect(res.status).toBe(403);
    });

    it('admin → PUT /api/menu → 403', async () => {
      authAs(adminRecord);
      const res = await request(app)
        .put('/api/menu')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(res.status).toBe(403);
    });
  });
});
