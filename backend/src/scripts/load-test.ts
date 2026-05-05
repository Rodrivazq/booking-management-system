/**
 * Load test sintético para el sistema de reservas.
 *
 * Diseñado para ejecutarse contra STAGING, nunca contra producción real con
 * usuarios. Simula los 4 endpoints más golpeados durante un cierre de
 * reservas:
 *   1. POST /api/auth/login (autenticar)
 *   2. GET  /api/menu (leer menú activo)
 *   3. GET  /api/reservations/window (chequear deadline)
 *   4. PUT  /api/reservations (crear/actualizar reserva — el más caro)
 *
 * Mide: requests/sec, p50, p95, p99, error rate, distribución de status
 * codes. Reporta al final con un resumen ejecutivo.
 *
 * Uso (desde backend/):
 *   TARGET_URL=https://api-staging.reservasrealsabor.com.uy \
 *   TEST_EMAILS="user1@test.com,user2@test.com" \
 *   TEST_PASSWORD=password123 \
 *   CONCURRENCY=50 \
 *   DURATION_SEC=30 \
 *   npx ts-node scripts/load-test.ts
 *
 * Requisitos previos:
 *   - Staging tiene al menos N usuarios creados (idealmente N == CONCURRENCY).
 *   - Esos usuarios tienen `isEmailVerified: true` y password conocida.
 *   - Hay un menú cargado para la semana activa.
 *
 * Para seedear usuarios de prueba en staging, usar la importación CSV con un
 * archivo de N filas y luego setear la password con un script separado o
 * directamente desde el panel admin.
 */

const TARGET_URL = process.env.TARGET_URL;
const TEST_EMAILS_RAW = process.env.TEST_EMAILS || '';
const TEST_PASSWORD = process.env.TEST_PASSWORD;
const CONCURRENCY = Number(process.env.CONCURRENCY || '50');
const DURATION_SEC = Number(process.env.DURATION_SEC || '30');
const WARMUP_SEC = Number(process.env.WARMUP_SEC || '5');

if (!TARGET_URL) {
    console.error('❌ TARGET_URL es obligatorio (ej: https://api-staging.reservasrealsabor.com.uy)');
    process.exit(1);
}

if (TARGET_URL.includes('reservasrealsabor.com.uy') && !TARGET_URL.includes('staging')) {
    console.error('❌ TARGET_URL parece apuntar a producción. Abortando para evitar carga sobre prod.');
    console.error('   Si querés correr contra prod (no recomendado), seteá ALLOW_PROD=true.');
    if (process.env.ALLOW_PROD !== 'true') process.exit(1);
}

if (!TEST_EMAILS_RAW || !TEST_PASSWORD) {
    console.error('❌ TEST_EMAILS y TEST_PASSWORD son obligatorios.');
    console.error('   TEST_EMAILS es una lista separada por coma de cuentas pre-creadas en staging.');
    process.exit(1);
}

const TEST_EMAILS = TEST_EMAILS_RAW.split(',').map(e => e.trim()).filter(Boolean);

if (TEST_EMAILS.length === 0) {
    console.error('❌ No se parsearon emails desde TEST_EMAILS.');
    process.exit(1);
}

// ─── Métricas ────────────────────────────────────────────────────────────────

type EndpointName = 'login' | 'menu' | 'window' | 'reservation';

interface Sample {
    endpoint: EndpointName;
    status: number;
    durationMs: number;
    error?: string;
}

const samples: Sample[] = [];
let stopFlag = false;

function record(endpoint: EndpointName, status: number, durationMs: number, error?: string) {
    samples.push({ endpoint, status, durationMs, error });
}

// ─── HTTP helpers ────────────────────────────────────────────────────────────

async function timed<T>(endpoint: EndpointName, fn: () => Promise<{ status: number; data?: T }>): Promise<{ status: number; data?: T }> {
    const t0 = Date.now();
    try {
        const result = await fn();
        record(endpoint, result.status, Date.now() - t0);
        return result;
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        record(endpoint, 0, Date.now() - t0, message);
        return { status: 0 };
    }
}

