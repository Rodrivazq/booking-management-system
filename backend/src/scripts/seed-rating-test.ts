import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const today = new Date();
    const day = today.getDay(); // 0 is Sunday, 1 is Monday...
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); 
    const monday = new Date(today.setDate(diff));
    
    // Format YYYY-MM-DD
    const weekStart = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
    console.log(`Current week start: ${weekStart}`);

    // 1. Ensure a menu exists for this week
    let menu = await prisma.weeklyMenu.findUnique({ where: { weekStart } });
    if (!menu) {
        console.log('Menu for current week not found. Creating a test menu...');
        menu = await prisma.weeklyMenu.create({
            data: {
                weekStart,
                days: JSON.stringify({
                    lunes: { meals: ['Milanesa con puré'], desserts: ['Flan'] },
                    martes: { meals: ['Pollo al horno'], desserts: ['Helado'] },
                    miercoles: { meals: ['Pasta con salsa'], desserts: ['Fruta'] },
                    jueves: { meals: ['Pescado con ensalada'], desserts: ['Gelatina'] },
                    viernes: { meals: ['Pizza'], desserts: ['Alfajor'] }
                })
            }
        });
    }

    // 2. Get the first user (usually the admin or a test user)
    const user = await prisma.user.findFirst({
        orderBy: { createdAt: 'asc' }
    });

    if (!user) {
        console.error('No users found in the database. Please create a user first.');
        process.exit(1);
    }
    console.log(`Using user: ${user.email} (${user.name})`);

    // 3. Create a reservation for this week if it doesn't exist
    let reservation = await prisma.reservation.findUnique({
        where: {
            userId_weekStart: {
                userId: user.id,
                weekStart: weekStart
            }
        }
    });

    if (!reservation) {
        console.log('Creating a reservation for the current week...');
        reservation = await prisma.reservation.create({
            data: {
                userId: user.id,
                weekStart,
                timeSlot: '12:00',
                selections: JSON.stringify([
                    { day: 'lunes', meal: 'Milanesa con puré', dessert: 'Flan', bread: true },
                    { day: 'martes', meal: 'Pollo al horno', dessert: 'Helado', bread: false },
                    { day: 'miercoles', meal: 'Pasta con salsa', dessert: 'Fruta', bread: true },
                    { day: 'jueves', meal: 'Pescado con ensalada', dessert: 'Gelatina', bread: false },
                    { day: 'viernes', meal: 'Pizza', dessert: 'Alfajor', bread: true }
                ])
            }
        });
        console.log('✅ Reservation created successfully!');
    } else {
        console.log('✅ User already has a reservation for this week.');
    }

    console.log(`\n🎉 DONE! Login with ${user.email} to test the ratings.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
