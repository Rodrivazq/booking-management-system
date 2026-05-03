# Real Sabor — Sistema de reservas de comida corporativa

## Contexto del proyecto

App web de reservas de menú semanal para los empleados de una empresa
servida por una cantina. NO es un e-commerce: no hay carrito, checkout
ni pagos. Funcionarios reservan menú semanal, admins gestionan menús,
usuarios y reportes.

**Estado:** desplegada en producción. Lanzamiento previsto: lunes 11
de mayo de 2026, ~200 empleados. Semana del 4 al 10: hardening final,
importación de usuarios, verificación de entregabilidad de email,
prueba de carga, observabilidad. Tolerancia a errores: baja.

Para el plan operativo día por día de la semana de lanzamiento, ver
`LAUNCH_PLAN.md`.

**URLs producción:**
- Frontend: https://reservasrealsabor.com.uy (Vercel)
- Backend:  https://api.reservasrealsabor.com.uy (Railway)
- DB: PostgreSQL en Railway

## Stack

### Backend
- TypeScript + Node.js + Express ^4.18
- Prisma ^5.22 + PostgreSQL
- Auth: JWT (jsonwebtoken) + bcryptjs
- Validación: Zod ^4.1
- Seguridad: Helmet, CORS, express-rate-limit
- Logs: Winston + winston-daily-rotate-file
- Emails: Resend (preferido) + Nodemailer (fallback SMTP)
- Tests: Vitest + Supertest
- Cron: node-cron
- Observabilidad: Sentry (captura de errores en backend)

### Frontend
- React ^19 + Vite ^7 + TypeScript
- React Router DOM ^7
- Estado auth: Zustand
- Reportes: Recharts, jsPDF, jspdf-autotable, xlsx

## Estructura

```
real-sabor/
├── backend/
│   ├── prisma/                      # Schema y migrations
│   └── src/
│       ├── app.ts                   # Configuración Express
│       ├── index.ts                 # Bootstrap
│       ├── controllers/             # admin, auth, menu, reservation, reports, etc.
│       ├── routes/                  # Rutas API
│       ├── middleware/              # auth, errorHandler, rateLimiter, validate
│       ├── services/                # email.service.ts
│       ├── utils/                   # dates, logger, prisma, validators
│       ├── jobs/                    # reminder.job.ts
│       └── scripts/                 # create-superadmin, ops-check
└── frontend/
    └── src/
        ├── api.ts                   # Cliente API centralizado
        ├── App.tsx                  # Rutas y guards
        ├── components/
        ├── context/                 # Settings, Theme, Toast
        ├── hooks/                   # useAuthStore (Zustand)
        ├── pages/                   # AdminDashboard, UserDashboard, etc.
        └── styles/
```

## Modelo de datos (resumen)

- **User** — funcionarios, admins, superadmins. Campos: email, name,
  passwordHash, role (`user|admin|superadmin`), funcNumber (único),
  documentId, phoneNumber, isEmailVerified.
- **WeeklyMenu** — menú por semana operativa. Cada día con comidas y
  postres. No se autocrea silenciosamente.
- **Reservation** — una por usuario por semana. Constraint único
  `(userId, weekStart)`. Selecciones almacenadas como JSON string.
- **Settings** — config global: deadlineDay, deadlineTime, modo
  mantenimiento, parámetros visuales.
- **Rating** — calificación por usuario/semana/día/tipo/item, solo
  sobre platos ya disponibles.

## Reglas de negocio críticas

1. **Semana operativa:** `weekStart` = lunes (`YYYY-MM-DD`). Lógica en
   `utils/dates.ts`. Timezone fijo `America/Montevideo`. Sábado y
   domingo activan el cambio operativo a la semana siguiente.
2. **Cierre de reservas:** según `Settings.deadlineDay/Time`. Default:
   jueves 23:59. Validación server-side. Endpoint
   `/api/reservations/window` informa estado.
3. **Una reserva por usuario por semana:** constraint único en DB +
   `prisma.reservation.upsert`. Resiste doble click y races.
