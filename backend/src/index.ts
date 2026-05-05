import app from './app';
import { PORT, FRONTEND_URL, RESEND_API_KEY, SMTP, NODE_ENV, TZ } from './config/env';
import logger from './utils/logger';
import prisma from './utils/prisma';
import { startReminderCron } from './jobs/reminder';

// Process Error Handlers
process.on('uncaughtException', (err: any) => {
  const message = err?.message || 'Unknown error';
  logger.error('🔥 Uncaught Exception:', { message, stack: err?.stack });
  // Optional: decide if you want to crash or stay alive. In production, crashing and letting PM2/Railway restart is safer.
  process.exit(1);
});

process.on('unhandledRejection', (reason: any) => {
  const message = reason?.message || String(reason) || 'Unknown reason';
  logger.error('🔥 Unhandled Rejection:', { message });
  // Same as above
  process.exit(1);
});

const startServer = async () => {
  try {
    await prisma.$connect();
    
    // Determine email provider safely
    let emailProvider = 'none';
    if (RESEND_API_KEY) emailProvider = 'resend';
    else if (SMTP.host) emailProvider = 'smtp';

    // Safe Startup Logs
    logger.info('✅ Conexión a base de datos exitosa');
    logger.info('🔧 Configuraciones Críticas:');
    logger.info(`   - NODE_ENV: ${NODE_ENV}`);
    logger.info(`   - TZ: ${TZ}`);
    logger.info(`   - FRONTEND_URL: ${FRONTEND_URL}`);
    logger.info(`   - Email Provider: ${emailProvider}`);

    app.listen(PORT, "0.0.0.0", () => {
      logger.info(`🚀 Servidor escuchando en puerto ${PORT}`);
    });

    // Start reminder cron after server is up. Was imported in app.ts but never
    // invoked — confirmed in audit. Critical for the reservation deadline
    // reminder flow before the first cierre on 14/5.
    await startReminderCron();
  } catch (error: any) {
    logger.error('❌ Error al iniciar el servidor:', { message: error?.message });
    process.exit(1);
  }
};

startServer();

