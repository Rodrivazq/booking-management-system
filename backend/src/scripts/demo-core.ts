/**
 * demo-core.ts — Lógica PURA (sin Prisma, sin I/O) para generar un dataset
 * de demostración realista y DETERMINÍSTICO.
 *
 * Por qué pura: permite probar idempotencia y determinismo con Vitest sin
 * tocar la base de datos (requisito de la regla 12 del proyecto). El script
 * ejecutable (`seed-demo-production.ts`) sólo orquesta: lee qué existe en la
 * DB y persiste lo que falta usando estas funciones.
 *
 * Principios:
 *   - Nada de Math.random ni Date.now: todo se deriva por hash de claves
 *     estables (userId, semana, día, plato). Re-ejecutar produce EXACTAMENTE
 *     el mismo resultado → idempotencia + reseñas reproducibles.
 *   - Las reseñas NO son al azar: cada plato tiene un perfil de popularidad
 *     fijo. El rating de cada usuario se muestrea de ese perfil. Así los
 *     rankings de reportes son coherentes y estables (la milanesa siempre
 *     arriba, las lentejas siempre abajo).
 */

export type Rating = 'liked' | 'neutral' | 'disliked';
export type Profile = { liked: number; neutral: number; disliked: number };

export const DAYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'] as const;
export type Day = typeof DAYS[number];

// Slots de retiro válidos (deben coincidir con utils/db.ts TIME_SLOTS).
// Mayoría almuerzo; unos pocos de noche para que el reporte de horarios
// no sea plano.
const LUNCH_SLOTS = ['11:30', '12:00', '12:00', '12:30', '12:30', '13:00', '13:30'];
const DINNER_SLOTS = ['21:00', '21:30'];

