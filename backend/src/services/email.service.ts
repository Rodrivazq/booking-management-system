import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { SMTP, RESEND_API_KEY, FRONTEND_URL, NODE_ENV } from '../config/env';
import logger from '../utils/logger';

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

// ─── Daily email quota guard ────────────────────────────────────────────────
// Defensa de último recurso contra abuso del envío masivo de emails. Cuenta
// envíos en una ventana móvil de 24 hs y rechaza nuevos envíos cuando se
// supera el techo. Aún si el atacante viene desde 100 IPs distintas (esquiva
// el rate limit por IP), nunca podemos enviar más de MAX_EMAILS_PER_DAY
// emails en 24 hs.
//
// Cap configurable vía MAX_EMAILS_PER_DAY env var. Default 300, calculado
// como 1.5x el peor escenario realista (200 empleados auto-registrándose +
// margen para resends y resets legítimos en el peor día).
//
// Limitación conocida: in-memory por proceso. Si Railway escala a múltiples
// réplicas (no es el caso hoy con plan Hobby), el cap efectivo se multiplica
// por N réplicas. Para mover esto a DB hace falta una tabla nueva — defensa
// suficiente para esta etapa.
const MAX_EMAILS_PER_DAY = Number(process.env.MAX_EMAILS_PER_DAY || '300');
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const sentEmailTimestamps: number[] = [];

function isDailyQuotaExceeded(): boolean {
    const now = Date.now();
    const cutoff = now - ONE_DAY_MS;
    // Drop expired timestamps (rolling window).
    while (sentEmailTimestamps.length > 0 && sentEmailTimestamps[0] < cutoff) {
        sentEmailTimestamps.shift();
    }
    return sentEmailTimestamps.length >= MAX_EMAILS_PER_DAY;
}

function recordEmailSent(): void {
    sentEmailTimestamps.push(Date.now());
}

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

const baseEmailStyles = `
    font-family: Arial, sans-serif; 
    background-color: #f4f4f5; 
    padding: 40px 20px; 
    text-align: center;
`;

const baseCardStyles = `
    max-width: 600px; 
    margin: 0 auto; 
    background-color: #ffffff; 
    padding: 40px 30px; 
    border-radius: 8px; 
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
`;

export const sendVerificationEmail = async (user: { name: string; email: string }, verifyUrl: string) => {
    const subject = 'Confirma tu correo electrónico';
    const text = `Hola ${user.name}. Ingresa a ${verifyUrl} para verificar tu cuenta.`;
    const html = `
    <div style="${baseEmailStyles}">
        <div style="${baseCardStyles}">
            <h2 style="color: #111827; font-size: 24px; margin-bottom: 20px; font-weight: bold;">App de Reservas</h2>
            <h3 style="color: #374151; font-size: 20px; margin-bottom: 20px;">Verificación de Cuenta</h3>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                Hola <strong>${user.name}</strong> 👋.<br><br>Gracias por registrarte. Para poder ingresar a tu cuenta y empezar a reservar, necesitamos que confirmes tu dirección de correo electrónico haciendo clic en el siguiente botón:
            </p>
            <a href="${verifyUrl}" style="display: inline-block; background-color: #16a34a; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: bold; font-size: 16px;">
                Verificar mi Correo
            </a>
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                Si no creaste esta cuenta, simplemente ignora este correo.
            </p>
        </div>
    </div>
    `;

    return sendEmail(user.email, subject, text, html);
};

export const sendPasswordResetEmail = async (user: { name: string; email: string }, resetUrl: string) => {
    const subject = 'Restablecer contraseña';
    const text = `Ingresa a ${resetUrl} para definir una nueva contraseña. El enlace expira en 1 hora.`;
    const html = `
    <div style="${baseEmailStyles}">
        <div style="${baseCardStyles}">
            <h2 style="color: #111827; font-size: 24px; margin-bottom: 20px; font-weight: bold;">App de Reservas</h2>
            <h3 style="color: #374151; font-size: 20px; margin-bottom: 20px;">Restablecimiento de Contraseña</h3>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                Hola <strong>${user.name}</strong> 👋.<br><br>Hemos recibido una solicitud para restablecer tu contraseña. Si fuiste tú, puedes hacerlo haciendo clic en el siguiente botón:
            </p>
            <a href="${resetUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: bold; font-size: 16px;">
                Definir nueva contraseña
            </a>
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                Este botón será válido por <strong>1 hora</strong>. Si no solicitaste este cambio, simplemente ignora este correo y tu cuenta seguirá segura.
            </p>
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">
                Si tienes problemas con el botón, copia y pega este enlace en tu navegador:<br>
                <a href="${resetUrl}" style="color: #2563eb; word-break: break-all;">${resetUrl}</a>
            </p>
        </div>
    </div>
    `;

    return sendEmail(user.email, subject, text, html);
};

