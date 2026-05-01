import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getCurrentMonday, getNextMonday, toDateStringUY, getNowUY } from '../src/utils/dates';

describe('Date Utilities (Timezone Aware)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // Helper to mock the exact UY wall time we want to test
    const setFakeTimeUY = (uyIsoString: string) => {
        // uyIsoString must be something like '2026-04-27T12:00:00'
        // By appending '-03:00', we explicitly tell V8 that this is a UY time
        // so the underlying system UTC time will be correctly offset.
        vi.setSystemTime(new Date(uyIsoString + '-03:00'));
    };

    describe('getNowUY', () => {
        it('returns a Date object that matches UY wall time locally', () => {
            setFakeTimeUY('2026-04-27T15:30:00'); // Lunes
            const now = getNowUY();
            
            expect(now.getFullYear()).toBe(2026);
            expect(now.getMonth()).toBe(3); // April is 3
            expect(now.getDate()).toBe(27);
            expect(now.getHours()).toBe(15);
            expect(now.getMinutes()).toBe(30);
            expect(toDateStringUY(now)).toBe('2026-04-27');
        });
    });

    describe('getCurrentMonday and getNextMonday', () => {
        it('lunes: current = lunes actual, next = lunes siguiente', () => {
            setFakeTimeUY('2026-04-27T12:00:00'); // Lunes 27 de Abril 2026
            expect(getCurrentMonday()).toBe('2026-04-27');
            expect(getNextMonday()).toBe('2026-05-04');
        });

        it('viernes: current = lunes actual, next = lunes siguiente', () => {
            setFakeTimeUY('2026-05-01T12:00:00'); // Viernes 1 de Mayo 2026
            expect(getCurrentMonday()).toBe('2026-04-27');
            expect(getNextMonday()).toBe('2026-05-04');
        });

        it('sábado: current = lunes inminente, next = lunes subsiguiente', () => {
            setFakeTimeUY('2026-05-02T12:00:00'); // Sábado 2 de Mayo 2026
            expect(getCurrentMonday()).toBe('2026-05-04');
            expect(getNextMonday()).toBe('2026-05-11');
        });

        it('domingo: current = lunes inminente, next = lunes subsiguiente', () => {
            setFakeTimeUY('2026-05-03T12:00:00'); // Domingo 3 de Mayo 2026
            expect(getCurrentMonday()).toBe('2026-05-04');
            expect(getNextMonday()).toBe('2026-05-11');
        });
    });
});
