import app from './app';
import { PORT } from './config/env';

import prisma from './utils/prisma';

const startServer = async () => {
  try {
    await prisma.$connect();
    console.log('✅ Conexión a base de datos exitosa');

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error);
    process.exit(1);
  }
};

startServer();

