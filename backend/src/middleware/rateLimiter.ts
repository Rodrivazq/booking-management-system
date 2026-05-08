import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Request } from 'express';

// Helper: lee el email del body (asumiendo express.json ya parseó). Si no
// hay email (body vacío, o tipo distinto), cae a la IP del request. Esto
// es importante para los empleados que usan la WiFi corporativa: todos
// salen con la misma IP pública pero cada uno tiene su propio email único,
// así que el cap por-email no los pisa entre sí.
function emailKey(req: Request): string {
    const email = req.body?.email;
    if (typeof email === 'string' && email.trim()) {
        return `email:${email.trim().toLowerCase()}`;
    }
    // Fallback IP-safe (handles IPv6 prefixing per express-rate-limit guideline).
    return `ip:${ipKeyGenerator(req.ip || '')}`;
}

export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    // 1000 / 15min para tolerar el caso de ~200 empleados detrás de la misma
    // IP NAT corporativa intentando loguear en horario pico. No dispara
    // emails así que el riesgo de abuso es solo CPU/bcrypt.
    limit: 1000,
    message: 'Demasiados intentos de inicio de sesión, por favor intente nuevamente después de 15 minutos',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Por IP. Generoso porque los 200 empleados van a auto-registrarse desde la
// MISMA WiFi corporativa entre el 11 y 14/5 — un cap chico (5/15min)
// bloqueaba a los empleados legítimos. La defensa real contra abuso de
// envío de emails está en (a) constraint único de email en DB, (b) daily
// quota global en email.service.ts (300/24h), (c) Turnstile cuando se
// active. Acá solo evitamos un blast obvio.
export const registerLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 150,
    message: 'Demasiados intentos de registro desde esta red. Probá de nuevo en 15 minutos.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Por EMAIL (no IP). 3/15min por dirección de correo. Defensa contra abuso
// del reenvío de verificación: un atacante con una sola dirección no puede
// pedir más de 3 reenvíos por 15min, sin importar desde dónde llame.
// Empleados legítimos en la misma WiFi corporativa no se bloquean entre sí
// porque cada uno tiene su propio email.
export const resendVerificationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 3,
    keyGenerator: emailKey,
    message: 'Demasiados intentos de reenvío para este correo. Probá de nuevo en 15 minutos.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Por EMAIL (no IP), mismo razonamiento que resendVerification. 5/15min
// cubre el flujo legítimo (usuario que pide reset, no le llega o se le
// vence el link, pide otro). Atacante anónimo necesita conocer N emails
// distintos para mandar N x 5 resets en 15min — barrera real.
export const forgotPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    keyGenerator: emailKey,
    message: 'Demasiados intentos de recuperación para este correo. Probá de nuevo en 15 minutos.',
    standardHeaders: true,
    legacyHeaders: false,
});

export const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    // 20000 / 15min para que el cierre de reservas del jueves (200 usuarios
    // todos haciendo upsert + reads desde la misma IP corporativa) no toque
    // el techo.
    limit: 20000,
    message: 'Demasiadas peticiones desde esta IP, por favor intenta más tarde.',
    standardHeaders: true,
    legacyHeaders: false,
});
