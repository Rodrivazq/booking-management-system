/**
 * Rehearsal de backup/restore: dump de origen → restore a destino.
 *
 * Diseñado para:
 *   - Ensayo previo al lanzamiento (cierre LAUNCH_PLAN del 4/5):
 *     pg_dump producción → pg_restore staging.
 *   - Backup operativo (sin restore): el dump queda en backups/ con
 *     timestamp y se puede archivar.
 *   - Recovery de emergencia: pg_dump del backup de un día anterior
 *     (si lo tenés guardado) → pg_restore producción.
 *
 * Salvaguardas críticas:
 *   1. Refuse si SOURCE_URL == TARGET_URL.
 *   2. Refuse si TARGET parece ser producción (host conocido de prod).
 *   3. Confirmación interactiva antes de tocar TARGET.
 *   4. El dump queda en disco antes del restore, así si falla el
 *      restore tenés el archivo para reintentar a mano.
 *
 * Uso (desde backend/):
 *
 *   # Modo dump-only (genera archivo en backups/, no toca ningún target):
 *   $env:SOURCE_URL = "postgresql://...prod..."
 *   npx ts-node src/scripts/backup-rehearsal.ts --dump-only
 *
 *   # Modo rehearsal completo (dump + restore):
 *   $env:SOURCE_URL  = "postgresql://...prod..."
 *   $env:TARGET_URL  = "postgresql://...staging..."
 *   npx ts-node src/scripts/backup-rehearsal.ts
 *
 *   # Modo emergency-restore (skip dump si ya tenés archivo):
 *   $env:TARGET_URL = "postgresql://...prod..."
 *   npx ts-node src/scripts/backup-rehearsal.ts --restore-from=backups/prod_2026-05-04.dump
 *
 *   # Override de salvaguarda contra prod (sólo si sabés lo que hacés):
 *   ALLOW_PROD_TARGET=true npx ts-node src/scripts/backup-rehearsal.ts ...
 *
 * Requisitos:
 *   - pg_dump y pg_restore en PATH (PostgreSQL Command Line Tools).
 *   - Permisos de lectura/escritura en backups/.
 *   - URLs válidas con credenciales activas.
 */

import { spawn } from 'child_process';
import { mkdirSync, existsSync, statSync } from 'fs';
import { resolve } from 'path';
import { createInterface } from 'readline';

// ─── Argumentos y env ────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const dumpOnly = args.includes('--dump-only');
const restoreFromArg = args.find(a => a.startsWith('--restore-from='));
const restoreFrom = restoreFromArg ? restoreFromArg.split('=')[1] : null;
const yesFlag = args.includes('--yes') || args.includes('-y');

const SOURCE_URL = process.env.SOURCE_URL;
const TARGET_URL = process.env.TARGET_URL;
const ALLOW_PROD_TARGET = process.env.ALLOW_PROD_TARGET === 'true';

