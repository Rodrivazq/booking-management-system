import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import fs from 'fs';

describe('Auth Endpoints', () => {
  it('should register a new user', async () => {
    try {
        const res = await request(app)
        .post('/api/auth/register')
        .send({
            name: 'Test User',
            email: 'test@example.com',
            password: 'password123',
            funcNumber: 'TEST001'
        });

        fs.writeFileSync('debug_auth.json', JSON.stringify(res.body, null, 2));

        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('token');
        expect(res.body.user).toHaveProperty('email', 'test@example.com');
    } catch (e: any) {
        fs.writeFileSync('debug_error.json', JSON.stringify({ message: e.message, stack: e.stack }, null, 2));
        throw e;
    }
  });

  it('should login with valid credentials', async () => {
    // First register
    await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Login User',
        email: 'login@example.com',
        password: 'password123',
        funcNumber: 'LOGIN001'
      });

    // Then login
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'login@example.com',
        password: 'password123'
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('token');
  });

  it('should fail login with invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'nonexistent@example.com',
        password: 'wrongpassword'
      });

    expect(res.statusCode).toEqual(401);
  });
});
