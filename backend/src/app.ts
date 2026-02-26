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

import { startReminderJob } from './jobs/reminder.job';

const app = express();

startReminderJob();

// ---- CORS PRO ----
const allowedOrigins = new Set([
  'http://localhost:5173',
  'https://reservasrealsabor.com.uy',
  'https://www.reservasrealsabor.com.uy',
]);

const vercelPreviewRegex = /^https:\/\/booking-management-system-[a-z0-9-]+\.vercel\.app$/;

const corsOptions: cors.CorsOptions = {
  origin: (origin, cb) => {
    // Permite requests sin origin (Postman, server-to-server, etc.)
    if (!origin) return cb(null, true);

    const ok = allowedOrigins.has(origin) || vercelPreviewRegex.test(origin);

    // MUY IMPORTANTE: si no está permitido, NO tires error.
    // Devolvé "false" para que CORS lo bloquee sin romper nada.
    return cb(null, ok);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
// preflight usando *las mismas opciones*
app.options('*', cors(corsOptions));

// ---- Middlewares ----
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// ---- Routes ----
app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/settings', settingsRoutes);

app.get('/api/health', (_req, res) => {
  const today = new Date();
  const day = today.getDay();
  const diff = (8 - day) % 7 || 7;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + diff);
  nextMonday.setHours(0, 0, 0, 0);

  res.json({ ok: true, nextMonday: nextMonday.toISOString().slice(0, 10) });
});

app.get('/', (_req, res) => {
  res.send('Backend API Running');
});

export default app;