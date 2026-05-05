/**
 * Seeds demo data for showing the ratings + reports flow:
 *   1. A WeeklyMenu for LAST week (so ratings are eligible — ratings can only
 *      be made on dishes already served).
 *   2. A Reservation for that past week for every existing 'user' (skips
 *      admin/superadmin) — uses the same selections so the aggregated reports
 *      have meaningful totals.
 *   3. A DishRating per dish per user with a variable distribution
 *      (~60% liked, ~25% neutral, ~15% disliked) so the report is not
 *      uniform.
 *
 * Usage (idempotent — safe to re-run):
 *
 *   $env:DATABASE_URL = "postgresql://...staging..."
 *   npm run seed:demo-ratings
 *
 * Salvaguardas:
 *   - Refuse if DATABASE_URL host is in KNOWN_PROD_HOSTS unless
 *     ALLOW_PROD_TARGET=true (the same convention as backup-rehearsal).
 *   - Interactive confirmation before any write.
 *   - Only seeds for users with role='user' and at least one user must
 *     exist in the DB.
 *   - Uses upsert / skipDuplicates so re-running doesn't duplicate.
 */

import { PrismaClient } from '@prisma/client';
import { createInterface } from 'readline';

const KNOWN_PROD_HOSTS = ['mainline.proxy.rlwy.net:43766'];

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
    return new Promise(resolveAsk => {
        rl.question(question, answer => {
            rl.close();
            resolveAsk(answer);
        });
    });
}

const prisma = new PrismaClient();

const DAYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];

// Variable distribution so the report is informative (~60/25/15).
function pickRating(): 'liked' | 'neutral' | 'disliked' {
    const r = Math.random();
    if (r < 0.60) return 'liked';
    if (r < 0.85) return 'neutral';
    return 'disliked';
}

