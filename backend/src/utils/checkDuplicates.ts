import { readDB } from './db';

function checkDuplicates() {
    try {
        const db = readDB();
        const reservations = db.reservations || [];

        interface Reservation {
            userId: string | number;
            weekStart: string;
            [key: string]: any;
        }

        const counts: Record<string, number> = {};
        reservations.forEach((r: Reservation) => {
            const key = `${r.userId}_${r.weekStart}`;
            counts[key] = (counts[key] || 0) + 1;
        });

        console.log('Total reservations:', reservations.length);
        console.log('Duplicates found:');
        let found = false;
        Object.entries(counts).forEach(([key, count]) => {
            if (count > 1) {
                console.log(`${key}: ${count}`);
                found = true;
            }
        });
        if (!found) console.log('No duplicates found.');

    } catch (err) {
        console.error('Error reading DB:', err);
    }
}

checkDuplicates();
