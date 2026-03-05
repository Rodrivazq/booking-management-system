import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    // v7+ uses 'limit'. The old code used 'max'.
    limit: 100, 
    message: 'Demasiados intentos de inicio de sesión, por favor intente nuevamente después de 15 minutos',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

export const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 500, // Limit each IP to 500 requests per `window` (here, per 15 minutes)
    message: 'Demasiadas peticiones desde esta IP, por favor intenta más tarde.',
    standardHeaders: true,
    legacyHeaders: false,
});
