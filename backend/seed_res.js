
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getNextMonday = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = (8 - day) % 7 || 7;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + diff);
    nextMonday.setHours(0, 0, 0, 0);
    return nextMonday.toISOString().slice(0, 10);
};

async function seed() {
    const weekStart = getNextMonday();
    console.log('Seeding for week:', weekStart);

    // 1. Get User
    const user = await prisma.user.findFirst({ where: { email: 'manual_test@example.com' } });
    if (!user) {
        console.error('User manual_test@example.com not found. Create it first.');
        return;
    }

    // 2. Get Menu
    const menu = await prisma.weeklyMenu.findFirst({ where: { weekStart } });
    if (!menu) {
        console.error('Menu for week not found.');
        return;
    }

    // 3. Create Reservation
    try {
        const res = await prisma.reservation.create({
            data: {
                userId: user.id,
                weeklyMenuId: menu.id,
                weekStart: weekStart,
                day: 'monday',
                meal: 'Seeded Meal',
                dessert: 'Seeded Dessert',
                timeSlot: '12:00',
                status: 'confirmed'
            }
        });
        console.log('Created Reservation:', res);
    } catch (e) {
        console.error('Error creating reservation:', e);
    }
}

seed()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
