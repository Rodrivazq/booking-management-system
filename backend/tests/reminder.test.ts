import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock node-cron BEFORE importing the module under test so the
// schedule() call happens against the mock.
vi.mock('node-cron', () => ({
    default: {
        schedule: vi.fn(),
    },
}));

vi.mock('../src/utils/logger', () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('../src/utils/prisma', () => ({
    default: {
        settings: { findFirst: vi.fn() },
        user: { findMany: vi.fn() },
        reservation: { findMany: vi.fn() },
    },
}));

vi.mock('../src/config/env', () => ({
    SMTP: { host: undefined },
    RESEND_API_KEY: undefined,
    FRONTEND_URL: 'http://test',
}));

import cron from 'node-cron';
import { startReminderCron } from '../src/jobs/reminder';

describe('startReminderCron', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('schedules a daily 10 AM cron with America/Montevideo timezone', async () => {
        await startReminderCron();

        expect(cron.schedule).toHaveBeenCalledTimes(1);
        const call = vi.mocked(cron.schedule).mock.calls[0];

        // 1st arg: cron expression for daily at 10:00
        expect(call[0]).toBe('0 10 * * *');

        // 2nd arg: must be a function (the job body)
        expect(typeof call[1]).toBe('function');

        // 3rd arg: must include explicit timezone for Uruguay
        expect(call[2]).toEqual(expect.objectContaining({ timezone: 'America/Montevideo' }));
    });
});
