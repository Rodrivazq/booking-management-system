import app from './app';
import { PORT } from './config/env';
import { readDB, writeDB } from './utils/db'; // Legacy DB utils for seeding if needed
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

/*
function seedAdmin() {
    const db = readDB();

    // Check if any admin or superadmin exists
    const hasAdmin = db.users.some((u: any) => u.role === 'admin' || u.role === 'superadmin');

    if (!hasAdmin) {
        const passwordHash = bcrypt.hashSync('admin123', 10);
        db.users.push({
            id: uuidv4(),
            name: 'Administrador',
            email: 'admin@local',
            passwordHash,
            role: 'superadmin', // Default to superadmin for the first user
            funcNumber: 'ADMIN'
        });
        writeDB(db);
        console.log('Admin inicial creado: admin@local / admin123 (func: ADMIN)');
    }
}
*/

// seedAdmin();

app.listen(PORT, () => {
    console.log(`Servidor en http://localhost:${PORT}`);
});
