import fs from 'fs';
import path from 'path';
import { DATA_DIR } from '../config/env';

const DATA_FILE = path.join(DATA_DIR, 'db.json');

export const DAY_KEYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
export const TIME_SLOTS = [
    '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00',
    '21:00', '21:30', '22:00'
];

const DEFAULT_MENU_DAYS: any = {
    lunes: { meals: ['Pollo grille con papas', 'Pasta al pesto', 'Ensalada de quinoa'], desserts: ['Fruta fresca', 'Brownie', 'Yogur con granola'] },
    martes: { meals: ['Carne al horno', 'Risotto de hongos', 'Wrap vegetariano'], desserts: ['Mousse de chocolate', 'Gelatina', 'Manzana asada'] },
    miercoles: { meals: ['Pescado al limon', 'Lasagna vegetal', 'Tacos de pollo'], desserts: ['Cheesecake', 'Fruta fresca', 'Flan casero'] },
    jueves: { meals: ['Hamburguesa casera', 'Curry de garbanzos', 'Fideos salteados'], desserts: ['Brownie', 'Helado', 'Yogur con granola'] },
    viernes: { meals: ['Pizza artesanal', 'Sushi bowl', 'Ensalada cesar'], desserts: ['Tiramisu', 'Fruta fresca', 'Panqueques'] }
};

export const cloneDefaultMenuDays = () => JSON.parse(JSON.stringify(DEFAULT_MENU_DAYS));

function ensureDataFile() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(DATA_FILE)) {
        const seed = { users: [], menu: { breadAvailable: true, days: cloneDefaultMenuDays() }, reservations: [], resets: [] };
        fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
    }
}

export function readDB(): any {
    ensureDataFile();
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    let data: any;
    let patched = false;
    try {
        data = JSON.parse(raw);
    } catch (e) {
        data = {};
    }

    // Migration logic
    // Migration logic for dual menus
    if (!data.menu?.current || !data.menu?.next) {
        const oldMenu = data.menu?.days ? data.menu : { breadAvailable: true, days: cloneDefaultMenuDays() };

        // Ensure oldMenu has valid structure
        if (!oldMenu.days) oldMenu.days = cloneDefaultMenuDays();

        data.menu = {
            current: JSON.parse(JSON.stringify(oldMenu)),
            next: JSON.parse(JSON.stringify(oldMenu)) // Initialize next with same as current for now
        };
        patched = true;
    }

    // Validate structure of both menus
    ['current', 'next'].forEach(type => {
        const m = data.menu[type];
        if (!m.days) {
            m.days = cloneDefaultMenuDays();
            patched = true;
        }
        DAY_KEYS.forEach((day) => {
            if (!m.days[day] || !Array.isArray(m.days[day].meals) || m.days[day].meals.length < 3 || !Array.isArray(m.days[day].desserts) || m.days[day].desserts.length < 3) {
                m.days[day] = cloneDefaultMenuDays()[day];
                patched = true;
            }
        });
    });

    if (!Array.isArray(data.resets)) {
        data.resets = [];
        patched = true;
    }

    if (Array.isArray(data.reservations)) {
        data.reservations.forEach((r: any) => {
            if (!r.timeSlot) {
                r.timeSlot = TIME_SLOTS[0];
                patched = true;
            }
        });
    }

    if (patched) writeDB(data);
    return data;
}

export function writeDB(db: any) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

export default {
    readDB,
    writeDB,
    DAY_KEYS,
    TIME_SLOTS,
    cloneDefaultMenuDays
};
