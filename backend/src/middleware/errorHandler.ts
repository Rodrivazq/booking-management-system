import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

// Definimos una interfaz para nuestros errores personalizados si los hubiera
interface CustomError extends Error {
  statusCode?: number;
}

export const errorHandler = (
  err: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error(`🔥 Error no manejado en ${req.method} ${req.originalUrl}: ${err.message}`, {
    stack: err.stack,
    ip: req.ip,
    body: req.body,
    query: req.query
  });

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Error interno del servidor';

  // En producción no enviamos el "stack" del error por razones de seguridad
  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};
