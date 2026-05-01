import { describe, it, expect, vi } from 'vitest';
import { errorHandler } from '../src/middleware/errorHandler';
import logger from '../src/utils/logger';

vi.mock('../src/utils/logger', () => ({
    default: {
        error: vi.fn(),
    }
}));

describe('errorHandler', () => {
    it('truncates large strings and redacts sensitive keys in logs', () => {
        const largeString = 'a'.repeat(1000);
        
        const req = {
            method: 'POST',
            originalUrl: '/api/test',
            ip: '127.0.0.1',
            body: {
                photoUrl: 'this should be redacted entirely regardless of length',
                password: 'supersecretpassword',
                normalField: largeString,
                nested: {
                    token: 'redacted-token',
                    deepNormal: largeString
                }
            },
            query: {}
        } as any;
        
        const res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn()
        } as any;
        
        const err = new Error('Test Error') as any;

        errorHandler(err, req, res, vi.fn());

        expect(logger.error).toHaveBeenCalled();
        
        const logCallArg = vi.mocked(logger.error).mock.calls[0][1] as any;
        
        expect(logCallArg.body.photoUrl).toBe('[REDACTED]');
        expect(logCallArg.body.password).toBe('[REDACTED]');
        expect(logCallArg.body.nested.token).toBe('[REDACTED]');
        
        // Truncation check
        expect(logCallArg.body.normalField.length).toBe(514); // 500 + 14 chars of '...[TRUNCATED]'
        expect(logCallArg.body.normalField.endsWith('...[TRUNCATED]')).toBe(true);
        
        expect(logCallArg.body.nested.deepNormal.length).toBe(514);
        expect(logCallArg.body.nested.deepNormal.endsWith('...[TRUNCATED]')).toBe(true);
    });
});
