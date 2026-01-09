import { readDB } from './db';
import prisma from './prisma';
import { v4 as uuidv4 } from 'uuid';

async function migrateData() {
    console.log('Starting migration...');
    const db = readDB();

    // 1. Migrate Users
    console.log(`Migrating ${db.users.length} users...`);
    for (const user of db.users) {
        try {
            await prisma.user.upsert({
                where: { email: user.email },
                update: {},
                create: {
                    id: user.id || uuidv4(),
                    email: user.email,
                    name: user.name,
                    passwordHash: user.passwordHash,
                    role: user.role as any, // Cast string to enum if needed, or ensure types match
                    funcNumber: user.funcNumber,
                    phoneNumber: user.phoneNumber,
                    photoUrl: user.photoUrl,
                    preferences: user.preferences ? JSON.stringify(user.preferences) : undefined, // Prisma expects string or null/undefined
                }
            });
        } catch (e: any) {
            console.error(`Failed to migrate user ${user.email}:`, e.message);
        }
    }

    // 2. Migrate Settings
    console.log('Migrating settings...');
    if (db.settings) {
        await prisma.settings.upsert({
            where: { id: 1 },
            update: {
                companyName: db.settings.companyName,
                logoUrl: db.settings.logoUrl,
                primaryColor: db.settings.primaryColor,
                secondaryColor: db.settings.secondaryColor,
                deadlineDay: db.settings.deadlineDay,
                deadlineTime: db.settings.deadlineTime,
                supportEmail: db.settings.supportEmail,
                supportPhone: db.settings.supportPhone,
                welcomeTitle: db.settings.welcomeTitle,
                welcomeMessage: db.settings.welcomeMessage,
                loginBackgroundImage: db.settings.loginBackgroundImage,
                maintenanceMode: db.settings.maintenanceMode,
                announcementMessage: db.settings.announcementMessage,
                announcementType: db.settings.announcementType,
            },
            create: {
                companyName: db.settings.companyName || "Sistema de Reservas Corporativo",
                logoUrl: db.settings.logoUrl,
                primaryColor: db.settings.primaryColor,
                secondaryColor: db.settings.secondaryColor,
                deadlineDay: db.settings.deadlineDay !== undefined ? db.settings.deadlineDay : 3,
                deadlineTime: db.settings.deadlineTime || "23:59",
                supportEmail: db.settings.supportEmail,
                supportPhone: db.settings.supportPhone,
                welcomeTitle: db.settings.welcomeTitle,
                welcomeMessage: db.settings.welcomeMessage,
                loginBackgroundImage: db.settings.loginBackgroundImage,
                maintenanceMode: db.settings.maintenanceMode || false,
                announcementMessage: db.settings.announcementMessage,
                announcementType: db.settings.announcementType || "info",
            }
        });
    }

    // 3. Migrate Menus
    console.log('Migrating menus...');
    if (db.menu) {
        // Handle potentially missing menu structure
        const menus = [db.menu.current, db.menu.next].filter(Boolean);
        for (const menu of menus) {
            if (menu.weekStart) {
                await prisma.weeklyMenu.upsert({
                    where: { weekStart: menu.weekStart },
                    update: {
                        days: JSON.stringify(menu.days),
                        breadAvailable: menu.breadAvailable
                    },
                    create: {
                        weekStart: menu.weekStart,
                        days: JSON.stringify(menu.days),
                        breadAvailable: menu.breadAvailable
                    }
                });
            }
        }
    }

    // 4. Migrate Reservations
    // Use type assertion or ensure db.reservations exists
    const reservations = db.reservations || [];
    console.log(`Migrating ${reservations.length} reservations...`);
    for (const res of reservations) {
        try {
            await prisma.reservation.create({
                data: {
                    id: res.id || uuidv4(),
                    userId: res.userId,
                    weekStart: res.weekStart,
                    timeSlot: res.timeSlot || '12:00',
                    selections: JSON.stringify(res.selections),
                    createdAt: res.createdAt ? new Date(res.createdAt) : new Date(),
                }
            });
        } catch (e: any) {
            // Ignore duplicates or constraint errors
            // console.error(`Failed to migrate reservation ${res.id}:`, e.message);
        }
    }

    console.log('Migration completed.');
    await prisma.$disconnect();
}

migrateData().catch(e => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
});
