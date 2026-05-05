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
