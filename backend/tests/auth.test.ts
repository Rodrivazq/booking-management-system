import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prismaMock } from './prisma.mock';
import { register, login } from '../src/controllers/auth.controller';

vi.mock('bcryptjs', () => ({
  default: {
    hashSync: vi.fn().mockReturnValue('hashed_password'),
    compareSync: vi.fn().mockReturnValue(true) // Default true
  }
}));

describe('Auth Controller (Unit Tests)', () => {
  it('should register a new user successfully', async () => {
    const req = {
      body: {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        funcNumber: 'TEST001',
        documentId: '12345678',
        photoUrl: 'http://'
      }
    } as any;
    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() } as any;

    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({
      id: 'usr-1',
      name: 'Test User',
      email: 'test@example.com',
      passwordHash: 'hashed_password',
      role: 'user',
      funcNumber: 'TEST001',
      documentId: '12345678',
      phoneNumber: null,
      photoUrl: 'http://',
      isEmailVerified: true,
      verificationToken: null,
      preferences: null,
      createdAt: new Date(),
      updatedAt: new Date()
    } as any);

    await register(req, res);

    expect(prismaMock.user.findUnique).toHaveBeenCalled();
    expect(prismaMock.user.create).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Registro exitoso') }));
  });

  it('should login with valid credentials', async () => {
    const req = { body: { email: 'login@example.com', password: 'password123' } } as any;
    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() } as any;

    prismaMock.user.findFirst.mockResolvedValue({
      id: 'usr-2', name: 'Login User', email: 'login@example.com', passwordHash: 'hashed_password', role: 'user', funcNumber: 'LOGIN001',
      documentId: null, phoneNumber: null, photoUrl: null, isEmailVerified: true, verificationToken: null, preferences: null,
      createdAt: new Date(), updatedAt: new Date()
    } as any);

    // Mock update login timestamp
    prismaMock.user.update.mockResolvedValue({} as any);

    await login(req, res);

    expect(prismaMock.user.findFirst).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ token: expect.any(String) }));
  });

  it('should fail login with invalid credentials', async () => {
    const req = { body: { email: 'nonexistent@example.com', password: 'wrongpassword' } } as any;
    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() } as any;

    prismaMock.user.findFirst.mockResolvedValue(null);

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringMatching(/invalidas|inválidas/i) }));
  });
});
