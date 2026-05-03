# Contexto tecnico del proyecto Real Sabor

Documento de contexto para transferir el proyecto a otro agente IA o a Claude Code sin tener que reanalizar el repositorio desde cero.

## 1. Descripcion del proyecto

Real Sabor es una aplicacion web de reservas de comidas para una empresa o servicio de alimentacion. No es un e-commerce: no hay carrito, checkout ni pagos. El sistema permite que funcionarios reserven su menu semanal, que administradores gestionen menus, usuarios, reservas y reportes, y que superadministradores configuren parametros criticos de operacion.

Problema que resuelve:

- Centraliza las reservas semanales de comida de empleados.
- Evita planillas manuales y conteos a mano para cocina/produccion.
- Permite saber quien reservo, quien falta reservar y que platos tienen mayor demanda.
- Da al administrador reportes operativos para preparar comidas, postres, pan y turnos.

Estado actual:

- Aplicacion funcional y desplegada.
- Frontend en produccion en `https://reservasrealsabor.com.uy`.
- Backend en produccion en `https://api.reservasrealsabor.com.uy`.
- Backend alojado en Railway con PostgreSQL.
- Frontend alojado en Vercel.
- Sistema endurecido para produccion: healthchecks, readiness, rate limiting, logs sanitizados, validacion de entorno, proteccion de imagenes grandes/base64, roles en tiempo real, timezone Uruguay.
- Suite backend con tests automatizados amplia.
- Pendiente principal: terminar flujo de importacion real de usuarios CSV, pulir UI avanzada y validar operacion masiva con usuarios reales.

## 2. Stack tecnico completo

Backend:

- Lenguaje: TypeScript.
- Runtime: Node.js.
- Framework HTTP: Express `^4.18.2`.
- ORM: Prisma `^5.22.0`.
- Base de datos: PostgreSQL.
- Auth: JWT con `jsonwebtoken ^9.0.2`.
- Password hashing: `bcryptjs ^2.4.3`.
- Validacion: Zod `^4.1.13`.
- Seguridad HTTP: Helmet `^8.1.0`.
- CORS: `cors ^2.8.5`.
- Rate limit: `express-rate-limit ^8.2.1`.
- Logs: Winston `^3.19.0`, `winston-daily-rotate-file ^5.0.0`, Morgan.
- Emails: Resend `^6.9.2` como proveedor preferido, Nodemailer `^8.0.1` como fallback SMTP.
- QR: `qrcode ^1.5.3`.
- Cron/jobs: `node-cron ^4.2.1`.
- Tests: Vitest `^4.0.15`, Supertest `^7.1.4`.
- Deploy backend: Railway con Dockerfile.

Frontend:

- Lenguaje: TypeScript.
- Framework UI: React `^19.2.0`.
- Bundler: Vite `^7.2.4`.
- Routing: React Router DOM `^7.9.6`.
- Estado auth: Zustand `^5.0.8`.
- Iconos: Lucide React `^0.575.0`.
- Graficos/reportes: Recharts `^3.5.1`.
- PDF/export: jsPDF `^3.0.4`, jspdf-autotable `^5.0.2`.
- CSV/XLSX: xlsx `^0.18.5`.
- Imagenes: browser-image-compression, react-image-crop.
- Anti-bot opcional: `@marsidev/react-turnstile ^1.4.2`.
- Deploy frontend: Vercel.

Servicios externos:

- Railway: backend + PostgreSQL.
- Vercel: frontend.
- Cloudflare/DNS: dominios `reservasrealsabor.com.uy` y `api.reservasrealsabor.com.uy`.
- Resend: emails transaccionales.
- SMTP opcional como fallback.
- Cloudflare Turnstile opcional.

## 3. Estructura de carpetas

Backend, hasta 3 niveles:

