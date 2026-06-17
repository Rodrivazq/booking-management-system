/**
 * Tests de la lógica pura de generación de datos demo.
 * Cubren el requisito de la regla 12: "idempotencia comprobada con tests".
 * No tocan la base de datos (la lógica es pura y determinística).
 */
import { describe, it, expect } from 'vitest';
import {
    buildDemoUsers,
    buildWeekMenu,
    buildUserWeekData,
    buildSelections,
    profileForDish,
    pickRating,
    userReservesWeek,
    DAYS,
    DISH_PROFILES,
    DEMO_EMAIL_DOMAIN,
    DEMO_FUNC_PREFIX,
    type Day,
} from '../src/scripts/demo-core';

const WEEK = '2026-06-15';
const ALL_DAYS = [...DAYS] as Day[];

describe('demo-core · usuarios', () => {
    it('genera la cantidad pedida con marcadores de demo', () => {
        const users = buildDemoUsers(35);
        expect(users).toHaveLength(35);
        for (const u of users) {
            expect(u.email.endsWith(`@${DEMO_EMAIL_DOMAIN}`)).toBe(true);
            expect(u.funcNumber.startsWith(DEMO_FUNC_PREFIX)).toBe(true);
            expect(u.documentId.startsWith('9')).toBe(true); // rango ficticio
        }
    });

    it('emails y funcNumbers son únicos', () => {
        const users = buildDemoUsers(40);
        expect(new Set(users.map(u => u.email)).size).toBe(40);
        expect(new Set(users.map(u => u.funcNumber)).size).toBe(40);
        expect(new Set(users.map(u => u.documentId)).size).toBe(40);
    });

    it('es determinístico entre llamadas (idempotencia)', () => {
        expect(buildDemoUsers(20)).toEqual(buildDemoUsers(20));
    });
});

describe('demo-core · menús', () => {
    it('cada día ofrece 3 comidas y 3 postres distintos', () => {
        const menu = buildWeekMenu(0);
        for (const d of ALL_DAYS) {
            expect(new Set(menu[d].meals).size).toBe(3);
            expect(new Set(menu[d].desserts).size).toBe(3);
        }
    });

    it('es determinístico', () => {
        expect(buildWeekMenu(3)).toEqual(buildWeekMenu(3));
    });
});

describe('demo-core · reseñas no aleatorias', () => {
    it('pickRating es determinístico para la misma clave', () => {
        const p = DISH_PROFILES['Milanesa con puré'];
        const a = pickRating('k|x|y', p);
        const b = pickRating('k|x|y', p);
        expect(a).toBe(b);
    });

    it('respeta el perfil: un plato muy querido domina "liked"', () => {
        // Muestreamos sobre muchas claves y verificamos la tendencia.
        const beloved = DISH_PROFILES['Brownie'];     // liked 0.85
        const divisive = DISH_PROFILES['Pescado al limon']; // liked 0.40
        const count = (profile: typeof beloved) => {
            let liked = 0;
            for (let i = 0; i < 2000; i++) {
                if (pickRating(`s|${i}`, profile) === 'liked') liked++;
            }
            return liked / 2000;
        };
        const belovedLiked = count(beloved);
        const divisiveLiked = count(divisive);
        expect(belovedLiked).toBeGreaterThan(0.75);
        expect(belovedLiked).toBeLessThan(0.95);
        expect(divisiveLiked).toBeLessThan(0.55);
        expect(belovedLiked).toBeGreaterThan(divisiveLiked + 0.2);
    });

    it('profileForDish cae a heurística/ default para platos desconocidos', () => {
        expect(profileForDish('Pescado a la plancha').disliked).toBeGreaterThan(0.2); // negativo
        expect(profileForDish('Milanesa napolitana').liked).toBeGreaterThan(0.6);     // positivo
        const def = profileForDish('Plato totalmente nuevo XYZ');
        expect(def.liked + def.neutral + def.disliked).toBeCloseTo(1, 5);
    });
});

describe('demo-core · actividad por usuario/semana', () => {
    const users = buildDemoUsers(30);
    const menu = buildWeekMenu(0);

    it('buildUserWeekData es determinístico (re-ejecutar no cambia nada)', () => {
        const u = users[0];
        const a = buildUserWeekData(u, WEEK, menu, ALL_DAYS);
        const b = buildUserWeekData(u, WEEK, menu, ALL_DAYS);
        expect(a).toEqual(b);
    });

    it('si el usuario no reserva, no genera selecciones ni reseñas', () => {
        // Buscamos un usuario que no reserve esa semana.
        const nonReserver = users.find(u => !userReservesWeek(u, WEEK));
        if (nonReserver) {
            const data = buildUserWeekData(nonReserver, WEEK, menu, ALL_DAYS);
            expect(data.reserve).toBe(false);
            expect(data.selections).toHaveLength(0);
            expect(data.ratings).toHaveLength(0);
        }
    });

    it('sólo califica días ya servidos (no futuros)', () => {
        const reserver = users.find(u => userReservesWeek(u, WEEK))!;
        const elapsed: Day[] = ['lunes', 'martes']; // simulamos semana en curso
        const data = buildUserWeekData(reserver, WEEK, menu, elapsed);
        expect(data.selections).toHaveLength(5);     // reserva los 5 días
        for (const r of data.ratings) {
            expect(elapsed).toContain(r.day);        // pero sólo califica los servidos
        }
    });

    it('cada reseña corresponde a un plato efectivamente reservado ese día', () => {
        const reserver = users.find(u => userReservesWeek(u, WEEK))!;
        const data = buildUserWeekData(reserver, WEEK, menu, ALL_DAYS);
        for (const r of data.ratings) {
            const sel = data.selections.find(s => s.day === r.day)!;
            const reserved = r.itemType === 'meal' ? sel.meal : sel.dessert;
            expect(r.itemName).toBe(reserved);
        }
    });

    it('las selecciones usan opciones del menú vigente', () => {
        const reserver = users.find(u => userReservesWeek(u, WEEK))!;
        const sels = buildSelections(reserver, WEEK, menu);
        for (const s of sels) {
            expect(menu[s.day].meals).toContain(s.meal);
            expect(menu[s.day].desserts).toContain(s.dessert);
        }
    });

    it('a nivel agregado, una fracción razonable de usuarios reserva', () => {
        const reservers = users.filter(u => userReservesWeek(u, WEEK)).length;
        expect(reservers).toBeGreaterThan(users.length * 0.5);
        expect(reservers).toBeLessThanOrEqual(users.length);
    });
});
