import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prismaMock } from './prisma.mock';
import { register, login } from '../src/controllers/auth.controller';

vi.mock('bcryptjs', () => ({
  default: {
    hashSync: vi.fn().mockReturnValue('hashed_password'),
    compareSync: vi.fn().mockReturnValue(true) // Default true
  }
}));

vi.mock('../src/services/email.service', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(true),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(true)
}));

import { sendVerificationEmail, sendPasswordResetEmail } from '../src/services/email.service';
import { forgotPassword, resendVerification } from '../src/controllers/auth.controller';

describe('Auth Controller (Unit Tests)', () => {
  it('should register a new user successfully', async () => {
    const req = {
      body: {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        funcNumber: 'TEST001',
        documentId: '12345678',
        photoUrl: 'https://example.com/photo.jpg'
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
      photoUrl: 'https://example.com/photo.jpg',
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

  it('rechaza el registro sin foto de perfil (ahora es obligatoria)', async () => {
    const req = {
      body: {
        name: 'No Photo User',
        email: 'nophoto@example.com',
        password: 'password123',
        funcNumber: 'NOPHOTO001',
        documentId: '22222222'
      }
    } as any;
    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() } as any;

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('foto de perfil es obligatoria') }));
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it('rejects registration with base64 image', async () => {
    const req = {
      body: {
        name: 'Test User', email: 'base64@example.com', password: 'password123',
        funcNumber: 'BASE001', documentId: '11111111', photoUrl: 'data:image/png;base64,iVBORw0KGgo...'
      }
    } as any;
    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() } as any;

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringMatching(/base64/) }));
  });

  it('register informa error si no se pudo mandar email de verificación', async () => {
    const req = {
      body: {
        name: 'Test Fail Email', email: 'fail@example.com', password: 'password123',
        funcNumber: 'FAIL001', documentId: '87654321', photoUrl: 'https://example.com/photo.jpg'
      }
    } as any;
    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() } as any;

    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({ id: 'usr-fail' } as any);

    // Force email failure
    vi.mocked(sendVerificationEmail).mockResolvedValueOnce(false);

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ 
        message: expect.stringContaining('problema técnico'),
        warning: true
    }));
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

  describe('resendVerification', () => {
    it('regenerates token and sends email when user exists and is not verified', async () => {
      const req = { body: { email: 'pending@example.com' } } as any;
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() } as any;

      prismaMock.user.findUnique.mockResolvedValue({
        id: 'usr-pending',
        email: 'pending@example.com',
        name: 'Pending User',
        isEmailVerified: false,
      } as any);
      prismaMock.user.update.mockResolvedValue({} as any);

      await resendVerification(req, res);

      // Token regenerated
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'usr-pending' },
          data: expect.objectContaining({ verificationToken: expect.any(String) }),
        })
      );
      // Email sent
      expect(sendVerificationEmail).toHaveBeenCalled();
      // Neutral response
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        ok: true,
        message: expect.stringContaining('Si la cuenta existe'),
      }));
    });

    it('returns neutral response without sending email when user is already verified', async () => {
      const req = { body: { email: 'verified@example.com' } } as any;
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() } as any;

      prismaMock.user.findUnique.mockResolvedValue({
        id: 'usr-verified',
        email: 'verified@example.com',
        name: 'Verified User',
        isEmailVerified: true,
      } as any);

      vi.mocked(sendVerificationEmail).mockClear();
      vi.mocked(prismaMock.user.update).mockClear();

      await resendVerification(req, res);

      // No update, no email
      expect(prismaMock.user.update).not.toHaveBeenCalled();
      expect(sendVerificationEmail).not.toHaveBeenCalled();
      // Same neutral response (anti-enumeration)
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        ok: true,
        message: expect.stringContaining('Si la cuenta existe'),
      }));
    });

    it('returns neutral response when user does not exist (anti-enumeration)', async () => {
      const req = { body: { email: 'unknown@example.com' } } as any;
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() } as any;

      prismaMock.user.findUnique.mockResolvedValue(null);
      vi.mocked(sendVerificationEmail).mockClear();
      vi.mocked(prismaMock.user.update).mockClear();

      await resendVerification(req, res);

      expect(prismaMock.user.update).not.toHaveBeenCalled();
      expect(sendVerificationEmail).not.toHaveBeenCalled();
      // Identical response shape: caller can't tell the email isn't registered.
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        ok: true,
        message: expect.stringContaining('Si la cuenta existe'),
      }));
    });
  });

  it('forgot password mantiene respuesta neutral aunque falle email', async () => {
    const req = { body: { email: 'reset@example.com' } } as any;
    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() } as any;

    prismaMock.user.findFirst.mockResolvedValue({ id: 'usr-reset', email: 'reset@example.com' } as any);
    prismaMock.passwordReset.create.mockResolvedValue({} as any);

    // Force email failure
    vi.mocked(sendPasswordResetEmail).mockResolvedValueOnce(false);

    await forgotPassword(req, res);

    // Verify it still responds 200 ok
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ 
        ok: true,
        message: expect.stringContaining('Si el correo existe')
    }));
  });
});