export const sendAdminCreatedUserEmail = async (user: { name: string; email: string }) => {
    const subject = 'Tu cuenta ha sido creada';
    const text = `Hola ${user.name}. Tu cuenta fue creada por un administrador. Puedes iniciar sesión o restablecer tu contraseña en ${FRONTEND_URL}/login`;
    const html = `
    <div style="${baseEmailStyles}">
        <div style="${baseCardStyles}">
            <h2 style="color: #111827; font-size: 24px; margin-bottom: 20px; font-weight: bold;">App de Reservas</h2>
            <h3 style="color: #374151; font-size: 20px; margin-bottom: 20px;">Cuenta Creada</h3>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                Hola <strong>${user.name}</strong> 👋.<br><br>Un administrador ha creado una cuenta para ti en el sistema de reservas. Si no tienes una contraseña, puedes utilizar la opción de "¿Olvidaste tu contraseña?" en la página de inicio de sesión para definir una.
            </p>
            <a href="${FRONTEND_URL}/login" style="display: inline-block; background-color: #16a34a; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: bold; font-size: 16px;">
                Ir al Inicio de Sesión
            </a>
        </div>
    </div>
    `;

    return sendEmail(user.email, subject, text, html);
};

async function sendEmail(to: string, subject: string, text: string, html: string) {
    // Nunca enviar a direcciones no enrutables (cuentas demo @*.local): rebotan
    // y ensucian la reputación/cuota del proveedor.
    if (typeof to === 'string' && to.toLowerCase().endsWith('.local')) {
        logger.warn(`[Email Service] Dirección no enrutable, se omite el envío: ${to} (${subject}).`);
        return false;
    }

    // Hard ceiling: refuse to send if the rolling 24h quota is exhausted.
    // Only enforced in production so dev/test runs don't trip on the
    // counter accumulating across many test cases.
    if (NODE_ENV === 'production' && isDailyQuotaExceeded()) {
        logger.error(`[Email Service] DAILY QUOTA EXCEEDED (${MAX_EMAILS_PER_DAY} emails/24h). Refusing to send to ${to} (${subject}). Possible abuse — investigar logs y considerar bloqueo manual.`);
        return false;
    }

    if (resend) {
        try {
            const { data, error } = await resend.emails.send({
                from: 'App de Reservas <no-reply@reservasrealsabor.com.uy>',
                to: [to],
                subject,
                html
            });
            if (error) {
                logger.error(`[Email Service] Resend error for ${to} (${subject}):`, error);
            } else {
                recordEmailSent();
                logger.info(`[Email Service] Sent email via Resend to ${to} (${subject}). id=${data?.id}`);
                return true;
            }
        } catch (error) {
            logger.error(`[Email Service] Resend error for ${to} (${subject}):`, error);
        }
    }

    if (mailer) {
        try {
            await mailer.sendMail({
                to,
                from: SMTP.from,
                subject,
                text,
                html
            });
            recordEmailSent();
            logger.info(`[Email Service] Sent email via SMTP to ${to}: ${subject}`);
            return true;
        } catch (err) {
            logger.error(`[Email Service] SMTP error for ${to} (${subject}):`, err);
        }
    }

    if (!resend && !mailer) {
        if (NODE_ENV === 'production') {
            logger.error(`[Email Service] CRITICAL ERROR: No email provider configured in PRODUCTION. Cannot send email to ${to}: ${subject}`);
            return false;
        }
        logger.warn(`[Email Service] No email provider configured. Simulated email to ${to}: ${subject}`);
        return true;
    }

    return false;
}
