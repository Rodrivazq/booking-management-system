import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

// Definimos una interfaz para nuestros errores personalizados si los hubiera
interface CustomError extends Error {
  statusCode?: number;
}

const SENSITIVE_KEYS = ['password', 'token', 'reset', 'authorization', 'photourl', 'secret', 'apikey'];

function sanitizeForLog(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    return obj.length > 500 ? obj.substring(0, 500) + '...[TRUNCATED]' : obj;
  }
  if (typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForLog(item));
  }

  const sanitized: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.some(sk => lowerKey.includes(sk))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeForLog(obj[key]);
      }
    }
  }
  return sanitized;
}

export const errorHandler = (
  err: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const sanitizedBody = req.body ? sanitizeForLog(req.body) : undefined;
  const sanitizedQuery = req.query ? sanitizeForLog(req.query) : undefined;

  logger.error(`🔥 Error no manejado en ${req.method} ${req.originalUrl}: ${err.message}`, {
    stack: err.stack,
    ip: req.ip,
    body: sanitizedBody && Object.keys(sanitizedBody).length ? sanitizedBody : undefined,
    query: sanitizedQuery && Object.keys(sanitizedQuery).length ? sanitizedQuery : undefined
  });

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Error interno del servidor';

  // En producción no enviamos el "stack" del error por razones de seguridad
  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};
