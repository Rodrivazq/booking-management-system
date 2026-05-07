import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    // 1000 / 15min para tolerar el caso de ~200 empleados detrás de la misma
    // IP NAT corporativa intentando loguear en horario pico.
    limit: 1000,
    message: 'Demasiados intentos de inicio de sesión, por favor intente nuevamente después de 15 minutos',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Más agresivo que login porque cada hit dispara un email de verificación
// real (gasto de cuota Resend). 3/15min por IP cubre el caso legítimo
// (usuario que necesita reintentar 1-2 veces porque el primer envío llegó a
// spam o tipeó mal y rehace el flujo).
export const resendVerificationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 3,
    message: 'Demasiados intentos de reenvío. Probá de nuevo en 15 minutos.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Mucho más agresivo que login porque cada hit dispara un envío de email
// real (gasto de cuota Resend) y no requiere nada del lado del usuario para
// abusarlo. 5/15min por IP es suficiente para casos legítimos.
export const forgotPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 5,
    message: 'Demasiados intentos de recuperación de contraseña. Probá de nuevo en 15 minutos.',
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