// ─── Hash y PRNG determinístico ──────────────────────────────────────────────
// FNV-1a 32-bit: estable entre ejecuciones y plataformas.
export function hashStr(s: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

// mulberry32: PRNG determinístico sembrado por un entero. Devuelve [0,1).
export function rngFrom(seed: number): () => number {
    let a = seed >>> 0;
    return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Valor determinístico en [0,1) a partir de una clave string.
function unit(key: string): number {
    return rngFrom(hashStr(key))();
}

// ─── Perfiles de popularidad por plato ───────────────────────────────────────
// liked + neutral + disliked ≈ 1. Curados para que los reportes cuenten una
// historia creíble: estrellas, platos tibios y platos que dividen.
export const DISH_PROFILES: Record<string, Profile> = {
    // Comidas — estrellas
    'Milanesa con puré': { liked: 0.84, neutral: 0.11, disliked: 0.05 },
    'Pizza artesanal': { liked: 0.80, neutral: 0.14, disliked: 0.06 },
    'Hamburguesa casera': { liked: 0.78, neutral: 0.15, disliked: 0.07 },
    'Carne al horno': { liked: 0.74, neutral: 0.18, disliked: 0.08 },
    'Pollo grille con papas': { liked: 0.70, neutral: 0.22, disliked: 0.08 },
    'Tacos de pollo': { liked: 0.66, neutral: 0.24, disliked: 0.10 },
    // Comidas — tibias
    'Pasta al pesto': { liked: 0.62, neutral: 0.26, disliked: 0.12 },
    'Fideos salteados': { liked: 0.58, neutral: 0.30, disliked: 0.12 },
    'Lasagna vegetal': { liked: 0.55, neutral: 0.30, disliked: 0.15 },
    'Sushi bowl': { liked: 0.52, neutral: 0.26, disliked: 0.22 },
    'Risotto de hongos': { liked: 0.50, neutral: 0.30, disliked: 0.20 },
    'Ensalada cesar': { liked: 0.46, neutral: 0.38, disliked: 0.16 },
    'Wrap vegetariano': { liked: 0.45, neutral: 0.35, disliked: 0.20 },
    // Comidas — divisivas / poco queridas
    'Pescado al limon': { liked: 0.40, neutral: 0.27, disliked: 0.33 },
    'Curry de garbanzos': { liked: 0.40, neutral: 0.30, disliked: 0.30 },
    'Ensalada de quinoa': { liked: 0.38, neutral: 0.34, disliked: 0.28 },
    'Lentejas guisadas': { liked: 0.30, neutral: 0.30, disliked: 0.40 },

    // Postres — estrellas
    'Brownie': { liked: 0.85, neutral: 0.11, disliked: 0.04 },
    'Flan casero': { liked: 0.82, neutral: 0.13, disliked: 0.05 },
    'Helado': { liked: 0.80, neutral: 0.15, disliked: 0.05 },
    'Mousse de chocolate': { liked: 0.79, neutral: 0.15, disliked: 0.06 },
    'Tiramisu': { liked: 0.78, neutral: 0.16, disliked: 0.06 },
    'Cheesecake': { liked: 0.76, neutral: 0.18, disliked: 0.06 },
    'Panqueques': { liked: 0.72, neutral: 0.20, disliked: 0.08 },
    // Postres — tibios
    'Fruta fresca': { liked: 0.55, neutral: 0.33, disliked: 0.12 },
    'Yogur con granola': { liked: 0.50, neutral: 0.34, disliked: 0.16 },
    'Manzana asada': { liked: 0.42, neutral: 0.38, disliked: 0.20 },
    'Gelatina': { liked: 0.40, neutral: 0.36, disliked: 0.24 },
};

// Para platos no catalogados (p. ej. menús reales en prod): heurística por
// palabra clave, con un fallback positivo razonable.
const POSITIVE_KEYWORDS = ['milanesa', 'pizza', 'hamburguesa', 'carne', 'pollo', 'brownie', 'flan', 'helado', 'tiramisu', 'cheesecake', 'mousse', 'panqueque', 'asado', 'pasta', 'lasagna', 'ñoqui', 'noqui', 'tarta'];
const NEGATIVE_KEYWORDS = ['pescado', 'lenteja', 'quinoa', 'garbanzo', 'curry', 'tofu', 'verdura', 'espinaca', 'coliflor', 'berenjena', 'hervid', 'gelatina'];

export function profileForDish(name: string): Profile {
    const known = DISH_PROFILES[name];
    if (known) return known;
    const n = name.toLowerCase();
    if (NEGATIVE_KEYWORDS.some(k => n.includes(k))) {
        return { liked: 0.38, neutral: 0.32, disliked: 0.30 };
    }
    if (POSITIVE_KEYWORDS.some(k => n.includes(k))) {
        return { liked: 0.72, neutral: 0.20, disliked: 0.08 };
    }
    return { liked: 0.55, neutral: 0.30, disliked: 0.15 }; // default tibio-positivo
}

// Muestrea un rating determinístico del perfil del plato.
export function pickRating(key: string, profile: Profile): Rating {
    const r = unit(key);
    if (r < profile.liked) return 'liked';
    if (r < profile.liked + profile.neutral) return 'neutral';
    return 'disliked';
}

// ─── Catálogo de platos para construir menús semanales ───────────────────────
// Orden ~ popularidad. Las estrellas se repiten entre semanas para que los
// rankings globales acumulen volumen.
const MEAL_POOL = [
    'Milanesa con puré', 'Pizza artesanal', 'Hamburguesa casera', 'Carne al horno',
    'Pollo grille con papas', 'Tacos de pollo', 'Pasta al pesto', 'Fideos salteados',
    'Lasagna vegetal', 'Sushi bowl', 'Risotto de hongos', 'Ensalada cesar',
    'Wrap vegetariano', 'Pescado al limon', 'Curry de garbanzos', 'Ensalada de quinoa',
    'Lentejas guisadas',
];
const DESSERT_POOL = [
    'Brownie', 'Flan casero', 'Helado', 'Mousse de chocolate', 'Tiramisu',
    'Cheesecake', 'Panqueques', 'Fruta fresca', 'Yogur con granola',
    'Manzana asada', 'Gelatina',
];

export type MenuDay = { meals: string[]; desserts: string[] };
export type MenuDays = Record<Day, MenuDay>;

// Toma 3 ítems distintos del pool, rotando según el índice.
function pick3(pool: string[], start: number): string[] {
    const out: string[] = [];
    let i = 0;
    while (out.length < 3 && i < pool.length) {
        const item = pool[(start + i) % pool.length];
        if (!out.includes(item)) out.push(item);
        i++;
    }
    return out;
}

// Construye un menú semanal determinístico para el índice de semana dado.
// Garantiza variedad entre días/semanas y recurrencia de las estrellas.
export function buildWeekMenu(weekIndex: number): MenuDays {
    const days = {} as MenuDays;
    DAYS.forEach((day, d) => {
        days[day] = {
            meals: pick3(MEAL_POOL, weekIndex * 7 + d * 3),
            desserts: pick3(DESSERT_POOL, weekIndex * 5 + d * 2),
        };
    });
    return days;
}

// ─── Usuarios simulados ──────────────────────────────────────────────────────
const FIRST_NAMES = [
    'Martín', 'Lucía', 'Santiago', 'Valentina', 'Mateo', 'Camila', 'Diego', 'Sofía',
    'Sebastián', 'Florencia', 'Nicolás', 'Agustina', 'Joaquín', 'Carolina', 'Federico',
    'Victoria', 'Gonzalo', 'Micaela', 'Rodrigo', 'Paula', 'Andrés', 'Daniela', 'Pablo',
    'Romina', 'Facundo', 'Natalia', 'Emiliano', 'Gabriela', 'Maximiliano', 'Lorena',
    'Ignacio', 'Verónica', 'Bruno', 'Cecilia', 'Alejandro', 'Mariana', 'Leandro',
    'Patricia', 'Tomás', 'Andrea',
];
const LAST_NAMES = [
    'Rodríguez', 'Fernández', 'González', 'Pereyra', 'Silva', 'Martínez', 'López',
    'Sosa', 'Techera', 'Píriz', 'Cabrera', 'Gómez', 'Méndez', 'Núñez', 'Olivera',
    'Castro', 'Suárez', 'Rivero', 'Acosta', 'Ferreira', 'Da Silva', 'Bentancor',
    'Píriz', 'Lemos', 'Viera', 'Cardozo', 'Machado', 'Píriz', 'Rey', 'Bermúdez',
    'Correa', 'Falero', 'Iturralde', 'Pintos', 'Estévez', 'Barreto', 'Curbelo',
    'Delgado', 'Píriz', 'Tabárez',
];

export type DemoUser = {
    name: string;
    email: string;
    funcNumber: string;
    documentId: string;
    phoneNumber: string;
    /** % de semanas en las que reserva (regular vs esporádico). */
    participation: number;
    /** Probabilidad de calificar un plato que ya comió. */
    ratingPropensity: number;
};

// Marcadores para identificar inequívocamente datos de demo (rollback seguro).
export const DEMO_EMAIL_DOMAIN = 'demo.realsabor.local'; // .local = nunca enrutable
export const DEMO_FUNC_PREFIX = 'D';
export const DEMO_PREF_TAG = '__DEMO_REAL_SABOR__';

function slug(s: string): string {
    return s.toLowerCase()
        // NFD separa acentos en marcas combinantes; el filtro ASCII las quita
        // ("martín" → "marti" + ́ + "n" → "martin").
        .normalize('NFD').replace(/[^\x00-\x7f]/g, '')
        .replace(/[^a-z0-9]+/g, '.')
        .replace(/^\.|\.$/g, '');
}

// Genera `count` usuarios determinísticos. funcNumber/documentId en rangos
// claramente ficticios para no colisionar con empleados reales.
export function buildDemoUsers(count: number): DemoUser[] {
    const users: DemoUser[] = [];
    const seenEmail = new Set<string>();
    for (let i = 0; i < count; i++) {
        const first = FIRST_NAMES[i % FIRST_NAMES.length];
        const last = LAST_NAMES[(i * 7 + 3) % LAST_NAMES.length];
        const name = `${first} ${last}`;
        let email = `demo.${slug(first)}.${slug(last)}@${DEMO_EMAIL_DOMAIN}`;
        // Desambiguar emails repetidos por combinación nombre/apellido.
        if (seenEmail.has(email)) email = `demo.${slug(first)}.${slug(last)}.${i}@${DEMO_EMAIL_DOMAIN}`;
        seenEmail.add(email);

        const seq = String(i + 1).padStart(4, '0');
        const r = rngFrom(hashStr(`user|${i}`));
        // ~60% regulares (>=85%), resto esporádicos.
        const participation = r() < 0.6 ? 0.85 + r() * 0.13 : 0.55 + r() * 0.25;
        const ratingPropensity = 0.70 + r() * 0.25;

        users.push({
            name,
            email,
            funcNumber: `${DEMO_FUNC_PREFIX}${seq}`,
            // CI ficticia en rango 9.xxx.xxx (no asignado a personas reales en UY).
            documentId: `9${String(100000 + i * 137).padStart(6, '0')}`,
            phoneNumber: `09${String(9000000 + i).padStart(7, '0')}`.slice(0, 9),
            participation,
            ratingPropensity,
        });
    }
    return users;
}

// ─── Generación de actividad por usuario/semana ──────────────────────────────
export type Selection = { day: Day; meal: string; dessert: string; bread: boolean };
export type RatingEntry = { day: Day; itemType: 'meal' | 'dessert'; itemName: string; rating: Rating };
export type UserWeekData = {
    reserve: boolean;
    timeSlot: string;
    selections: Selection[];
    ratings: RatingEntry[];
};

function userKey(u: DemoUser): string {
    return u.funcNumber; // estable e identifica al usuario demo
}

export function userReservesWeek(u: DemoUser, weekStart: string): boolean {
    return unit(`reserve|${userKey(u)}|${weekStart}`) < u.participation;
}

export function pickTimeSlot(u: DemoUser, weekStart: string): string {
    const r = unit(`slot|${userKey(u)}|${weekStart}`);
    if (r < 0.88) {
        const idx = Math.floor(unit(`slotL|${userKey(u)}|${weekStart}`) * LUNCH_SLOTS.length);
        return LUNCH_SLOTS[idx];
    }
    const idx = Math.floor(unit(`slotD|${userKey(u)}|${weekStart}`) * DINNER_SLOTS.length);
    return DINNER_SLOTS[idx];
}

// Elige 1 opción de `options` ponderando por el "liked" del perfil: los platos
// populares se reservan más → los conteos de reportes son creíbles.
function weightedPick(options: string[], key: string): string {
    const weights = options.map(o => Math.max(0.05, profileForDish(o).liked));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = unit(key) * total;
    for (let i = 0; i < options.length; i++) {
        r -= weights[i];
        if (r <= 0) return options[i];
    }
    return options[options.length - 1];
}

export function buildSelections(u: DemoUser, weekStart: string, menu: MenuDays): Selection[] {
    return DAYS.map(day => {
        const md = menu[day];
        const meal = weightedPick(md.meals, `meal|${userKey(u)}|${weekStart}|${day}`);
        const dessert = weightedPick(md.desserts, `dess|${userKey(u)}|${weekStart}|${day}`);
        const bread = unit(`bread|${userKey(u)}|${weekStart}|${day}`) < 0.55;
        return { day, meal, dessert, bread };
    });
}

/**
 * Construye toda la actividad de un usuario para una semana.
 * @param elapsedDays  días (de DAYS) ya servidos → elegibles para calificar.
 *                     Para semanas pasadas son los 5; para la semana en curso,
 *                     sólo los anteriores a hoy (regla 6: no calificar futuros).
 */
export function buildUserWeekData(
    u: DemoUser,
    weekStart: string,
    menu: MenuDays,
    elapsedDays: Day[],
): UserWeekData {
    if (!userReservesWeek(u, weekStart)) {
        return { reserve: false, timeSlot: '', selections: [], ratings: [] };
    }
    const selections = buildSelections(u, weekStart, menu);
    const ratings: RatingEntry[] = [];
    for (const sel of selections) {
        if (!elapsedDays.includes(sel.day)) continue;
        for (const itemType of ['meal', 'dessert'] as const) {
            const itemName = itemType === 'meal' ? sel.meal : sel.dessert;
            // ¿Este usuario califica este plato?
            if (unit(`rate?|${userKey(u)}|${weekStart}|${sel.day}|${itemType}`) >= u.ratingPropensity) continue;
            const rating = pickRating(`rate|${userKey(u)}|${weekStart}|${sel.day}|${itemType}|${itemName}`, profileForDish(itemName));
            ratings.push({ day: sel.day, itemType, itemName, rating });
        }
    }
    return { reserve: true, timeSlot: pickTimeSlot(u, weekStart), selections, ratings };
}