```text
backend/
  Dockerfile
  package.json
  tsconfig.json
  vitest.config.ts
  .env.example
  prisma/
    schema.prisma                 # Modelo de datos Prisma
    migrations/
      20260216232724_init/
      20260429000000_add_missing_columns/
      20260429100000_add_reservation_unique_constraint/
      migration_lock.toml
  src/
    app.ts                        # Configuracion Express, middlewares, rutas, healthchecks
    index.ts                      # Bootstrap del servidor, Prisma connect, startup logs
    schemas.ts                    # Schemas Zod principales
    config/
      env.ts                      # Validacion/export de variables de entorno
    controllers/
      admin.controller.ts         # Usuarios, roles, preview CSV
      auth.controller.ts          # Registro, login, reset password, perfil
      menu.controller.ts          # Menu semanal
      qr.controller.ts            # QR admin
      ratings.controller.ts       # Calificacion de platos
      reportsController.ts        # Reportes avanzados
      reservation.controller.ts   # Reservas, ventana, sin reserva
      settings.controller.ts      # Configuracion del sistema
      stats.controller.ts         # Estadisticas y semanas disponibles
    jobs/
      reminder.ts
      reminder.job.ts             # Recordatorios programados
    middleware/
      auth.ts                     # JWT, roles, mantenimiento
      errorHandler.ts             # Sanitizacion y manejo global de errores
      rateLimiter.ts              # Login/global rate limits
      validate.ts                 # Middleware Zod
    routes/
      admin.routes.ts
      auth.routes.ts
      menu.routes.ts
      qr.routes.ts
      ratings.routes.ts
      reportsRoutes.ts
      reservation.routes.ts
      settings.routes.ts
      stats.routes.ts
    scripts/
      create-superadmin.ts        # Crea/asciende superadmin desde env vars
      ops-check.ts                # Chequeo operativo de DB/menu/reservas
    services/
      email.service.ts            # Servicio centralizado de emails
    types/
      express.d.ts                # Tipado de req.user
    utils/
      dates.ts                    # Fechas operativas America/Montevideo
      logger.ts                   # Winston logger
      prisma.ts                   # Prisma client singleton
      turnstile.ts
      validators.ts               # Validadores, imagenes seguras
  tests/
    admin.test.ts
    auth.test.ts
    authMiddleware.test.ts
    dates.test.ts
    email.test.ts
    errorHandler.test.ts
    health.test.ts
    menu.test.ts
    permissions.test.ts
    ratings.test.ts
    reservation.test.ts
    validators.test.ts
```

Frontend, hasta 3 niveles:

```text
frontend/
  Dockerfile
  package.json
  tsconfig.json
  vite.config.ts
  vercel.json
  index.html
  .env.example
  api/
    [...path].js                  # Proxy/handler para Vercel si aplica
  public/
    assets/
      background.png
      logo_real_sabor_clean.png
      real_sabor_favicon.ico
    vite.svg
  src/
    api.ts                        # Cliente API centralizado
    App.tsx                       # Rutas frontend y guards principales
    main.tsx
    types.ts
    components/
      CsvPreviewPanel.tsx         # Preview de carga masiva CSV
      HelpButton.tsx
      HelpModal.tsx
      Layout.tsx
      LoadingScreen.tsx
      ThemeToggle.tsx
      WeeklyTotalsReport.tsx
      WeekPicker.tsx
    context/
      SettingsContext.tsx
      ThemeContext.tsx
      ToastContext.tsx
    hooks/
      useAuthStore.ts             # Zustand auth/session
    pages/
      AdminDashboard.tsx          # Panel admin principal
      AdminSettingsPage.tsx
      AuthPage.tsx                # Login/registro/forgot password modal
      MaintenancePage.tsx
      PrintPage.tsx
      ProfilePage.tsx
      ReportsPage.tsx
      ResetPage.tsx
      ResetPasswordPage.tsx
      UserDashboard.tsx           # Reserva usuario y ratings
      VerifyEmailPage.tsx
    styles/
      global.css
      help-modal.css
      theme.css
    utils/
      cacheReset.ts
```

Notas:

- Hay carpetas locales como `backend/logs`, `backend/data`, `backend/backups` y scripts auxiliares locales. No deben considerarse nucleo de producto.
- No commitear dumps, backups ni secretos.

## 4. Modelo de datos

Resumen conceptual del schema Prisma:

### User

Representa funcionarios, admins y superadmins.

Campos clave:

- `id`: UUID.
- `email`: unico.
- `name`.
- `passwordHash`.
- `role`: `user`, `admin` o `superadmin`.
- `funcNumber`: numero de funcionario, unico.
- `documentId`: documento/CI, opcional pero unico si existe.
- `phoneNumber`.
- `photoUrl`.
- `preferences`.
- `isEmailVerified`.
- `verificationToken`.
- `createdAt`, `updatedAt`.

Relaciones:

- Muchas reservas.
- Muchos password resets.
- Muchas calificaciones de platos.

### Settings

Configuracion global del sistema. Funciona como tabla singleton.

Campos clave:

- `companyName`.
- `logoUrl`.
- Colores visuales (`primaryColor`, `secondaryColor`, `accentColor`).
- `deadlineDay`: dia de cierre, default jueves.
- `deadlineTime`: hora de cierre, default `23:59`.
- `supportEmail`, `supportPhone`.
- Textos visuales de bienvenida/login.
- `maintenanceMode`.
- `announcementMessage`, `announcementType`.

### WeeklyMenu

Menu semanal por fecha de lunes (`weekStart`).

Campos clave:

- `weekStart`: string unico `YYYY-MM-DD`.
- `days`: JSON serializado como string. Contiene dias, comidas y postres.
- `breadAvailable`.
- `createdAt`, `updatedAt`.

### Reservation

Reserva semanal de un usuario.

Campos clave:

- `userId`: FK a User con cascade.
- `weekStart`: lunes operativo.
- `timeSlot`: horario de retiro.
- `selections`: JSON serializado con seleccion por dia.
- `createdAt`, `updatedAt`.

Restriccion critica:

- `@@unique([userId, weekStart])`: un usuario solo puede tener una reserva por semana.

### PasswordReset

Tokens de recuperacion de contrasena.

Campos clave:

- `token`: unico.
- `userId`.
- `expiresAt`.
- `createdAt`.

### DishRating

Calificacion de platos/postres por usuario.

Campos clave:

- `userId`.
- `reservationId`.
- `weekStart`.
- `day`.
- `itemType`: `meal` o `dessert`.
- `itemName`.
- `rating`: `liked`, `neutral`, `disliked`.

Restriccion critica:

- `@@unique([userId, weekStart, day, itemType, itemName])`.

## 5. Endpoints / API

Base URL local: `http://localhost:3001`.

Base URL produccion: `https://api.reservasrealsabor.com.uy`.

### Salud / infraestructura

| Metodo | Ruta | Proposito | Auth |
|---|---|---|---|
| GET | `/` | Ping simple de backend | Publico |
| GET | `/api/health` | Healthcheck liviano, no toca DB | Publico |
| GET | `/api/ready` | Readiness profundo, verifica PostgreSQL | Publico |

### Auth

| Metodo | Ruta | Proposito | Auth |
|---|---|---|---|
| POST | `/api/auth/register` | Registro de usuario | Publico |
| POST | `/api/auth/login` | Login por email o numero de funcionario | Publico + loginLimiter |
| GET | `/api/auth/verify-email` | Verificacion de email por token | Publico |
| POST | `/api/auth/forgot-password` | Solicitar reset de contrasena | Publico |
| POST | `/api/auth/reset` | Confirmar reset de contrasena | Publico |
| GET | `/api/auth/me` | Usuario actual | Usuario autenticado |
| PUT | `/api/auth/profile` | Actualizar perfil propio | Usuario autenticado |

### Reservas

| Metodo | Ruta | Proposito | Auth |
|---|---|---|---|
| GET | `/api/reservations/window` | Estado de ventana de reserva, semana activa y deadline | Usuario autenticado |
| POST | `/api/reservations` | Crear/actualizar reserva semanal via upsert | Usuario autenticado |
| GET | `/api/reservations/me` | Reservas del usuario actual | Usuario autenticado |
| GET | `/api/reservations/admin` | Listar reservas por semana | Admin o superadmin |
| GET | `/api/reservations/admin/without-reservation` | Usuarios sin reserva para una semana | Admin o superadmin |

### Menu

| Metodo | Ruta | Proposito | Auth |
|---|---|---|---|
| GET | `/api/menu` | Obtener menu actual/proximo | Publico |
| PUT | `/api/menu` | Crear/actualizar menu semanal | Superadmin |