// Hosts conocidos de prod. Ampliar si Railway rota proxies.
const KNOWN_PROD_HOSTS = ['mainline.proxy.rlwy.net:43766'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fail(msg: string): never {
    console.error(`\n❌ ${msg}\n`);
    process.exit(1);
}

function info(msg: string) {
    console.log(`ℹ  ${msg}`);
}

function ok(msg: string) {
    console.log(`✅ ${msg}`);
}

function parseHostPort(url: string): string {
    try {
        const u = new URL(url);
        return `${u.hostname}:${u.port || '5432'}`;
    } catch {
        return '';
    }
}

function maskUrl(url: string): string {
    try {
        const u = new URL(url);
        return `${u.protocol}//${u.username}:***@${u.host}${u.pathname}`;
    } catch {
        return url.replace(/:[^:@/]*@/, ':***@');
    }
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

function runProcess(cmd: string, cmdArgs: string[]): Promise<void> {
    return new Promise((resolveRun, rejectRun) => {
        info(`> ${cmd} ${cmdArgs.map(a => (a.startsWith('postgresql://') ? '[URL]' : a)).join(' ')}`);
        const child = spawn(cmd, cmdArgs, { stdio: 'inherit' });
        child.on('error', err => {
            if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
                rejectRun(new Error(`Comando no encontrado: ${cmd}. Instalá PostgreSQL Command Line Tools.`));
            } else {
                rejectRun(err);
            }
        });
        child.on('exit', code => {
            if (code === 0) resolveRun();
            else rejectRun(new Error(`${cmd} terminó con exit code ${code}`));
        });
    });
}

// ─── Validaciones ────────────────────────────────────────────────────────────

async function validate() {
    if (dumpOnly && restoreFrom) {
        fail('No podés combinar --dump-only y --restore-from.');
    }

    if (dumpOnly) {
        if (!SOURCE_URL) fail('SOURCE_URL es obligatorio en modo --dump-only.');
        return;
    }

    if (restoreFrom) {
        if (!TARGET_URL) fail('TARGET_URL es obligatorio en modo --restore-from.');
        if (!existsSync(restoreFrom)) fail(`No encuentro el archivo: ${restoreFrom}`);
        return;
    }

    // Modo full rehearsal
    if (!SOURCE_URL) fail('SOURCE_URL es obligatorio.');
    if (!TARGET_URL) fail('TARGET_URL es obligatorio.');

    if (SOURCE_URL === TARGET_URL) {
        fail('SOURCE_URL y TARGET_URL son idénticos. Eso significa restaurar prod sobre prod, lo cual borraría los datos. Abortando.');
    }

    const sourceHost = parseHostPort(SOURCE_URL);
    const targetHost = parseHostPort(TARGET_URL);

    if (sourceHost && sourceHost === targetHost) {
        fail(`SOURCE y TARGET apuntan al mismo host:puerto (${sourceHost}). Probable confusión de URLs. Abortando.`);
    }

    if (KNOWN_PROD_HOSTS.includes(targetHost) && !ALLOW_PROD_TARGET) {
        fail(`TARGET_URL apunta a un host conocido de PRODUCCIÓN (${targetHost}). Restaurar acá borraría los datos productivos. Si REALMENTE querés hacerlo (recovery de emergencia con autorización), seteá ALLOW_PROD_TARGET=true. Abortando por defecto.`);
    }
}

async function confirm(action: string) {
    if (yesFlag) {
        info('--yes / -y: skip confirmación interactiva.');
        return;
    }
    console.log(`\n${action}\n`);
    const answer = await ask('¿Continuar? (escribí "si" para confirmar): ');
    if (answer.trim().toLowerCase() !== 'si' && answer.trim().toLowerCase() !== 'sí') {
        fail('Cancelado por el usuario.');
    }
}

// ─── Pipeline ────────────────────────────────────────────────────────────────

async function doDump(sourceUrl: string): Promise<string> {
    const backupsDir = resolve(process.cwd(), 'backups');
    mkdirSync(backupsDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `dump_${timestamp}.dump`;
    const filePath = resolve(backupsDir, fileName);

    info(`Generando dump → ${filePath}`);

    await runProcess('pg_dump', [
        '--format=custom',
        '--no-owner',
        '--no-acl',
        `--dbname=${sourceUrl}`,
        `--file=${filePath}`,
    ]);

    const stats = statSync(filePath);
    if (stats.size === 0) {
        fail(`Dump generado con 0 bytes. Probable falla silenciosa. Borrá ${fileName} y reintentá.`);
    }
    ok(`Dump completo: ${fileName} (${(stats.size / 1024).toFixed(1)} KB)`);

    return filePath;
}

async function doRestore(targetUrl: string, dumpPath: string) {
    info(`Restaurando ${dumpPath} → target...`);
    await runProcess('pg_restore', [
        '--clean',
        '--if-exists',
        '--no-owner',
        '--no-acl',
        `--dbname=${targetUrl}`,
        dumpPath,
    ]);
    ok('Restore completo.');
    info('Nota: si pg_restore reportó errores sobre _prisma_migrations o relaciones existentes, son típicamente inocuos cuando el target ya tenía schema aplicado.');
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
    console.log('🛡  Backup/restore rehearsal\n');

    await validate();

    if (dumpOnly && SOURCE_URL) {
        info(`SOURCE: ${maskUrl(SOURCE_URL)}`);
        await confirm('Vas a generar un dump del SOURCE. No se toca ningún target.');
        await doDump(SOURCE_URL);
        ok('Dump-only finalizado. El archivo queda en backups/.');
        return;
    }

    if (restoreFrom && TARGET_URL) {
        info(`TARGET: ${maskUrl(TARGET_URL)}`);
        info(`DUMP:   ${restoreFrom}`);
        await confirm(`⚠ Vas a RESTAURAR sobre TARGET. Esto BORRA los objetos del target y los reemplaza con el contenido del dump.`);
        await doRestore(TARGET_URL, restoreFrom);
        ok('Restore-only finalizado.');
        return;
    }

    // Rehearsal completo
    if (SOURCE_URL && TARGET_URL) {
        info(`SOURCE: ${maskUrl(SOURCE_URL)}`);
        info(`TARGET: ${maskUrl(TARGET_URL)}`);
        await confirm(`Vas a:\n  1. Hacer dump de SOURCE.\n  2. Restaurar el dump sobre TARGET (esto borra y reemplaza el contenido del target).\n\nConfirmá que SOURCE y TARGET son los correctos.`);
        const dumpPath = await doDump(SOURCE_URL);
        await doRestore(TARGET_URL, dumpPath);
        ok(`Rehearsal completo. El dump queda en ${dumpPath} para auditoría.`);
        return;
    }

    fail('Estado inválido. Debug.');
}

main().catch(err => {
    console.error(`\n❌ ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
});
