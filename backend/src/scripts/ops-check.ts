import { PrismaClient } from '@prisma/client';
import { getCurrentMonday, getNextMonday } from '../utils/dates';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Verificación Operativa de Producción ---');
  console.log(`Hora actual del sistema: ${new Date().toISOString()}`);
  
  try {
    // Check users
    const totalUsers = await prisma.user.count();
    const adminUsers = await prisma.user.count({ where: { role: 'admin' } });
    const superAdminUsers = await prisma.user.count({ where: { role: 'superadmin' } });

    console.log('\n👥 Usuarios:');
    console.log(`- Total: ${totalUsers}`);
    console.log(`- Admins: ${adminUsers}`);
    console.log(`- SuperAdmins: ${superAdminUsers}`);

    // Check Menus
    const currentWeekMonday = getCurrentMonday();
    const nextWeekMonday = getNextMonday();

    const currentMenu = await prisma.weeklyMenu.findUnique({
      where: { weekStart: currentWeekMonday }
    });

    const nextMenu = await prisma.weeklyMenu.findUnique({
      where: { weekStart: nextWeekMonday }
    });

    console.log('\n🍽️ Menús:');
    console.log(`- Semana Actual (${currentWeekMonday}): ${currentMenu ? '✅ Configurado' : '❌ NO Configurado'}`);
    console.log(`- Próxima Semana (${nextWeekMonday}): ${nextMenu ? '✅ Configurado' : '❌ NO Configurado'}`);

    // Check Reservations
    const currentReservations = await prisma.reservation.count({
      where: { weekStart: currentWeekMonday }
    });

    const nextReservations = await prisma.reservation.count({
      where: { weekStart: nextWeekMonday }
    });

    console.log('\n📅 Reservas:');
    console.log(`- Semana Actual: ${currentReservations}`);
    console.log(`- Próxima Semana: ${nextReservations}`);

    console.log('\n✅ Chequeo operativo finalizado con éxito.');

  } catch (error: any) {
    const safeMessage = error?.message ? error.message.substring(0, 300) : 'Error desconocido';
    console.error(`\n❌ Error ejecutando el chequeo operativo: ${safeMessage}`);
  } finally {
    await prisma.$disconnect();
  }
}

main();