### Usuarios / admin

| Metodo | Ruta | Proposito | Auth |
|---|---|---|---|
| POST | `/api/admin/users` | Crear usuario desde panel admin | Admin o superadmin |
| PUT | `/api/admin/users/:userId/details` | Editar datos de usuario | Admin o superadmin, con proteccion extra para superadmin |
| PUT | `/api/admin/users/:userId/role` | Cambiar rol | Superadmin |
| POST | `/api/admin/users/preview-csv` | Validar CSV de usuarios sin crear registros | Superadmin |

### Configuracion

| Metodo | Ruta | Proposito | Auth |
|---|---|---|---|
| GET | `/api/settings` | Obtener configuracion publica | Publico |
| PUT | `/api/settings` | Actualizar configuracion global | Superadmin |

### Reportes / estadisticas

| Metodo | Ruta | Proposito | Auth |
|---|---|---|---|
| GET | `/api/stats/weeks` | Semanas disponibles | Admin o superadmin |
| GET | `/api/stats` | Estadisticas operativas | Admin o superadmin |
| GET | `/api/reports/stats` | Reportes avanzados | Admin o superadmin |

### Ratings

| Metodo | Ruta | Proposito | Auth |
|---|---|---|---|
| GET | `/api/ratings/my` | Mis calificaciones | Usuario autenticado |
| PUT | `/api/ratings` | Crear/actualizar calificacion de plato | Usuario autenticado |
| GET | `/api/ratings/admin` | Analitica de calificaciones | Admin o superadmin |

### QR

| Metodo | Ruta | Proposito | Auth |
|---|---|---|---|
| GET | `/api/qr` | Generar QR de acceso | Admin o superadmin |

## 6. Autenticacion y roles

Funcionamiento:

- Login por email o numero de funcionario.
- Passwords hasheadas con bcrypt.
- El backend emite JWT.
- El frontend guarda token y estado auth en `localStorage` mediante Zustand.
- El cliente API centralizado `frontend/src/api.ts` agrega `Authorization: Bearer <token>` automaticamente.
- Si una respuesta devuelve 401, el frontend limpia token/auth-storage y redirige a `/login`.

Roles:

- `user`: funcionario normal. Puede reservar, ver su panel, editar perfil y calificar platos.
- `admin`: puede ver panel admin, reservas, usuarios, reportes y crear/editar usuarios. No puede cambiar roles ni modificar configuracion critica.
- `superadmin`: acceso total. Puede cambiar roles, modificar configuracion, menus y operaciones sensibles.

Proteccion backend:

- `authMiddleware` verifica JWT, pero no confia en el rol del token.
- En cada request autenticado busca el usuario actual en PostgreSQL y reconstruye `req.user` con el rol fresco de DB.
- Si un admin es degradado, pierde permisos en la siguiente request aunque su JWT anterior diga `admin`.
- `requireAdmin` permite `admin` o `superadmin`.
- `requireSuperAdmin` permite solo `superadmin`.
- Si `maintenanceMode` esta activo, usuarios normales reciben 503; admins y superadmins pueden entrar.

Proteccion frontend:

- El frontend oculta controles segun rol, pero la seguridad real vive en backend.
- Rutas admin requieren roles permitidos.

## 7. Logica de negocio critica

1. Semana operativa

- Las reservas se organizan por `weekStart`, un string `YYYY-MM-DD` que representa el lunes de la semana.
- La logica central esta en `backend/src/utils/dates.ts`.
- Se usa horario de Uruguay (`America/Montevideo`) mediante `getNowUY()`.
- Sabado y domingo activan el cambio operativo de semana para preparar la siguiente.

2. Cierre de reservas

- El cierre se configura en `Settings.deadlineDay` y `Settings.deadlineTime`.
- Por defecto: jueves 23:59.
- El endpoint `/api/reservations/window` devuelve si la ventana esta abierta, la semana activa, el motivo y el deadline.
- Las validaciones se hacen server-side; el frontend solo refleja el estado.

3. Una reserva por usuario por semana

