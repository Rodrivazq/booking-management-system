import cron from 'node-cron';
import prisma from '../utils/prisma';
import logger from '../utils/logger';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { SMTP, RESEND_API_KEY, FRONTEND_URL } from '../config/env';

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

function createTransport() {
    if (!SMTP.host) return null;
    return nodemailer.createTransport({
        host: SMTP.host,
        port: Number(SMTP.port) || 587,
        secure: SMTP.secure,
        auth: SMTP.user ? { user: SMTP.user, pass: SMTP.pass || '' } : undefined,
    });
}

const mailer = createTransport();

const getNextMonday = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = (8 - day) % 7 || 7;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + diff);
    nextMonday.setHours(0, 0, 0, 0);
    return nextMonday.toISOString().slice(0, 10);
};

export const startReminderCron = async () => {
    // Run daily at 10 AM
    cron.schedule('0 10 * * *', async () => {
        logger.info('[CRON] Starting daily reservation reminder check');
        
        try {
            // Get settings to check deadline
            const settings = await prisma.settings.findFirst();
            if (!settings) {
                logger.warn('[CRON] No settings found, skipping reminders');
                return;
            }

            const today = new Date();
            const currentDay = today.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
            
            // deadlineDay: 0 is Domingo, 1 is Lunes, etc.
            const deadlineDay = settings.deadlineDay;

            // Simple logic: send reminder exactly 1 day before the deadline
            // Adjust map carefully since JS getDay() is 0-indexed (Sunday = 0, Monday = 1... Saturday = 6)
            const reminderDay = (deadlineDay - 1 + 7) % 7; 

            if (currentDay !== reminderDay) {
                logger.info(`[CRON] Today (${currentDay}) is not the reminder day (${reminderDay}). Deadline is ${deadlineDay}. Skipping.`);
                return;
            }

            logger.info('[CRON] Today is reminder day! Fetching pending users...');
            const nextWeekStr = getNextMonday();

            // Fetch all regular users
            const users = await prisma.user.findMany({
                where: {
                    role: 'user', // only target regular users, exclude admins
                }
            });

            // Fetch reservations for next week
            const currentReservations = await prisma.reservation.findMany({
                where: { weekStart: nextWeekStr }
            });

            const usersWithoutReservation = users.filter((u: any) => 
                !currentReservations.some((r: any) => r.userId === u.id)
            );

            logger.info(`[CRON] Found ${usersWithoutReservation.length} users without reservation for week ${nextWeekStr}`);

            let sentCount = 0;
            const companyName = settings.companyName || 'Real Sabor';

            for (const user of usersWithoutReservation) {
                if (!user.email) continue;
                
                try {
                    const subject = `[Aviso] Último día para reservar menú - ${companyName}`;
                    const customMessage = `
                        <div style="font-family: Arial, sans-serif; background-color: #f4f4f5; padding: 40px 20px; text-align: center;">
                            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                                <h2 style="color: #eab308; font-size: 24px; margin-bottom: 20px; font-weight: bold;">Recordatorio Importante ⏱️</h2>
                                <h3 style="color: #374151; font-size: 20px; margin-bottom: 20px;">Falta poco para que cierre el plazo</h3>
                                <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                                    Hola <strong>${user.name}</strong> 👋.<br><br>Hemos notado que aún no has ingresado tus opciones gastronómicas para la semana del <strong>${nextWeekStr}</strong>. Te recordamos que tienes tiempo hasta mañana, <strong>${settings.deadlineTime}</strong>. 
                                </p>
                                <a href="${FRONTEND_URL}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: bold; font-size: 16px;">
                                    Ingresar a Elegir mi Menú
                                </a>
                                <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                                    Si este mensaje se cruzó con tu reserva, por favor desestímalo. Atentamente, ${companyName}.
                                </p>
                            </div>
                        </div>
                    `;

                    if (resend) {
                        await resend.emails.send({
                            from: `${companyName} <no-reply@reservasrealsabor.com.uy>`,
                            to: [user.email],
                            subject: subject,
                            html: customMessage
                        });
                        sentCount++;
                    } else if (mailer) {
                        await mailer.sendMail({
                            to: user.email,
                            from: SMTP.from || `${companyName} <no-reply@reservasrealsabor.com.uy>`,
                            subject: subject,
                            html: customMessage
                        });
                        sentCount++;
                    } else {
                        // Dev log placeholder
                        logger.debug(`[CRON-MOCK] Sent reminder logic to: ${user.email}`);
                        sentCount++;
                    }
                } catch (err: any) {
                    logger.error(`[CRON] Error sending reminder to ${user.email}:`, err);
                }
            }

            logger.info(`[CRON] Reminders sent successfully. Count: ${sentCount}`);

        } catch (error) {
            logger.error('[CRON] Critical error executing reminder cron job:', error);
        }
    });

    logger.info('[CRON] Reminder job initialized and scheduled daily at 10:00 AM');
};
