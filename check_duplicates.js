const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'backend', 'data', 'db.json');
try {
    const data = fs.readFileSync(dbPath, 'utf8');
    const db = JSON.parse(data);
    const reservations = db.reservations || [];

    const counts = {};
    reservations.forEach(r => {
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