function lastMondayString(): string {
    const today = new Date();
    const day = today.getDay(); // 0=Sun..6=Sat
    // Days back to last week's Monday
    const diff = day === 0 ? 13 : day + 6;
    const lastMonday = new Date(today);
    lastMonday.setDate(today.getDate() - diff);
    const yyyy = lastMonday.getFullYear();
    const mm = String(lastMonday.getMonth() + 1).padStart(2, '0');
    const dd = String(lastMonday.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

const DEMO_MENU = {
    lunes:     { meals: ['Milanesa con puré', 'Pollo grillé', 'Ensalada césar'], desserts: ['Flan casero', 'Fruta fresca', 'Yogur con granola'] },
    martes:    { meals: ['Pasta al pesto', 'Pescado al limón', 'Wrap vegetariano'], desserts: ['Helado', 'Mousse de chocolate', 'Manzana asada'] },
    miercoles: { meals: ['Carne al horno', 'Risotto de hongos', 'Tacos de pollo'], desserts: ['Cheesecake', 'Brownie', 'Fruta fresca'] },
    jueves:    { meals: ['Hamburguesa casera', 'Curry de garbanzos', 'Fideos salteados'], desserts: ['Tiramisú', 'Helado', 'Yogur con granola'] },
    viernes:   { meals: ['Pizza artesanal', 'Sushi bowl', 'Lasagna vegetal'], desserts: ['Brownie', 'Panqueques', 'Fruta fresca'] },
};

async function main() {
    if (!process.env.DATABASE_URL) {
        fail('DATABASE_URL no está seteada.');
    }

    const host = maskedHost();
    console.log('🎬 Seed de demo: ratings y reservas de la semana anterior\n');
    console.log(`   DATABASE_URL host: ${host}`);

    if (KNOWN_PROD_HOSTS.includes(host) && process.env.ALLOW_PROD_TARGET !== 'true') {
        fail(`DATABASE_URL apunta a un host de PRODUCCIÓN conocido (${host}). Para correr contra prod (no recomendado), seteá ALLOW_PROD_TARGET=true. Abortando por defecto.`);
    }

    const weekStart = lastMondayString();
    console.log(`   Semana objetivo: ${weekStart} (lunes pasado)\n`);

    const answer = await ask('¿Continuar? Esto crea/actualiza menú, reservas y ratings para esa semana. (escribí "si"): ');
    if (answer.trim().toLowerCase() !== 'si' && answer.trim().toLowerCase() !== 'sí') {
        fail('Cancelado por el usuario.');
    }

    // 1. Upsert menu for last week
    const menuJson = JSON.stringify(DEMO_MENU);
    const menu = await prisma.weeklyMenu.upsert({
        where: { weekStart },
        update: { days: menuJson },
        create: { weekStart, days: menuJson, breadAvailable: true },
    });
    console.log(`✅ Menú de la semana ${menu.weekStart} listo.`);

    // 2. Find regular users (role=user). Skip admin/superadmin so demo
    // doesn't pollute the admin's own profile.
    const users = await prisma.user.findMany({
        where: { role: 'user', isEmailVerified: true },
        select: { id: true, name: true, email: true },
    });

    if (users.length === 0) {
        fail('No hay usuarios con role="user" e isEmailVerified=true en la DB. Cargá usuarios primero (CSV import) y reintentá.');
    }
    console.log(`   ${users.length} usuario(s) encontrados para datos demo.`);

    // 3. For each user: create reservation + ratings (idempotent)
    let reservationsCreated = 0;
    let reservationsSkipped = 0;
    let ratingsCreated = 0;
    let ratingsSkipped = 0;

    for (const user of users) {
        // Pick a "random" but stable selection per user
        const seed = user.id.charCodeAt(0) + user.id.charCodeAt(user.id.length - 1);
        const selections = DAYS.map((day, idx) => {
            const dayMenu = DEMO_MENU[day as keyof typeof DEMO_MENU];
            const mealIdx = (seed + idx) % dayMenu.meals.length;
            const dessertIdx = (seed + idx * 2) % dayMenu.desserts.length;
            return {
                day,
                meal: dayMenu.meals[mealIdx],
                dessert: dayMenu.desserts[dessertIdx],
                bread: (seed + idx) % 2 === 0,
            };
        });

        // Reservation upsert (unique on userId+weekStart)
        const existingRes = await prisma.reservation.findUnique({
            where: { userId_weekStart: { userId: user.id, weekStart } },
        });

        let reservation;
        if (existingRes) {
            reservation = existingRes;
            reservationsSkipped++;
        } else {
            reservation = await prisma.reservation.create({
                data: {
                    userId: user.id,
                    weekStart,
                    timeSlot: '12:00',
                    selections: JSON.stringify(selections),
                },
            });
            reservationsCreated++;
        }

        // Ratings: one per dish (meal + dessert) per day
        for (const sel of selections) {
            for (const itemType of ['meal', 'dessert'] as const) {
                const itemName = itemType === 'meal' ? sel.meal : sel.dessert;
                const existingRating = await prisma.dishRating.findUnique({
                    where: {
                        userId_weekStart_day_itemType_itemName: {
                            userId: user.id,
                            weekStart,
                            day: sel.day,
                            itemType,
                            itemName,
                        },
                    },
                });
                if (existingRating) {
                    ratingsSkipped++;
                    continue;
                }
                await prisma.dishRating.create({
                    data: {
                        userId: user.id,
                        reservationId: reservation.id,
                        weekStart,
                        day: sel.day,
                        itemType,
                        itemName,
                        rating: pickRating(),
                    },
                });
                ratingsCreated++;
            }
        }
    }

    console.log('\n📊 Resumen:');
    console.log(`   Reservas:    ${reservationsCreated} creadas, ${reservationsSkipped} ya existían`);
    console.log(`   Ratings:     ${ratingsCreated} creados, ${ratingsSkipped} ya existían`);
    console.log(`\n🎉 Seed completo. Ingresá al panel admin → Reportes → vista "Esta semana" en la sección Calificaciones (semana ${weekStart}).`);
}

main()
    .catch(err => {
        console.error('\n❌ Error:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
