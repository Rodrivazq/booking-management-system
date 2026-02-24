import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Script de Creación de Administrador ---');

  const email = process.argv[2];
  const password = process.argv[3];
  const name = process.argv[4] || 'Admin General';
  const funcNumber = process.argv[5] || 'ADMIN001';

  if (!email || !password) {
    console.error('⚠️ Uso: npx ts-node src/scripts/create-admin.ts <email> <password> <name?> <funcNumber?>');
    process.exit(1);
  }

  try {
    const existingAdmin = await prisma.user.findUnique({
      where: { email },
    });

    if (existingAdmin) {
      console.log(`⚠️ El usuario ${email} ya existe.`);
      // Opcionalmente actualizar el rol si ya existe un usuario normal y queremos aceederlo.
      if (existingAdmin.role !== 'superadmin') {
         console.log(`Actualizando rol de ${email} a superadmin...`);
         await prisma.user.update({
             where: { email },
             data: { role: 'superadmin' }
         });
         console.log('✅ Rol actualizado correctamente.');
      }
    } else {
      const passwordHash = bcrypt.hashSync(password, 10);
      const newAdmin = await prisma.user.create({
        data: {
          email,
          passwordHash,
          name,
          role: 'superadmin',
          funcNumber,
        },
      });
      console.log(`✅ Administrador ${newAdmin.email} creado con éxito.`);
    }
  } catch (error) {
    console.error('❌ Error ejecutando el script:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