4. **Validación de reserva:** debe ser semana activa, 5 días con
   comida y postre del menú vigente, horario de retiro, antes del
   deadline.
5. **Menús no se autocrean:** si falta menú, el usuario ve mensaje
   claro y no puede reservar. Solo superadmin carga menú base.
6. **Ratings:** solo platos ya disfrutados, nunca futuros.

## Convenciones técnicas (no negociables)

- **Seguridad real en backend, NO en UI.** El frontend solo refleja.
- **Roles se revalidan contra DB en cada request autenticado** — no
  confiar en lo que vino en el JWT viejo.
- **Validación con Zod** en la entrada de cada endpoint.
- **Errores → middleware central** (`errorHandler.ts`) que sanitiza
  datos sensibles y trunca strings largos.
- **Emails centralizados** en `email.service.ts`. Si no hay proveedor
  en producción, NO simular envío.
- **Migrations son la única vía válida** para cambios de DB en
  producción. NUNCA `prisma db push` contra prod.
- **`trust proxy = 1`** en Railway (necesario para rate-limit con IP
  proxied).
- **Payloads JSON limitados a 1 MB.**
- **Imágenes:** solo URLs `https://` o rutas internas whitelisted.
  Prohibido `data:` / base64.
- **Nunca commitear:** dumps SQL, backups, secretos, archivos `.env`.

## Comandos comunes

### Backend
```bash
cd backend
npm install
npm run dev          # desarrollo
npm test             # Vitest
npm run build        # compilar TS
npm start            # prod (corre migrate deploy + node dist/index.js)
```

### Prisma
```bash
cd backend
npx prisma generate
npx prisma migrate dev       # desarrollo
npx prisma migrate deploy    # producción (NUNCA db push en prod)
npx prisma studio
```

### Operación
```bash
cd backend
npm run seed:superadmin      # crea/asciende superadmin desde env
npm run ops:check            # chequeo operativo de DB/menú/reservas
```

### Frontend
```bash
cd frontend
npm install
npm run dev
npm run build
npm run preview
```

## Healthchecks y observabilidad

- `GET /api/health` — app viva (sin tocar DB)
- `GET /api/ready` — DB viva (con consulta real)
- Sentry configurado en backend para captura de errores no manejados
  y errores 500. DSN en variable de entorno `SENTRY_DSN`. Revisar
  dashboard de Sentry como parte del monitoreo post-deploy.

## Reglas para Claude Code en este proyecto

1. **Antes de cambios estructurales o multi-archivo, proponé el plan
   y esperá confirmación.** No edites sin avisar.
2. **No "limpies" código que no te pedí tocar.** Si ves algo raro,
   marcalo, no lo arregles.
3. **No agregues dependencias sin justificar el porqué.** Esta app
   ya tiene un stack maduro; sumar libs es deuda.
4. **Si ves un riesgo de seguridad o de producción, decímelo aunque
   no te lo haya preguntado.**
5. **Mantené los tests pasando.** Si rompés algo en tests, arreglalo
   en el mismo cambio o avisame antes de seguir.
6. **No toques `/prisma/migrations/` ya aplicadas.** Solo crear
   migrations nuevas con `npx prisma migrate dev --name <nombre>`.
7. **Cuando trabajes con fechas, usá los helpers de `utils/dates.ts`
   con timezone Uruguay.** No uses `new Date()` directo para lógica
   de negocio.
8. **Cualquier endpoint nuevo:** validación Zod + auth/role correctos
   + manejo de error consistente con el resto.
9. **Antes de declarar "listo" un cambio:** correr `npm test` en
   backend y `npm run build` en frontend.
10. **Si te falta contexto de un archivo, leelo.** No inventes.
11. **Conservadurismo técnico hasta estabilizar el lanzamiento.**
    Hasta el 11 de junio de 2026 (un mes post-lanzamiento), no
    proponer refactors, optimizaciones de bundle ni cambios de UI
    que no resuelvan un bug bloqueante. Estabilidad > prolijidad.