async function login(email: string): Promise<string | null> {
    const result = await timed<{ token: string }>('login', async () => {
        const res = await fetch(`${TARGET_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: email, password: TEST_PASSWORD }),
        });
        const text = await res.text();
        let data: any = null;
        try { data = text ? JSON.parse(text) : null; } catch { /* ignore */ }
        return { status: res.status, data };
    });
    return result.data?.token || null;
}

async function getMenu(token: string) {
    return timed('menu', async () => {
        const res = await fetch(`${TARGET_URL}/api/menu`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        await res.text();
        return { status: res.status };
    });
}

async function getWindow(token: string) {
    return timed('window', async () => {
        const res = await fetch(`${TARGET_URL}/api/reservations/window`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        await res.text();
        return { status: res.status };
    });
}

async function putReservation(token: string, weekStart: string, selections: any[]) {
    return timed('reservation', async () => {
        const res = await fetch(`${TARGET_URL}/api/reservations`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ weekStart, selections, timeSlot: '12:00' }),
        });
        await res.text();
        return { status: res.status };
    });
}

// ─── Worker: ciclo realista por usuario ──────────────────────────────────────

async function workerLoop(workerId: number) {
    const email = TEST_EMAILS[workerId % TEST_EMAILS.length];
    let token: string | null = null;

    while (!stopFlag) {
        if (!token) {
            token = await login(email);
            if (!token) {
                // login falló — esperar un poco antes de reintentar para no saturar
                await sleep(500);
                continue;
            }
        }

        // Ciclo típico de un usuario activo:
        //   - mira menú
        //   - chequea ventana
        //   - tira una reserva (50% del tiempo, para que reservation no domine)
        await getMenu(token);
        if (stopFlag) break;
        await getWindow(token);
        if (stopFlag) break;

        if (Math.random() < 0.5) {
            // Selecciones dummy. Si el menú real tiene otros nombres, las creates
            // van a fallar con 400 — sigue siendo señal útil para latencia.
            const weekStart = nextMondayString();
            const selections = [
                { day: 'lunes', meal: 'Plato A', dessert: 'Postre A', bread: true },
                { day: 'martes', meal: 'Plato A', dessert: 'Postre A', bread: false },
                { day: 'miercoles', meal: 'Plato A', dessert: 'Postre A', bread: true },
                { day: 'jueves', meal: 'Plato A', dessert: 'Postre A', bread: false },
                { day: 'viernes', meal: 'Plato A', dessert: 'Postre A', bread: true },
            ];
            await putReservation(token, weekStart, selections);
        }

        // Pequeña espera para no martillar (simula clicks humanos)
        await sleep(50 + Math.floor(Math.random() * 150));
    }
}

function sleep(ms: number) {
    return new Promise<void>(resolve => setTimeout(resolve, ms));
}

function nextMondayString(): string {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? 1 : 8 - day; // próximo lunes
    d.setDate(d.getDate() + diff);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

// ─── Reporte ─────────────────────────────────────────────────────────────────

function percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.min(Math.floor((p / 100) * sorted.length), sorted.length - 1);
    return sorted[idx];
}

function report(durationMs: number) {
    console.log('\n========== RESULTADO ==========\n');

    const byEndpoint = new Map<EndpointName, Sample[]>();
    for (const s of samples) {
        if (!byEndpoint.has(s.endpoint)) byEndpoint.set(s.endpoint, []);
        byEndpoint.get(s.endpoint)!.push(s);
    }

    console.log(`Duración total: ${(durationMs / 1000).toFixed(1)}s`);
    console.log(`Concurrencia:   ${CONCURRENCY}`);
    console.log(`Usuarios pool:  ${TEST_EMAILS.length}`);
    console.log(`Total samples:  ${samples.length}`);
    console.log(`Throughput:     ${(samples.length / (durationMs / 1000)).toFixed(1)} req/s\n`);

    console.log('Por endpoint:\n');
    console.log(
        'endpoint    '.padEnd(14) +
        'count'.padStart(8) +
        'p50'.padStart(8) +
        'p95'.padStart(8) +
        'p99'.padStart(8) +
        'errors'.padStart(8) +
        '   status distribution'
    );

    for (const [endpoint, list] of byEndpoint) {
        const durations = list.map(s => s.durationMs);
        const errors = list.filter(s => s.status === 0 || s.status >= 500).length;
        const statusDist = new Map<number, number>();
        for (const s of list) {
            statusDist.set(s.status, (statusDist.get(s.status) || 0) + 1);
        }
        const dist = [...statusDist.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([code, count]) => `${code === 0 ? 'NET' : code}:${count}`)
            .join(' ');

        console.log(
            endpoint.padEnd(14) +
            String(list.length).padStart(8) +
            `${percentile(durations, 50)}ms`.padStart(8) +
            `${percentile(durations, 95)}ms`.padStart(8) +
            `${percentile(durations, 99)}ms`.padStart(8) +
            String(errors).padStart(8) +
            '   ' + dist
        );
    }

    console.log('\nCriterios de aceptación sugeridos para el lanzamiento:');
    console.log('  - login p95 < 1500ms');
    console.log('  - menu / window p95 < 800ms');
    console.log('  - reservation p95 < 2000ms');
    console.log('  - error rate (>=500) < 1%');
    console.log('  - sin errores de red / timeouts\n');
}

// ─── Run ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log(`🚀 Load test: ${TARGET_URL}`);
    console.log(`   ${CONCURRENCY} workers, ${DURATION_SEC}s + ${WARMUP_SEC}s warmup`);
    console.log(`   pool de ${TEST_EMAILS.length} usuario(s)\n`);

    const t0 = Date.now();

    const workers = Array.from({ length: CONCURRENCY }, (_, i) => workerLoop(i));

    setTimeout(() => {
        stopFlag = true;
    }, (DURATION_SEC + WARMUP_SEC) * 1000);

    // Ignorar warmup: descartar samples del primer WARMUP_SEC
    setTimeout(() => {
        samples.length = 0;
        console.log(`⏱  Warmup completo, midiendo ${DURATION_SEC}s...\n`);
    }, WARMUP_SEC * 1000);

    await Promise.all(workers);

    const totalMs = Date.now() - t0 - WARMUP_SEC * 1000;
    report(totalMs);
}

main().catch(err => {
    console.error('❌ Error fatal:', err);
    process.exit(1);
});
