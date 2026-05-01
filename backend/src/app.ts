import express from 'express';
import cors from 'cors';
import path from 'path';

import authRoutes from './routes/auth.routes';
import menuRoutes from './routes/menu.routes';
import reservationRoutes from './routes/reservation.routes';
import adminRoutes from './routes/admin.routes';
import qrRoutes from './routes/qr.routes';
import reportsRoutes from './routes/reportsRoutes';
import settingsRoutes from './routes/settings.routes';
import statsRoutes from './routes/stats.routes';
import ratingsRoutes from './routes/ratings.routes';

import { startReminderCron } from './jobs/reminder';
import helmet from 'helmet';
import { globalLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';

import morgan from 'morgan';
import logger, { stream } from './utils/logger';
import prisma from './utils/prisma';
import { NODE_ENV, TZ } from './config/env';
import { getNextMonday } from './utils/dates';

const app = express();

// -----------------------------
// LOGGING Y SEGURIDAD BÁSICA
// -----------------------------
app.use(morgan(':method :url :status :res[content-length] - :response-time ms', { stream }));

app.use(helmet());
// -----------------------------
// CORS PRO (dominio final + localhost + previews de Vercel)
// -----------------------------

const allowedOrigins = new Set([
  'http://localhost:5173',
  'https://reservasrealsabor.com.uy',
  'https://www.reservasrealsabor.com.uy',
]);

const isAllowedOrigin = (origin: string) => {
  if (allowedOrigins.has(origin)) return true;

  try {
    const url = new URL(origin);
    // acepta cualquier preview de Vercel
    if (url.protocol === 'https:' && url.hostname.endsWith('.vercel.app')) return true;
  } catch {
    // origin inválido => bloqueado
  }

  return false;
};

const corsOptions: cors.CorsOptions = {
  origin: (origin, cb) => {
    // Permite requests sin origin (Postman / server-to-server)
    if (!origin) return cb(null, true);

    const ok = isAllowedOrigin(origin);

    // IMPORTANTE: NO tirar error, devolver true/false
    return cb(null, ok);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// -----------------------------
// HEALTH CHECK
// -----------------------------

app.get('/api/health', (_req, res) => {
  res.json({ 
    ok: true, 
    service: 'reservas-api',
    env: NODE_ENV,
    timezone: TZ,
    timestamp: new Date().toISOString(),
    nextMonday: getNextMonday() 
  });
});

app.get('/api/ready', async (_req, res) => {
  try {
    // Simple query to verify database connection
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      ok: true,
      database: 'ok',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('[Readiness Check] Database connectivity failed', { reason: 'prisma_query_failed' });
    res.status(503).json({
      ok: false,
      database: 'error',
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/', (_req, res) => {
  logger.info("Health check ping recibido en /");
  res.send('Backend API Running');
});

// -----------------------------
// LIMITER
// -----------------------------
app.use('/api/', globalLimiter);

// -----------------------------
// CACHE CONTROL
// -----------------------------
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  next();
});

// -----------------------------
// MIDDLEWARES
// -----------------------------

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// -----------------------------
// ROUTES
// -----------------------------

app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/ratings', ratingsRoutes);

// -----------------------------
// MANEJO DE ERRORES GLOBAL
// -----------------------------
app.use(errorHandler);

export default app;