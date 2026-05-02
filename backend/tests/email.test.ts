import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock('resend', () => ({
    Resend: class MockResend {
        emails = { send: sendMock };
    }
}));

// Mock env to guarantee no real providers are loaded during these tests
vi.mock('../src/config/env', () => {
    return {
        // Getters so that each test can change env state and re-import the service module
        get NODE_ENV() { return process.env.TEST_MOCK_ENV || 'development'; },
        get SMTP() { return { host: process.env.TEST_MOCK_SMTP_HOST }; },
        get RESEND_API_KEY() { return process.env.TEST_MOCK_RESEND_KEY; },
        FRONTEND_URL: 'http://test'
    };
});

// Mock logger to prevent console clutter during tests
vi.mock('../src/utils/logger', () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

beforeEach(() => {
    vi.resetModules();
    sendMock.mockReset();
});

afterEach(() => {
    delete process.env.TEST_MOCK_ENV;
    delete process.env.TEST_MOCK_SMTP_HOST;
    delete process.env.TEST_MOCK_RESEND_KEY;
    vi.clearAllMocks();
});

describe('Email Service', () => {
    it('development sin proveedor simula éxito', async () => {
        process.env.TEST_MOCK_ENV = 'development';

        const { sendVerificationEmail } = await import('../src/services/email.service');
        const logger = (await import('../src/utils/logger')).default;

        const result = await sendVerificationEmail({ name: 'Test', email: 'test@example.com' }, 'http://test');

        expect(result).toBe(true);
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Simulated email'));
    });

    it('production sin proveedor devuelve false y loguea error', async () => {
        process.env.TEST_MOCK_ENV = 'production';

        const { sendVerificationEmail } = await import('../src/services/email.service');
        const logger = (await import('../src/utils/logger')).default;

        const result = await sendVerificationEmail({ name: 'Test', email: 'test@example.com' }, 'http://test');

        expect(result).toBe(false);
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('CRITICAL ERROR'));
    });

    it('Resend resuelve con { error } en producción sin SMTP: detecta fallo, devuelve false y loguea el error con detalle', async () => {
        process.env.TEST_MOCK_ENV = 'production';
        process.env.TEST_MOCK_RESEND_KEY = 're_test_key';

        sendMock.mockResolvedValueOnce({
            data: null,
            error: { name: 'rate_limit_exceeded', message: 'Too many requests', statusCode: 429 }
        });

        const { sendVerificationEmail } = await import('../src/services/email.service');
        const logger = (await import('../src/utils/logger')).default;

        const result = await sendVerificationEmail({ name: 'Test', email: 'test@example.com' }, 'http://test');

        expect(result).toBe(false);
        expect(logger.info).not.toHaveBeenCalledWith(expect.stringContaining('Sent email via Resend'));
        expect(logger.error).toHaveBeenCalledWith(
            expect.stringContaining('Resend error'),
            expect.objectContaining({ name: 'rate_limit_exceeded', statusCode: 429 })
        );
    });

    it('Resend resuelve con { error } en desarrollo sin SMTP: no simula como éxito, devuelve false', async () => {
        process.env.TEST_MOCK_ENV = 'development';
        process.env.TEST_MOCK_RESEND_KEY = 're_test_key';

        sendMock.mockResolvedValueOnce({
            data: null,
            error: { name: 'rate_limit_exceeded', message: 'Too many requests', statusCode: 429 }
        });

        const { sendVerificationEmail } = await import('../src/services/email.service');
        const logger = (await import('../src/utils/logger')).default;

        const result = await sendVerificationEmail({ name: 'Test', email: 'test@example.com' }, 'http://test');

        expect(result).toBe(false);
        expect(logger.info).not.toHaveBeenCalledWith(expect.stringContaining('Sent email via Resend'));
        expect(logger.warn).not.toHaveBeenCalledWith(expect.stringContaining('Simulated email'));
    });
});
