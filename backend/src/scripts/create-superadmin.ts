import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Script Seguro de Creación de SuperAdmin ---');

  const {
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
    ADMIN_NAME,
    ADMIN_FUNC_NUMBER,
    ADMIN_DOCUMENT_ID,
    FORCE_CREATION
  } = process.env;

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !ADMIN_NAME || !ADMIN_FUNC_NUMBER || !ADMIN_DOCUMENT_ID) {
    console.error('❌ Error: Faltan variables de entorno obligatorias.');
    console.error('Uso: Asegúrate de configurar ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME, ADMIN_FUNC_NUMBER, ADMIN_DOCUMENT_ID y luego ejecutar npm run seed:superadmin');
    process.exit(1);
  }

  // Normalización
  const email = ADMIN_EMAIL.trim().toLowerCase();
  const funcNumber = ADMIN_FUNC_NUMBER.replace(/\s+/g, '').toUpperCase();
  const documentId = ADMIN_DOCUMENT_ID.trim();
  const name = ADMIN_NAME.trim();

  try {
    const superAdmins = await prisma.user.count({ where: { role: 'superadmin' } });

    if (superAdmins > 0 && FORCE_CREATION !== 'true') {
      console.log('⚠️ Ya existe al menos un SuperAdmin en la base de datos.');
      console.log('Para crear otro de forma forzada, agrega FORCE_CREATION=true a las variables de entorno.');
      process.exit(0);
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { funcNumber },
          { documentId }
        ]
      }
    });

    if (existingUser) {
      console.log(`⚠️ Un usuario con el correo, Nro de funcionario o documento ya existe (Rol actual: ${existingUser.role}).`);
      
      if (existingUser.role !== 'superadmin') {
        console.log(`Ascendiendo a ${email} a superadmin...`);
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { role: 'superadmin', isEmailVerified: true }
        });
        console.log('✅ Usuario ascendido a SuperAdmin con éxito.');
      } else {
        console.log('✅ El usuario ya es SuperAdmin.');
      }
    } else {
      console.log(`Creando nuevo SuperAdmin (${email})...`);
      const passwordHash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
      
      await prisma.user.create({
        data: {
          email,
          passwordHash,
          name,
          funcNumber,
          documentId,
          role: 'superadmin',
          isEmailVerified: true,
        },
      });
      console.log('✅ SuperAdmin creado con éxito.');
    }
  } catch (error: any) {
    const safeMessage = error?.message ? error.message.substring(0, 300) : 'Error desconocido';
    console.error(`❌ Error ejecutando el script: ${safeMessage}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
