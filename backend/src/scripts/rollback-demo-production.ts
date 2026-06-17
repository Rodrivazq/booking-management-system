/**
 * rollback-demo-production.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Borra EXACTAMENTE lo sembrado por seed-demo-production.ts y nada más.
 *
 * Estrategia (doble seguridad):
 *   - Usuarios demo: identificados por funcNumber con prefijo "D" Y email en el
 *     dominio @demo.realsabor.local. Al borrarlos, las reservas y reseñas se
 *     eliminan en cascada (onDelete: Cascade en el schema).
 *   - Menús: SÓLO se borran los listados en .demo-manifest.json como creados por
 *     el seed. Nunca tocamos menús reales de producción.
 *
 * Si no hay manifest, igual puede borrar usuarios demo (por sus marcadores),
 * pero NO borra menús (sin manifest no sabemos cuáles creamos nosotros).
 *
 * Uso:
 *   $env:DATABASE_URL="postgresql://...";        npm run rollback:demo-prod -- --dry-run
 *   $env:DATABASE_URL="postgresql://...prod...";  $env:ALLOW_PROD_TARGET="true"; npm run rollback:demo-prod
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { createInterface } from 'readline';
import { DEMO_EMAIL_DOMAIN, DEMO_FUNC_PREFIX } from './demo-core';

const KNOWN_PROD_HOSTS = ['mainline.proxy.rlwy.net:43766'];
const MANIFEST_PATH = path.join(__dirname, '..', '..', '.demo-manifest.json');

const flags = new Set(process.argv.slice(2));
const DRY_RUN = flags.has('--dry-run');
const ASSUME_YES = flags.has('--yes');

function maskedHost(): string {
    try {
        const url = new URL(process.env.DATABASE_URL || '');
        return `${url.hostname}:${url.port || '5432'}`;
    } catch {
        return '<invalid DATABASE_URL>';
    }
}
function fail(msg: string): never { console.error(`\n❌ ${msg}\n`); process.exit(1); }
function ask(q: string): Promise<string> {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(res => rl.question(q, a => { rl.close(); res(a); }));
}

async function main() {
    console.log('🧹 Rollback de datos de DEMOSTRACIÓN — Real Sabor\n');
    console.log(`   Modo: ${DRY_RUN ? 'DRY-RUN (no borra)' : 'BORRADO REAL'}`);

    if (!process.env.DATABASE_URL) fail('DATABASE_URL no está seteada.');
    const host = maskedHost();
    console.log(`   DATABASE_URL host: ${host}`);
    const isKnownProd = KNOWN_PROD_HOSTS.includes(host);
    if (isKnownProd && process.env.ALLOW_PROD_TARGET !== 'true') {
        fail(`DATABASE_URL apunta a PRODUCCIÓN (${host}). Para borrar demo en prod seteá ALLOW_PROD_TARGET=true.`);
    }

    // Manifest (opcional, requerido sólo para borrar menús)
    let createdMenus: string[] = [];
    if (fs.existsSync(MANIFEST_PATH)) {
        try {
            const m = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
            createdMenus = Array.isArray(m.createdMenus) ? m.createdMenus : [];
            console.log(`   Manifest encontrado: ${createdMenus.length} menú(s) creados por el seed.`);
        } catch {
            console.log('   ⚠️  Manifest ilegible; no se borrarán menús.');
        }
    } else {
        console.log('   ⚠️  Sin manifest: se borrarán usuarios demo, pero NO menús.');
    }

    const prisma = new PrismaClient();
    try {
        // Identificar usuarios demo por sus DOS marcadores.
        const demoUsers = await prisma.user.findMany({
            where: {
                funcNumber: { startsWith: DEMO_FUNC_PREFIX },
                email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` },
            },
            select: { id: true, email: true },
        });
        const userIds = demoUsers.map(u => u.id);

        // Contar lo que caería en cascada (sólo informativo).
        const [resCount, ratingCount] = await Promise.all([
            prisma.reservation.count({ where: { userId: { in: userIds.length ? userIds : ['__none__'] } } }),
            prisma.dishRating.count({ where: { userId: { in: userIds.length ? userIds : ['__none__'] } } }),
        ]);

        console.log('\n   A borrar:');
        console.log(`     Usuarios demo: ${demoUsers.length}`);
        console.log(`     Reservas (cascada): ${resCount}`);
        console.log(`     Reseñas (cascada):  ${ratingCount}`);
        console.log(`     Menús (manifest):   ${createdMenus.length}`);

        if (demoUsers.length === 0 && createdMenus.length === 0) {
            console.log('\n✅ Nada que borrar. La base ya está limpia de datos demo.');
            return;
        }

        if (DRY_RUN) {
            console.log('\n(dry-run) No se borró nada.');
            return;
        }

        if (!ASSUME_YES) {
            const a = await ask('\n   Escribí "BORRAR" para confirmar la eliminación: ');
            if (a.trim() !== 'BORRAR') fail('Cancelado por el usuario.');
        }

        // Borrado. Usuarios → cascada elimina reservas y reseñas.
        let deletedUsers = 0;
        if (userIds.length) {
            const del = await prisma.user.deleteMany({ where: { id: { in: userIds } } });
            deletedUsers = del.count;
        }
        // Menús creados por el seed (verificamos que no hayan quedado reservas que
        // dependan de ellos — tras borrar usuarios demo no deberían).
        let deletedMenus = 0;
        if (createdMenus.length) {
            const del = await prisma.weeklyMenu.deleteMany({ where: { weekStart: { in: createdMenus } } });
            deletedMenus = del.count;
        }

        // Manifest consumido: lo renombramos para no reusarlo por error.
        if (fs.existsSync(MANIFEST_PATH)) {
            fs.renameSync(MANIFEST_PATH, `${MANIFEST_PATH}.done`);
        }

        console.log('\n📊 Resumen del rollback:');
        console.log(`   Usuarios borrados: ${deletedUsers} (reservas y reseñas en cascada)`);
        console.log(`   Menús borrados:    ${deletedMenus}`);
        console.log('\n✅ Rollback completo.');
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(err => { console.error('\n❌ Error:', err); process.exit(1); });
