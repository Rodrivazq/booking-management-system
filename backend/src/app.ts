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

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://booking-management-system-steel.vercel.app"
    ],
    credentials: true
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// Routes
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
