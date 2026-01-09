import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    // v7+ uses 'limit'. The old code used 'max'.
    limit: 100, 
    message: 'Demasiados intentos de inicio de sesión, por favor intente nuevamente después de 15 minutos',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
