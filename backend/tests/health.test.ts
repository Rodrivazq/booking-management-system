import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app';

// Mock the global rate limiter so we don't get 429 during fast tests
vi.mock('../src/middleware/rateLimiter', () => ({
  globalLimiter: (req: any, res: any, next: any) => next(),
  loginLimiter: (req: any, res: any, next: any) => next(),
  forgotPasswordLimiter: (req: any, res: any, next: any) => next(),
  apiLimiter: (req: any, res: any, next: any) => next()
}));

// Mock Prisma
import prisma from '../src/utils/prisma';
vi.mock('../src/utils/prisma', () => ({
  default: {
    $queryRaw: vi.fn()
  }
}));

describe('Observability Endpoints', () => {
  it('GET /api/health responds with 200 and correct structure', async () => {
    const res = await request(app).get('/api/health');
    
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.service).toBe('reservas-api');
    expect(res.body).toHaveProperty('env');
    expect(res.body).toHaveProperty('timezone');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('nextMonday');
  });

  it('GET /api/ready responds 200 when DB is ok', async () => {
    // Mock prisma to succeed
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ 1: 1 }] as any);
    
    const res = await request(app).get('/api/ready');
    
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.database).toBe('ok');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('GET /api/ready responds 503 when DB fails', async () => {
    // Mock prisma to throw an error
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error('Connection failed'));
    
    const res = await request(app).get('/api/ready');
    
    expect(res.status).toBe(503);
    expect(res.body.ok).toBe(false);
    expect(res.body.database).toBe('error');
    expect(res.body).toHaveProperty('timestamp');
  });
});
