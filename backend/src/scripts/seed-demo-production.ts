/**
 * seed-demo-production.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Siembra un dataset de DEMOSTRACIÓN realista y BORRABLE para mostrar la app
 * "operativa" a la empresa: usuarios simulados, reservas de varias semanas y
 * reseñas coherentes (no al azar) que se reflejan en los reportes.
 *
 * Toda la lógica de generación vive en `demo/demo-core.ts` (pura, testeada).
 * Este script sólo orquesta contra la DB: lee qué existe y persiste lo que
 * falta de forma IDEMPOTENTE, dejando un manifest para el rollback quirúrgico.
 *
 * Cumple la regla 12 del proyecto (scripts que tocan producción):
 *   1. Idempotencia       → comprobada con tests + re-ejecuciones no duplican.
 *   2. Confirmación        → exige escribir "CONFIRMO" en runtime (salvo --yes).
 *   3. Dry-run             → --dry-run (lee, no escribe) y --plan-only (sin DB).
 *   4. Rollback            → rollback-demo-production.ts borra exactamente esto.
 *   5. Reporte estructurado→ creados / saltados / fallidos al final.
 *
 * Marcadores de demo (para rollback seguro, ver demo-core):
 *   - email  @demo.realsabor.local   (.local: jamás enrutable, no se envía mail)
 *   - funcNumber  prefijo "D"
 *   - preferences contiene __DEMO_REAL_SABOR__
 *
 * Uso:
 *   # Sin DB, sólo muestra qué generaría:
 *   npm run seed:demo-prod -- --plan-only
 *
 *   # Contra staging (lee, no escribe):
 *   $env:DATABASE_URL="postgresql://...staging..."; npm run seed:demo-prod -- --dry-run
 *
 *   # Ejecución real contra staging:
 *   $env:DATABASE_URL="postgresql://...staging..."; npm run seed:demo-prod
 *
 *   # Contra PRODUCCIÓN (requiere flag explícito + confirmación):
 *   $env:DATABASE_URL="postgresql://...prod..."; $env:ALLOW_PROD_TARGET="true"; npm run seed:demo-prod
 *
 * Variables opcionales: DEMO_USER_COUNT (def 35), DEMO_WEEKS (def 6),
 *   DEMO_PASSWORD (def "DemoRealSabor2026!").
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { createInterface } from 'readline';
import { getCurrentMonday, getNowUY, toDateStringUY } from '../utils/dates';
import {
    buildDemoUsers,
    buildWeekMenu,
    buildUserWeekData,
    DAYS,
    DEMO_EMAIL_DOMAIN,
    DEMO_FUNC_PREFIX,
    DEMO_PREF_TAG,
    type Day,
    type DemoUser,
    type MenuDays,
} from './demo-core';

// Hosts de producción conocidos (misma convención que seed-demo-ratings).
const KNOWN_PROD_HOSTS = ['mainline.proxy.rlwy.net:43766'];
const MANIFEST_PATH = path.join(__dirname, '..', '..', '.demo-manifest.json');
const DEFAULT_PASSWORD = process.env.DEMO_PASSWORD || 'DemoRealSabor2026!';
const USER_COUNT = Number(process.env.DEMO_USER_COUNT || 35);
const WEEK_COUNT = Number(process.env.DEMO_WEEKS || 6);

const flags = new Set(process.argv.slice(2));
const DRY_RUN = flags.has('--dry-run');
const PLAN_ONLY = flags.has('--plan-only');
const ASSUME_YES = flags.has('--yes');

function maskedHost(): string {
    try {
        const url = new URL(process.env.DATABASE_URL || '');
        return `${url.hostname}:${url.port || '5432'}`;
    } catch {
        return '<invalid DATABASE_URL>';
    }
}

function fail(msg: string): never {
    console.error(`\n❌ ${msg}\n`);
    process.exit(1);
}

function ask(question: string): Promise<string> {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(res => rl.question(question, a => { rl.close(); res(a); }));
}

// ─── Fechas: semanas operativas (lunes) hacia atrás, sin drift de TZ ─────────
function addDaysToDateStr(dateStr: string, n: number): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + n);
    return toDateStringUY(new Date(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
}

// weekStarts: [másViejo ... semanaActual]. WEEK_COUNT semanas terminando en la actual.
function buildWeekStarts(count: number): string[] {
    const current = getCurrentMonday();
    const weeks: string[] = [];
    for (let i = count - 1; i >= 0; i--) weeks.push(addDaysToDateStr(current, -7 * i));
    return weeks;
}

// Días ya servidos de una semana (elegibles para calificar). Para semanas
// pasadas son los 5; para la actual, sólo hasta hoy (regla 6: no futuros).
function elapsedDaysFor(weekStart: string, todayStr: string): Day[] {
    const out: Day[] = [];
    DAYS.forEach((day, idx) => {
        if (addDaysToDateStr(weekStart, idx) <= todayStr) out.push(day);
    });
    return out;
}

// ¿El menú real de prod sirve tal cual? (5 días con >=1 comida y >=1 postre)
function isUsableMenu(days: any): days is MenuDays {
    if (!days || typeof days !== 'object') return false;
    return DAYS.every(d => days[d] && Array.isArray(days[d].meals) && days[d].meals.length >= 1
        && Array.isArray(days[d].desserts) && days[d].desserts.length >= 1);
}

type Report = {
    usersCreated: number; usersSkipped: number;
    menusCreated: number; menusReused: number;
    reservationsCreated: number; reservationsSkipped: number;
    ratingsCreated: number; ratingsSkipped: number;
    failures: string[];
    createdMenus: string[];
};

async function main() {
    console.log('🎬 Seed de DEMOSTRACIÓN — Real Sabor\n');
    console.log(`   Modo:        ${PLAN_ONLY ? 'PLAN-ONLY (sin DB)' : DRY_RUN ? 'DRY-RUN (lee, no escribe)' : 'EJECUCIÓN REAL'}`);
    console.log(`   Usuarios:    ${USER_COUNT}`);
    console.log(`   Semanas:     ${WEEK_COUNT}`);

    const todayStr = toDateStringUY(getNowUY());
    const weekStarts = buildWeekStarts(WEEK_COUNT);
    const users = buildDemoUsers(USER_COUNT);
    console.log(`   Hoy (UY):    ${todayStr}`);
    console.log(`   Semanas:     ${weekStarts.join(', ')}\n`);

    // ── PLAN-ONLY: estima sin tocar la DB ────────────────────────────────────
    if (PLAN_ONLY) {
        let reservations = 0, ratings = 0;
        for (let w = 0; w < weekStarts.length; w++) {
            const ws = weekStarts[w];
            const menu = buildWeekMenu(w);
            const elapsed = elapsedDaysFor(ws, todayStr);
            for (const u of users) {
                const data = buildUserWeekData(u, ws, menu, elapsed);
                if (!data.reserve) continue;
                reservations++;
                ratings += data.ratings.length;
            }
        }
        console.log('📋 Plan estimado (menús de catálogo, sin contemplar menús reales de prod):');
        console.log(`   Usuarios demo:   ${users.length}`);
        console.log(`   Reservas:        ~${reservations}`);
        console.log(`   Reseñas:         ~${ratings}`);
        console.log(`\n   Ejemplo de login: ${users[0].email}  /  ${DEFAULT_PASSWORD}`);
        console.log('\n(plan-only) No se conectó a ninguna base de datos.');
        return;
    }

    // ── Validación de entorno + guardas de producción ────────────────────────
    if (!process.env.DATABASE_URL) fail('DATABASE_URL no está seteada.');
    const host = maskedHost();
    console.log(`   DATABASE_URL host: ${host}`);
    const isKnownProd = KNOWN_PROD_HOSTS.includes(host);
    if (isKnownProd && process.env.ALLOW_PROD_TARGET !== 'true') {
        fail(`DATABASE_URL apunta a PRODUCCIÓN conocida (${host}). Para sembrar demo en prod seteá ALLOW_PROD_TARGET=true. Abortado por defecto.`);
    }

    if (!DRY_RUN && !ASSUME_YES) {
        const target = isKnownProd ? 'PRODUCCIÓN' : `el host ${host}`;
        console.log(`\n⚠️  Vas a ESCRIBIR datos de demo en ${target}.`);
        console.log('   Son borrables luego con: npm run rollback:demo-prod');
        const a = await ask('   Escribí "CONFIRMO" para continuar: ');
        if (a.trim() !== 'CONFIRMO') fail('Cancelado por el usuario.');
    }

    const prisma = new PrismaClient();
    const report: Report = {
        usersCreated: 0, usersSkipped: 0, menusCreated: 0, menusReused: 0,
        reservationsCreated: 0, reservationsSkipped: 0, ratingsCreated: 0, ratingsSkipped: 0,
        failures: [], createdMenus: [],
    };
    const demoUserIds = new Map<string, string>(); // funcNumber -> id

    try {
        // 1) Usuarios demo (idempotente por funcNumber/email)
        const passwordHash = bcrypt.hashSync(DEFAULT_PASSWORD, 10);
        for (const u of users) {
            try {
                const existing = await prisma.user.findFirst({
                    where: { OR: [{ funcNumber: u.funcNumber }, { email: u.email }] },
                    select: { id: true },
                });
                if (existing) {
                    demoUserIds.set(u.funcNumber, existing.id);
                    report.usersSkipped++;
                    continue;
                }
                if (DRY_RUN) {
                    // Id sintético para que la estimación de actividad sea fiel.
                    demoUserIds.set(u.funcNumber, `dry:${u.funcNumber}`);
                    report.usersCreated++;
                    continue;
                }
                const created = await prisma.user.create({
                    data: {
                        email: u.email, name: u.name, passwordHash, role: 'user',
                        funcNumber: u.funcNumber, documentId: u.documentId,
                        phoneNumber: u.phoneNumber, isEmailVerified: true,
                        preferences: DEMO_PREF_TAG,
                    },
                    select: { id: true },
                });
                demoUserIds.set(u.funcNumber, created.id);
                report.usersCreated++;
            } catch (e: any) {
                report.failures.push(`user ${u.funcNumber}: ${String(e?.message).slice(0, 200)}`);
            }
        }

        // 2) Por semana: menú (reusar real o crear de catálogo) + actividad
        for (let w = 0; w < weekStarts.length; w++) {
            const ws = weekStarts[w];
            const elapsed = elapsedDaysFor(ws, todayStr);

            // Menú efectivo: el real de prod si es usable; si no, uno de catálogo.
            let menu: MenuDays;
            const existingMenu = await prisma.weeklyMenu.findUnique({ where: { weekStart: ws } });
            if (existingMenu) {
                let parsed: any = null;
                try { parsed = JSON.parse(existingMenu.days); } catch { /* ignore */ }
                if (isUsableMenu(parsed)) {
                    menu = parsed;
                    report.menusReused++;
                } else {
                    menu = buildWeekMenu(w);
                    report.menusReused++; // existe pero no lo tocamos; usamos catálogo p/ selecciones
                }
            } else {
                menu = buildWeekMenu(w);
                if (!DRY_RUN) {
                    await prisma.weeklyMenu.create({
                        data: { weekStart: ws, days: JSON.stringify(menu), breadAvailable: true },
                    });
                }
                report.menusCreated++;
                report.createdMenus.push(ws);
            }

            // Actividad por usuario
            for (const u of users) {
                const userId = demoUserIds.get(u.funcNumber);
                if (!userId) continue; // falló su creación o dry-run sin id
                const data = buildUserWeekData(u, ws, menu, elapsed);
                if (!data.reserve) continue;

                try {
                    let reservationId: string | null = null;
                    const existingRes = await prisma.reservation.findUnique({
                        where: { userId_weekStart: { userId, weekStart: ws } },
                        select: { id: true },
                    });
                    if (existingRes) {
                        reservationId = existingRes.id;
                        report.reservationsSkipped++;
                    } else if (DRY_RUN) {
                        report.reservationsCreated++;
                    } else {
                        const r = await prisma.reservation.create({
                            data: {
                                userId, weekStart: ws, timeSlot: data.timeSlot,
                                selections: JSON.stringify(data.selections),
                            },
                            select: { id: true },
                        });
                        reservationId = r.id;
                        report.reservationsCreated++;
                    }

                    // Reseñas (idempotente por unique compuesto)
                    if (data.ratings.length === 0) continue;
                    if (DRY_RUN || !reservationId) {
                        report.ratingsCreated += data.ratings.length; // estimación dry-run
                        continue;
                    }
                    const result = await prisma.dishRating.createMany({
                        data: data.ratings.map(rt => ({
                            userId, reservationId: reservationId!, weekStart: ws,
                            day: rt.day, itemType: rt.itemType, itemName: rt.itemName, rating: rt.rating,
                        })),
                        skipDuplicates: true,
                    });
                    report.ratingsCreated += result.count;
                    report.ratingsSkipped += data.ratings.length - result.count;
                } catch (e: any) {
                    report.failures.push(`activity ${u.funcNumber}/${ws}: ${String(e?.message).slice(0, 200)}`);
                }
            }
            console.log(`   ✓ Semana ${ws} procesada (${elapsed.length} día(s) calificable(s)).`);
        }

        // 3) Manifest para rollback (sólo ejecución real)
        if (!DRY_RUN) {
            const manifest = {
                marker: 'real-sabor-demo',
                createdAt: new Date().toISOString(),
                demoEmailDomain: DEMO_EMAIL_DOMAIN,
                demoFuncPrefix: DEMO_FUNC_PREFIX,
                demoPrefTag: DEMO_PREF_TAG,
                userCount: USER_COUNT,
                weeks: weekStarts,
                createdMenus: report.createdMenus,
                sampleLogin: { email: users[0].email, password: DEFAULT_PASSWORD },
            };
            fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
        }

        // 4) Reporte estructurado
        console.log('\n📊 Resumen' + (DRY_RUN ? ' (DRY-RUN, nada escrito)' : '') + ':');
        console.log(`   Usuarios:    ${report.usersCreated} creados, ${report.usersSkipped} ya existían`);
        console.log(`   Menús:       ${report.menusCreated} creados, ${report.menusReused} reutilizados`);
        console.log(`   Reservas:    ${report.reservationsCreated} creadas, ${report.reservationsSkipped} ya existían`);
        console.log(`   Reseñas:     ${report.ratingsCreated} creadas, ${report.ratingsSkipped} ya existían`);
        if (report.failures.length) {
            console.log(`   ⚠️  Fallidos: ${report.failures.length}`);
            report.failures.slice(0, 10).forEach(f => console.log(`      - ${f}`));
        }
        if (!DRY_RUN) {
            console.log(`\n   Manifest:    ${MANIFEST_PATH}`);
            console.log(`   Login demo:  ${users[0].email}  /  ${DEFAULT_PASSWORD}`);
            console.log('   Rollback:    npm run rollback:demo-prod');
        }
        console.log('\n🎉 Listo. Revisá Admin → Reportes y la sección Calificaciones.');
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(err => { console.error('\n❌ Error:', err); process.exit(1); });
