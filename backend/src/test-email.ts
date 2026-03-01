import { Resend } from 'resend';
import prisma from './utils/prisma';
import { RESEND_API_KEY } from './config/env';

async function testEmail() {
    console.log('--- Iniciando prueba de correo ---');
    console.log('RESEND_API_KEY configurada:', !!RESEND_API_KEY);

    if (!RESEND_API_KEY) {
        console.error('❌ ERROR: RESEND_API_KEY no está configurada en las variables de entorno.');
        process.exit(1);
    }

    const resend = new Resend(RESEND_API_KEY);

    try {
        // Buscar un usuario administrador para enviarle la prueba
        const adminUser = await prisma.user.findFirst({
            where: { role: { in: ['admin', 'superadmin'] } }
        });

        if (!adminUser) {
            console.error('❌ ERROR: No se encontró ningún usuario administrador en la base de datos para enviar la prueba.');
            process.exit(1);
        }

        console.log(`Enviando correo de prueba a: ${adminUser.email} (${adminUser.name})`);

        const data = await resend.emails.send({
            from: 'Sistema de Reservas <no-reply@reservasrealsabor.com.uy>',
            to: [adminUser.email],
            subject: '✅ Prueba de Sistema de Correos - Real Sabor',
            html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
                <h2>¡Hola ${adminUser.name}!</h2>
                <p>Este es un correo de prueba automático para verificar que el sistema de envíos está funcionando correctamente.</p>
                <p>Si estás leyendo esto, ¡la configuración de Resend ha sido un éxito! 🎉</p>
                <br>
                <small>Sistema de Reservas Real Sabor</small>
            </div>
            `
        });

        console.log('✅ Correo enviado con éxito!');
        console.log('Respuesta de Resend:', data);

    } catch (error) {
        console.error('❌ ERROR al enviar el correo:');
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

testEmail();