12. **Scripts que tocan producción** (importación masiva, seeds,
    cleanups, fixes de datos) requieren los cinco: idempotencia
    comprobada con tests, confirmación explícita del operador en
    runtime, dry-run probado en staging primero, plan de rollback
    documentado, y reporte estructurado de qué se hizo (creados,
    saltados, fallidos).

## Variables de entorno (referencia, sin valores reales)

### Backend obligatorias
- `DATABASE_URL` — PostgreSQL
- `JWT_SECRET` — en prod nunca default
- `FRONTEND_URL`
- `NODE_ENV=production`
- `TZ=America/Montevideo`

### Backend opcionales
- `PORT` (default 3001), `BASE_URL`, `RESEND_API_KEY`,
  `SMTP_HOST/PORT/SECURE/USER/PASS/FROM`, `TURNSTILE_SECRET_KEY`,
  `SENTRY_DSN`

### Backend temporales (borrar después de usar)
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`, `ADMIN_FUNC_NUMBER`,
  `ADMIN_DOCUMENT_ID`, `ADMIN_PHONE_NUMBER` (usadas por
  `seed:superadmin`)

### Frontend
- `VITE_API_BASE` — URL backend
- `VITE_TURNSTILE_SITE_KEY` (opcional)

## Pendientes pre-lanzamiento (objetivo: 11/5/2026)

- Importación real de usuarios desde CSV con confirmación de
  superadmin, idempotencia y reporte estructurado. Cierre objetivo:
  martes 5/5.
- Verificación SPF/DKIM/DMARC en Resend para entregabilidad. Cierre
  objetivo: domingo 3/5.
- Rehearsal de backup/restore de PostgreSQL contra entorno de
  staging. Cierre objetivo: lunes 4/5.
- Prueba de carga con ~100-200 usuarios concurrentes en staging.
  Cierre objetivo: martes 5/5.
- Configuración de Sentry y alertas básicas en Railway. Cierre
  objetivo: miércoles 6/5.
- Plan de rollback documentado. Cierre objetivo: miércoles 6/5.
- Importación CSV ejecutada en producción + comunicación a empleados.
  Cierre objetivo: jueves 7/5.
- Monitoreo del primer cierre real de reservas: jueves 14/5,
  22:00-00:30.

## Pendientes post-lanzamiento (no antes del 11/6/2026)

- Bundle frontend grande (warning Vite). Evaluar lazy loading de
  reportes/xlsx/jsPDF.
- Optimizaciones de UI del admin para uso prolongado.
- Endurecer política DMARC de `p=none` a `p=quarantine` o `p=reject`
  una vez confirmada entregabilidad sostenida.
- Limpieza de scripts locales y artefactos no productivos del repo.

## Riesgos a tener en mente

- **Resend sin dominio verificado** → emails a spam.
- **Plan free de Resend** puede no alcanzar para onboarding de 200
  usuarios en un mismo día.
- **Backups Railway** dependen del proveedor si no se configuran
  manualmente. Sin rehearsal de restore, el backup es ilusorio.
- **Deadline mal configurado** puede abrir/cerrar reservas a destiempo.
- **Reportes PDF/Excel masivos** pueden consumir RAM.
- **Carga concurrente nunca medida.** El sistema no fue probado con
  50-100 reservas simultáneas. El día del cierre es el peor momento
  posible para descubrir un bottleneck de pool de conexiones, rate
  limit o memoria.
- **Falta de observabilidad activa hasta configurar Sentry.** Sin
  alertas, un error 500 en producción se descubre por reporte de
  usuario, no por monitoreo. Mitigar antes del 6/5.

## Checklist mínima antes de un cambio importante

```bash
cd backend && npm test && npx tsc --noEmit
cd ../frontend && npm run build
```

## Checklist post-deploy

1. `GET /api/health` → 200
2. `GET /api/ready` → 200
3. Login superadmin
4. Verificar menú de semana activa/próxima
5. Crear/actualizar reserva de prueba
6. Confirmar que aparece en admin/reportes
7. Revisar logs Railway: 500s, 401s inesperados, emails fallidos
8. Revisar dashboard Sentry: errores no manejados últimas 2hs
