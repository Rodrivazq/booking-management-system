import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock env to guarantee no real providers are loaded during these tests
vi.mock('../src/config/env', () => {
    return {
        // We use a getter to dynamically change the environment per-test
        get NODE_ENV() { return process.env.TEST_MOCK_ENV || 'development'; },
        SMTP: { host: undefined },
        RESEND_API_KEY: undefined,
        FRONTEND_URL: 'http://test'
    };
});

// Important: we have to import the actual module so we can test its logic
import { sendVerificationEmail } from '../src/services/email.service';
import logger from '../src/utils/logger';

// Mock logger to prevent console clutter during tests
vi.mock('../src/utils/logger', () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

describe('Email Service', () => {
    afterEach(() => {
        delete process.env.TEST_MOCK_ENV;
        vi.clearAllMocks();
    });

    it('development sin proveedor simula éxito', async () => {
        // Enforce development
        process.env.TEST_MOCK_ENV = 'development';

        const result = await sendVerificationEmail({ name: 'Test', email: 'test@example.com' }, 'http://test');
        
        expect(result).toBe(true);
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Simulated email'));
    });

    it('production sin proveedor devuelve false y loguea error', async () => {
        // Enforce production
        process.env.TEST_MOCK_ENV = 'production';

        const result = await sendVerificationEmail({ name: 'Test', email: 'test@example.com' }, 'http://test');
        
        expect(result).toBe(false);
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('CRITICAL ERROR'));
    });
});