- La DB impone `UNIQUE(userId, weekStart)`.
- El controlador usa `prisma.reservation.upsert`.
- Esto evita duplicados incluso si hay doble click o requests concurrentes.

4. Validacion de reserva

- La reserva debe apuntar a la semana activa permitida.
- Debe incluir seleccion para 5 dias.
- Cada dia debe tener comida y postre validos segun el menu de esa semana.
- Debe tener horario de retiro.
- No se permite reservar despues del deadline.

5. Menus semanales

- Los menus viven en `WeeklyMenu`.
- No se autocrean silenciosamente.
- Si falta menu, el usuario ve un mensaje claro y no puede reservar.
- Superadmin puede generar/cargar menu base.
- Cada dia debe tener al menos una comida y un postre.

6. Ratings de platos

- Los usuarios pueden calificar platos ya disponibles/disfrutados.
- No se deben calificar platos futuros.
- La calificacion es por usuario, semana, dia, tipo e item.
- Sirve para que administracion detecte platos repetibles o a mejorar.

## 8. Variables de entorno

No incluir valores reales en documentacion ni commits.

### Backend

Obligatorias o recomendadas:

- `DATABASE_URL`: conexion PostgreSQL.
- `JWT_SECRET`: secreto JWT. En produccion no puede ser el default de desarrollo.
- `FRONTEND_URL`: URL oficial del frontend.
- `NODE_ENV`: `production` en deploy real.
- `TZ`: recomendado `America/Montevideo`.

Opcionales:

- `PORT`: default `3001`.
- `BASE_URL`: base URL auxiliar si se usa.
- `RESEND_API_KEY`: API key de Resend.
- `SMTP_HOST`: host SMTP fallback.
- `SMTP_PORT`.
- `SMTP_SECURE`.
- `SMTP_USER`.
- `SMTP_PASS`.
- `SMTP_FROM`.
- `TURNSTILE_SECRET_KEY`.

Variables operativas temporales:

- `ADMIN_EMAIL`.
- `ADMIN_PASSWORD`.
- `ADMIN_NAME`.
- `ADMIN_FUNC_NUMBER`.
- `ADMIN_DOCUMENT_ID`.
- `ADMIN_PHONE_NUMBER`.

Estas se usan para `npm run seed:superadmin` y deben borrarse luego.

### Frontend

- `VITE_API_BASE`: URL base del backend.
- `VITE_TURNSTILE_SITE_KEY`: site key publica Turnstile, si aplica.

## 9. Comandos comunes

Backend:

```bash
cd backend
npm install
npm run dev
npm test
npm run build
npm start
```

Prisma:

```bash
cd backend
npx prisma generate
npx prisma migrate dev
npx prisma migrate deploy
npx prisma studio
```

Operacion backend:

```bash
cd backend
npm run seed:superadmin
npm run ops:check
```

Frontend:

```bash
cd frontend
npm install
npm run dev
npm run build
npm run preview
```

Deploy:

- Backend Railway: Dockerfile + `npm start`.
- `npm start` ejecuta `npx prisma migrate deploy && node dist/index.js`.
- Frontend Vercel: `npm run build`.
- Nunca usar `prisma db push` en produccion.
- En produccion, usar siempre migraciones: `npx prisma migrate deploy`.

## 10. Estado actual y pendientes

Funcionando:

- Login, registro, verificacion de email y reset password.
- Roles `user`, `admin`, `superadmin`.
- Invalidacion de permisos por request usando rol fresco desde DB.
- Reservas semanales con upsert y constraint unico.
- Deadlines en horario Uruguay.
- Gestion de menus actual/proximo.
- Panel admin con reservas, usuarios, menu, reportes y configuracion.
- Usuarios sin reserva por semana.
- Reportes operativos y exportaciones.
- Ratings de platos.
- Emails transaccionales con Resend y fallback SMTP.
- Healthcheck `/api/health` y readiness `/api/ready`.
- Rate limiting compatible con oficina de IP compartida.
- Logs sanitizados.
- Proteccion contra payloads grandes y URLs de imagen inseguras.
- Preview CSV de usuarios sin tocar DB.

Pendientes relevantes:

- Implementar importacion real de CSV luego del preview, con confirmacion explicita del superadmin.
- Mejorar aun mas UI responsive del admin y reportes.
- Rehearsal real de backup/restore de PostgreSQL.
- Verificar entregabilidad real de Resend con SPF/DKIM/DMARC y limites del plan.
- Probar carga con 200 usuarios reales o simulados.
- Monitorear primer cierre real de reservas.
- Optimizar bundle frontend: existe warning por chunk grande.
- Evaluar lazy loading de reportes, xlsx, jsPDF y graficos.
- Revisar limpieza de scripts locales, logs y artefactos no productivos.

Bugs o observaciones conocidas:

- El warning de chunk grande en Vite es conocido y no bloquea build.
- Algunos textos pueden verse con caracteres raros en PowerShell por encoding de consola; revisar en editor UTF-8 antes de tocar masivamente.
- La importacion CSV aun valida pero no crea usuarios.
- Los reportes PDF pueden consumir memoria si se generan masivamente.

## 11. Decisiones tecnicas tomadas

- La seguridad real se aplica en backend, no en UI.
- Los roles se revalidan contra DB en cada request autenticado.
- Las reservas usan constraint unico + upsert atomico.
- Las fechas de negocio se calculan siempre con `America/Montevideo`.
- `Settings` centraliza configuracion de negocio y visual.
- Los menus y selecciones se guardan como JSON serializado en strings Prisma.
- Las validaciones de input principales usan Zod y validadores propios.
- Los errores pasan por un error handler que sanitiza datos sensibles y trunca strings largos.
- Los emails estan centralizados en `email.service.ts`.
- En produccion, el sistema no debe simular envio de emails si no hay proveedor configurado.
- El backend expone `/api/health` sin DB y `/api/ready` con DB para diferenciar app viva vs DB viva.
- `trust proxy = 1` es necesario en Railway para que `express-rate-limit` lea correctamente IPs proxied.
- Los payloads JSON estan limitados a 1 MB.
- Las imagenes no aceptan `data:` ni base64; solo URLs `https://` o rutas internas whitelisted.
- Las migraciones son la unica via valida para cambios de DB en produccion.
- No se deben guardar backups, dumps SQL ni secretos en Git.

## 12. Riesgos conocidos

Riesgos tecnicos:

- Bundle frontend grande. Puede afectar primera carga en conexiones lentas.
- Reportes PDF/Excel pueden consumir RAM si se usan con muchos usuarios o semanas grandes.
- Menus y reservas usan JSON serializado; es flexible, pero dificulta queries complejas y reportes avanzados.
- La importacion masiva de usuarios aun no esta completa.
- Algunos scripts locales de seed/test pueden ser peligrosos si se ejecutan contra produccion por error.

Riesgos operativos:

- Si Resend no tiene dominio verificado, los emails pueden caer en spam.
- El plan gratuito de Resend puede no alcanzar para onboarding de 200 usuarios en un mismo dia.
- Si no se configuran backups reales en Railway/Postgres, la recuperacion ante error humano depende de snapshots del proveedor.
- Un cambio de deadline mal configurado puede abrir/cerrar reservas en un horario inesperado.
- Cualquier deploy backend debe verificar `/api/health`, `/api/ready`, login y una reserva de prueba.

Riesgos de producto:

- El panel admin todavia puede mejorar en claridad para usuarios no tecnicos.
- La experiencia movil debe revisarse con usuarios reales.
- El onboarding de 200 funcionarios necesita comunicacion clara por WhatsApp/email y soporte durante el primer dia.
- Las calificaciones de platos deben mostrarse al admin de forma accionable, no solo como datos crudos.

Checklist minimo antes de un cambio importante:

```bash
cd backend
npm test
npx tsc --noEmit

cd ../frontend
npm run build
```

Checklist minimo post-deploy:

```text
1. Abrir https://api.reservasrealsabor.com.uy/api/health
2. Abrir https://api.reservasrealsabor.com.uy/api/ready
3. Probar login superadmin
4. Verificar menu de semana activa/proxima
5. Crear o actualizar una reserva de prueba
6. Confirmar que aparece en admin/reportes
7. Revisar logs de Railway por errores 500, 401 inesperados o emails fallidos
```
