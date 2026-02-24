import cron from 'node-cron';
import { Resend } from 'resend';
import prisma from '../utils/prisma';
import { RESEND_API_KEY, FRONTEND_URL } from '../config/env';

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

const getNextMonday = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = (8 - day) % 7 || 7;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + diff);
    nextMonday.setHours(0, 0, 0, 0);
    return nextMonday.toISOString().slice(0, 10);
};

export const startReminderJob = () => {
    // Se ejecuta todos los dias a las 09:00 AM hora del servidor
    cron.schedule('0 9 * * *', async () => {
        try {
            console.log('[Cron] Iniciando Job de Recordatorios de Reservas...');
            
            const settings = await prisma.settings.findUnique({ where: { id: 1 } });
            if (!settings) return;

            const deadlineDay = settings.deadlineDay !== undefined ? settings.deadlineDay : 3;
            const now = new Date();
            const dayOfWeek = now.getDay();
            
            const currentDayAdjusted = dayOfWeek === 0 ? 7 : dayOfWeek;
            const deadlineDayAdjusted = deadlineDay === 0 ? 7 : deadlineDay;

            const diffDays = deadlineDayAdjusted - currentDayAdjusted;

            // Enviar recordatorios si faltan 3 dias, 2 dias, 1 dia o estamos en el dia de cierre.
            if (diffDays >= 0 && diffDays <= 3) {
                const isFinalDay = diffDays === 0;
                const weekStart = getNextMonday();

                const usersWithoutReservation = await prisma.user.findMany({
                    where: {
                        isEmailVerified: true,
                        role: { in: ['user', 'admin'] }, // Excluimos superadmins
                        reservations: {
                            none: { weekStart }
                        }
                    }
                });

                if (usersWithoutReservation.length === 0) {
                    console.log('[Cron] Todos los usuarios han reservado para la semana del ' + weekStart);
                    return;
                }

                console.log(`[Cron] Faltan ${diffDays} dias para el cierre. Enviando ${usersWithoutReservation.length} recordatorios.`);

                if (resend) {
                    // Agrupar los envíos en un batch maximo de 50 si la lista es grande (limites basales de APIs)
                    // Haremos envios asincronos en promesas
                    const emailPromises = usersWithoutReservation.map(user => {
                        return resend.emails.send({
                            from: 'App de Reservas <no-reply@reservasrealsabor.com.uy>',
                            to: [user.email],
                            subject: isFinalDay ? '🔴 ÚLTIMO DÍA: Cierre de Reservas' : '⚠️ Recordatorio: Reserva tu menú de la próxima semana',
                            html: `
                            <div style="font-family: Arial, sans-serif; background-color: #f4f4f5; padding: 40px 20px; text-align: center;">
                                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                                    <h2 style="color: #111827; font-size: 24px; margin-bottom: 20px; font-weight: bold;">App de Reservas</h2>
                                    <h3 style="color: #eab308; font-size: 20px; margin-bottom: 20px;">
                                        ${isFinalDay ? '¡Hoy cierran las reservas!' : 'No olvides reservar tu comedor'}
                                    </h3>
                                    <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                                        Hola <strong>${user.name}</strong> 👋.<br><br>
                                        Hemos notado que aún no has ingresado tus opciones de comedor para la semana del <strong>${weekStart}</strong>.<br><br>
                                        Recuerda que tienes hasta el <strong>${['','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'][deadlineDayAdjusted]}</strong> a las ${settings.deadlineTime} para hacer tu pedido.
                                    </p>
                                    <a href="${FRONTEND_URL}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: bold; font-size: 16px;">
                                        Ir a Reservar Ahora
                                    </a>
                                </div>
                            </div>
                            `
                        }).catch(e => console.error(`[Cron] Error enviando a ${user.email}:`, e));
                    });

                    await Promise.allSettled(emailPromises);
                    console.log(`[Cron] Envio de recordatorios finalizado.`);
                } else {
                    console.log('[Cron] (Mock) Simulando envio de correos porque Resend no está configurado..');
                }
            } else {
                console.log(`[Cron] No se envían recordatorios hoy. Diferencia de días: ${diffDays}`);
            }

        } catch (error) {
            console.error('[Cron] Error running reminder job:', error);
        }
    });
};
