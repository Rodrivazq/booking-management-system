# Plan de Rollback

Documento operativo para revertir cambios en producción cuando un deploy
o un incidente afecta el servicio. Complementa, no reemplaza,
`docs/BACKUP_AND_RECOVERY.md` (estrategia de backup y referencias de
restore) y `docs/OPERATIONS_RUNBOOK.md` (procedimientos diarios).

Este doc agrega: **criterios de decisión, escenarios paso a paso,
validación post-rollback y plan específico para el lanzamiento del
11/5/2026**.

---

## 1. Criterios de decisión

Antes de tirar el rollback, decidir qué tipo de respuesta corresponde.
Las tres opciones son: **hotfix**, **rollback** y **restore de DB**. La
elección equivocada puede empeorar el incidente.

### 1.1. Cuándo hacer rollback

Activar rollback de inmediato si **cualquiera** de estos se cumple
después de un deploy:

- `/api/health` o `/api/ready` devuelven 5xx más de 2 minutos.
- Login de usuarios reales (no de prueba) falla con 5xx.
- Reservas no se guardan: el usuario clickea "Reservar", el backend
  devuelve 5xx o estado inconsistente.
- Admin no puede acceder al panel.
- Errores no manejados en Sentry crecen >5x respecto a la línea base
  de la última hora estable.
- Emails dejan de salir y la causa se rastrea al deploy reciente.
- Datos visibles incorrectos a múltiples usuarios (no a uno).

### 1.2. Cuándo NO hacer rollback (preferir hotfix)

Hacer un **fix nuevo** y desplegarlo en lugar de rollback si:

- El bug es cosmético (texto mal, color, layout).
- El bug afecta a un solo usuario o a un caso de borde reproducible.
- El deploy ya se promovió hace varias horas y se acumularon datos
  nuevos válidos: rollbackear el código puede dejar el código viejo
  leyendo datos con un schema/forma que no entiende.
- Hubo migración Prisma destructiva en este deploy (rollback de código
  no revierte schema; ver §1.3).
- El error es de configuración (variable de entorno faltante o mal):
  arreglar la variable y redeployar es más limpio que rollback.

### 1.3. Cuándo escalar a restore de DB

El rollback de código **no toca la DB**. Escalar a restaurar el último
backup de Postgres si:

- Una migración Prisma destructiva borró/renombró columnas o tablas.
- Un script (`seed-200.ts`, importación CSV, fix manual) corrió contra
  producción y dejó la DB en estado inconsistente.
- Aparecen registros duplicados o corrompidos a escala (no un caso
  puntual).
- Un actor no autorizado modificó datos.

Nunca restaurar DB sin: backup previo del estado actual (sí, antes del
restore), responsable presente, ventana de mantenimiento anunciada,
prueba previa en entorno seguro si la severidad lo permite. Ver
`BACKUP_AND_RECOVERY.md` §C y §D.

### 1.4. Tabla rápida de decisión

| Síntoma | Hace cuánto deployó | Hubo migración | Acción |
|---|---|---|---|
| Build verde, healthcheck 5xx | < 30 min | No | Rollback |
| Build verde, healthcheck 5xx | < 30 min | Sí | Rollback + revisar migración |
| Build verde, healthcheck 5xx | > 2 hs | No | Hotfix preferido |
| Build verde, healthcheck OK, bug visible | cualquiera | No | Hotfix |
| Datos corruptos a escala | cualquiera | Sí (script o migración) | Restore DB |
| Variable env faltante | cualquiera | No | Arreglar var + redeploy |
| Compromiso de credenciales | cualquiera | No | Rotación inmediata + audit |

---

## 2. Tiempos objetivo (RTO)

| Etapa | RTO target | Cómo |
|---|---|---|
| Detectar incidente | < 5 min | Healthcheck externo, Sentry, alertas Railway |
| Decidir rollback | < 5 min | Esta tabla §1.4 |
| Ejecutar rollback backend | < 5 min | Railway -> Deployments -> Redeploy estable |
| Ejecutar rollback frontend | < 3 min | Vercel -> Deployments -> Promote |
| Validación post-rollback | < 10 min | §6 |
| Total RTO target | **< 30 min** | |

Durante la **ventana de lanzamiento** (lunes 11/5 9:00 a viernes 15/5
12:00) bajar este target a **< 15 min total**, con monitoreo activo
constante.

---

## 3. Pre-condiciones de rollback

Tener a mano antes de ejecutar:

- Hash del **último commit estable conocido** (registrar después de cada
  deploy validado, ver §7).
- Acceso a Railway dashboard (backend + Postgres service).
- Acceso a Vercel dashboard.
- Acceso a `git` localmente con permisos de push si se va a hotfix.
- Canal de comunicación a usuarios definido (ver §5).
- Variables `.env.production` documentadas en archivo seguro (NO en repo).

Si falta alguno de estos, detenerse y resolverlo antes de tocar nada.

---

## 4. Escenarios y procedimientos

### 4.1. Deploy backend roto (build OK, runtime falla)

**Síntomas:** `/api/health` 5xx, logs Railway con stack trace, deploy
"Active" en Railway pero el servicio no responde.

**Procedimiento:**

1. Confirmar el incidente: `curl -i https://api.reservasrealsabor.com.uy/api/health`.
2. Abrir Railway -> backend service -> Deployments.
3. Identificar el deploy anterior con tag "Successful" y commit hash
   conocido como estable.
4. Click en el deploy anterior -> menu (...) -> **Redeploy**.
5. Esperar build + start (~1-2 min).
6. Reverificar `/api/health` y `/api/ready`.
7. Ejecutar §6 (validación post-rollback).
8. Abrir incidente en `INCIDENT_RESPONSE_TEMPLATE.md`.
9. Investigar causa en logs del deploy roto **sin redesplegarlo**.

### 4.2. Deploy backend con migración Prisma rota

**Síntomas:** backend arranca pero queries fallan; o build falla en
`prisma migrate deploy` durante start (`npm start` corre
`prisma migrate deploy` antes de `node dist/index.js`).

**Procedimiento:**

1. **No** redeployar el commit anterior aún. La migración nueva ya se
   aplicó parcial o totalmente al schema en DB; volver al código viejo
   con un schema nuevo puede romper más.
2. Identificar qué migración corrió: Railway logs del deploy actual,
   buscar `Applying migration` o `Migration X failed`.
3. Si la migración es **aditiva** (agrega columna/tabla nullable o con
   default): generalmente segura de mantener. Hacer rollback de código
   y volver a desplegar (§4.1) — el código viejo simplemente ignora la
   columna nueva.
4. Si la migración es **destructiva** (drop columna, rename, change
   type sin compatibilidad): no rollbackear sin restore.
   - Crear migración inversa nueva en una rama hotfix (ej: re-agregar
     columna borrada) y deployar esa.
   - O restore de DB desde el último backup pre-migración + redeploy
     del código pre-migración. Ver `BACKUP_AND_RECOVERY.md` §D.
5. Si la migración falló a mitad (estado inconsistente):
   `prisma migrate resolve` puede destrabarla, **solo con backup
   previo**. No usar `prisma db push` en producción.
6. Documentar y planificar el fix antes de cualquier acción que toque
   schema.

### 4.3. Deploy frontend roto

**Síntomas:** página en blanco, JS error en consola, 404 en assets,
mismatch de versiones cliente-servidor.

**Procedimiento:**

1. Abrir Vercel dashboard -> proyecto frontend -> Deployments.
2. Identificar deploy anterior con estado "Ready" y commit estable.
3. Click en el deploy anterior -> menu (...) -> **Promote to Production**.
4. Confirmar.
5. Hard refresh en browser (Ctrl+Shift+R) para invalidar cache.
6. Probar `reservasrealsabor.com.uy/login` en incógnito.
7. Verificar que la consola no tenga errores y que las llamadas a la
   API resuelvan.

Frontend roto NO afecta DB ni backend. Es el rollback más seguro.

### 4.4. Bug funcional (todo deploya, pero los usuarios no pueden operar)

**Síntomas:** healthchecks OK, no hay errores en logs, pero la lógica
del flujo está rota (ej: deadline mal configurado, validación
incorrecta, race condition).

**Procedimiento:**

1. Confirmar reproducibilidad: hacer el flujo afectado con cuenta de
   prueba.
2. Decidir entre rollback (§4.1) y hotfix según tabla §1.4.
3. Si la causa es **datos** (Settings mal configurado, deadline mal
   puesto), **no rollback de código** — corregir desde el panel admin
   y verificar.
4. Si la causa es **código**, rollback al último commit estable y
   trabajar el fix en branch nueva.

### 4.5. Datos corrompidos por script o migración

**Síntomas:** registros duplicados, campos vacíos a escala, usuarios
con datos cruzados, reservas en semanas inválidas.

**Procedimiento:**

1. **Detener inmediatamente** cualquier script o job que pudiera estar
   ejecutándose (cron de recordatorios, importación CSV en curso).
2. Hacer **backup del estado actual** (corrompido) antes de tocar
   nada — sirve de evidencia y para deshacer la recuperación si sale
   mal.
3. Evaluar magnitud: ¿cuántas filas? ¿qué tablas? ¿desde cuándo?
4. Si afecta < 10 registros y son identificables: corregir desde panel
   admin o con SQL puntual.
5. Si afecta más: restore desde el último backup válido pre-incidente.
   Asumir pérdida de datos legítimos generados entre el backup y el
   incidente (reservas hechas en ese tramo). Ver §5 sobre comunicación.
6. Después del restore, reprocesar manualmente lo que se pueda
   reconstruir desde logs (registros, reservas) si vale la pena.

### 4.6. Compromiso de credenciales

**Síntomas:** API key de Resend en captura pública, `JWT_SECRET` en
git history, password de Postgres expuesto, comportamiento sospechoso
de cuentas admin.

**Procedimiento:**

1. **Rotar inmediatamente** la credencial comprometida:
   - **`RESEND_API_KEY`**: Resend dashboard -> revoke -> generate new
     -> actualizar en Railway env vars -> redeploy backend.
   - **`JWT_SECRET`**: generar nuevo secret (`openssl rand -hex 64`),
     actualizar en Railway, redeploy. **Esto invalida todas las sesiones
     activas** — comunicar a usuarios que vuelvan a loguear.
   - **`DATABASE_URL` password**: Railway permite rotar la password de
     Postgres. Después de rotar, redeploy backend para que tome la
     nueva URL. Cambiar la URL local también.
2. Auditar logs de los últimos días para detectar accesos no
   autorizados.
3. Si hubo cambios indebidos en datos, considerar restore (§4.5).
4. Documentar en incidente y revisar cómo se filtró la credencial para
   evitar repetición.
5. Si el incidente es severo (cuentas tomadas, datos exfiltrados),
   evaluar notificar a usuarios afectados.

### 4.7. Cuotas/rate limit alcanzados

**Síntomas:** Resend devuelve `monthly_quota_exceeded` o
`rate_limit_exceeded`, los emails de verificación dejan de enviarse,
los usuarios nuevos quedan bloqueados sin poder activar cuenta.

**Procedimiento:**

1. Confirmar en Resend dashboard que el límite está pegado.
2. Pausar inmediatamente cualquier envío masivo (importación CSV en
   curso).
3. Para usuarios ya creados sin email: el admin puede setear
   `isEmailVerified=true` manualmente en `User` desde la consola
   admin si lo soporta, o vía SQL puntual con autorización.
4. Upgrade del plan Resend si la situación lo amerita, o esperar al
   reset del ciclo.
5. Comunicar a usuarios afectados por canal alternativo (WhatsApp
   interno) cómo activar cuenta sin email.

Nota: el bug de Resend resolved-with-error (commit `02dbf33`) ya está
mitigado y el sistema ahora detecta y loguea estos errores en lugar de
fingir éxito.

### 4.8. DB caída

**Síntomas:** `/api/ready` 503, errores de conexión en logs Railway,
servicio Postgres detenido en Railway dashboard.

**Procedimiento:**

1. Revisar Railway -> Postgres service -> está running, hay disco
   disponible, no hay alertas.
2. Si está caído, intentar **Restart** desde el dashboard.
3. Revisar conexiones activas: si están saturadas (pool agotado),
   revisar si hay un job/script consumiendo conexiones.
4. Si el problema persiste y es de Railway, no hay más opción que
   esperar y comunicar a usuarios.
5. **No tocar el dump ni intentar restore** salvo que se confirme
   pérdida de datos. Una DB caída por carga o problema temporal de
   infra no necesita restore.

---

## 5. Comunicación durante incidente

### 5.1. Canales

- **Interno (admin/tech):** WhatsApp grupo del equipo, o canal definido
  por la organización.
- **Usuarios:** banner en la app si está accesible
  (`AnnouncementBanner` component existe en frontend), email masivo
  como respaldo, WhatsApp del canal interno como último recurso.

### 5.2. Plantillas de mensaje

**Mantenimiento planificado / rollback voluntario:**
> "Estamos haciendo una actualización del sistema. La app puede tener
> intermitencias entre HH:MM y HH:MM. Las reservas existentes están
> seguras."

**Incidente activo:**
> "Detectamos un problema con [funcionalidad]. Estamos trabajando en
> resolverlo. Las reservas hechas antes de las HH:MM están guardadas.
> Próxima actualización a las HH:MM."

**Restore con pérdida de datos:**
> "Hubo un problema operativo y tuvimos que restaurar la base a las
> HH:MM del [fecha]. Si hiciste una reserva o cambio entre HH:MM y
> HH:MM, por favor revisá tu cuenta y rehacelo si hace falta. Lamentamos
> el inconveniente."

**Resolución:**
> "El problema con [funcionalidad] está resuelto. Si seguís teniendo
> dificultades, refrescá la página o cerrá sesión y volvé a entrar."

### 5.3. Cuándo comunicar

- Si el incidente afecta a > 1 usuario y dura > 5 min: comunicar al
  equipo interno.
- Si dura > 15 min y afecta el flujo principal (login, reserva): banner
  en la app + mensaje en canal interno.
- Si requiere acción del usuario (rehacer reserva, cambiar password):
  email + banner + canal interno.

---

## 6. Validación post-rollback

Después de cualquier rollback, ejecutar este smoke en orden. Si un
paso falla, **no asumir que el rollback funcionó**. Investigar.

1. **Healthchecks:**
   - `curl https://api.reservasrealsabor.com.uy/api/health` -> 200, `env: production`, `timezone: America/Montevideo`.
   - `curl https://api.reservasrealsabor.com.uy/api/ready` -> 200, `database: ok`.
2. **Frontend carga:** abrir `reservasrealsabor.com.uy` en incógnito.
   No errores rojos en consola browser.
3. **Login funciona:**
   - Login válido -> ingresa al panel correcto según rol.
   - Login inválido -> mensaje "Credenciales invalidas" (no "Sesión
     expirada").
4. **Flujo de reserva:** con cuenta de prueba, hacer una reserva nueva
   y confirmar que aparece en panel admin.
5. **Logs Railway últimos 5 min:** sin errores 500 ni stack traces
   inesperados.
6. **Sentry últimos 5 min:** sin errores nuevos a tasa anormal.
7. **Email de prueba:** disparar un "olvidé contraseña" con cuenta de
   prueba, verificar recepción y que el log de Railway muestre
   `[Email Service] Sent email via Resend ... id=...`.
8. **Estado de menús:** en panel admin, confirmar que el menú de la
   semana actual y la próxima están cargados.

Solo cuando los 8 pasos pasan, considerar el rollback exitoso y
documentarlo.

---

## 7. Plan específico para el lanzamiento (11/5/2026)

### 7.1. Pre-launch (días previos, ya en curso)

- [ ] Tag git del último commit estable pre-launch:
      `git tag -a release-v1.0 <hash> -m "Pre-launch stable"` y
      `git push origin release-v1.0`.
- [ ] Backup de DB inmediato antes del primer login masivo
      (`BACKUP_AND_RECOVERY.md` §B/§C).
- [ ] Documento operativo con: hash de release, link a deploy Railway
      activo, link a deploy Vercel activo, link al backup. Pinear en
      el canal interno.
- [ ] Variables `.env.production` confirmadas en Railway y respaldadas
      en archivo seguro (NO repo).
- [ ] Healthchecks externos configurados (uptime monitor, Sentry).

### 7.2. Día del lanzamiento (lunes 11/5)

**8:00 - 9:00 (pre-apertura):**

- [ ] Confirmar `/api/health` y `/api/ready` 200.
- [ ] Confirmar deploy Railway en estado "Active" con el hash del
      release tag.
- [ ] Confirmar deploy Vercel en producción con el hash del release tag.
- [ ] Login de prueba con cuenta admin.
- [ ] Smoke completo §6.
- [ ] Backup de DB pre-apertura.

**9:00 - 17:00 (operación primer día):**

- Monitoreo activo de Sentry y logs Railway cada 30 min.
- Cualquier 500 sostenido > 2 min: rollback inmediato sin discusión.
- Cualquier error de email a tasa > 5%: pausar onboarding y revisar.
- Si rollback se ejecuta: comunicar al equipo interno antes y después.

**17:00 - 24:00 (primera tarde):**

- Backup de DB al cierre del día.
- Review de logs y Sentry del día.
- Si todo OK, confirmar al equipo que el sistema queda en operación
  normal.

### 7.3. Primera semana (12-15/5)

- Backup diario de DB.
- Review diario de Sentry primera hora del día.
- Cualquier rollback en este período: **declarar incidente** y
  documentar con `INCIDENT_RESPONSE_TEMPLATE.md`.
- Cierre de reservas del jueves 14/5 (22:00-00:30): monitoreo activo,
  con responsable técnico disponible.

### 7.4. Primer mes (hasta 11/6)

Per CLAUDE.md regla 11, no hacer refactors ni cambios no críticos.
Solo deploys de bug fix bloqueante. Cada deploy debe quedar registrado
con su commit hash en el doc operativo y su backup pre-deploy.

---

## 8. Apéndice: comandos de referencia

### 8.1. Identificar último commit estable

```bash
git log origin/develop --oneline -10
```

El que se identifique como estable en el doc operativo es el target
de rollback.

### 8.2. Rollback rápido vía git revert (si Railway no permite redeploy directo)

```bash
git checkout main
git pull origin main
git revert <hash-del-deploy-roto> --no-edit
git push origin main
git checkout origin/develop
git cherry-pick <revert-commit>
git push origin HEAD:develop
```

Esto crea un commit nuevo que **deshace** el cambio roto y dispara
auto-deploy en Railway. Más limpio en historia que el "Redeploy" desde
dashboard, pero más lento (~3-5 min vs 1-2 min).

### 8.3. Verificar versión desplegada

```bash
curl -s https://api.reservasrealsabor.com.uy/api/health | jq
```

Si `/api/health` devuelve un campo `version` o `commit` (futuro
trabajo: instrumentar esto), confirmar que coincide con lo esperado.

### 8.4. Generar nuevo `JWT_SECRET`

```bash
openssl rand -hex 64
```

Pegar en Railway env var, redeploy. Invalida todas las sesiones
activas.

### 8.5. Verificar last successful migration

```bash
cd backend
npx prisma migrate status
```

Lista las migraciones aplicadas vs pendientes.

---

## 9. Quién aprueba qué

| Acción | Aprobador mínimo |
|---|---|
| Rollback de frontend | Soporte técnico |
| Rollback de backend (sin migración) | Soporte técnico |
| Rollback con migración aditiva | Soporte técnico + aviso a SuperAdmin |
| Rollback con migración destructiva | SuperAdmin |
| Restore de DB | SuperAdmin |
| Rotación de credenciales | SuperAdmin |
| Comunicación masiva a usuarios | SuperAdmin |

---

## 10. Cosas que NO hacer

- **No** ejecutar `prisma db push` en producción. Nunca.
- **No** hacer `git reset --hard` ni `force push` a `main` o `develop`
  durante un incidente — registra el revert como commit nuevo.
- **No** restaurar un backup sin un backup previo del estado actual.
- **No** comunicar masivamente a usuarios sin aprobación de SuperAdmin.
- **No** rotar credenciales sin avisar al equipo (las sesiones activas
  caen).
- **No** asumir que rollback de código revierte cambios de DB.
- **No** redesplegar el commit roto para "ver si esta vez anda".
- **No** dar fechas/horas de resolución que no se pueden cumplir.

---

## 11. Referencias

- `docs/BACKUP_AND_RECOVERY.md` — estrategia de backup, comandos
  pg_dump/pg_restore, tabla de incidentes comunes.
- `docs/OPERATIONS_RUNBOOK.md` — checklists diarios, semanales,
  monitoreo manual.
- `docs/INCIDENT_RESPONSE_TEMPLATE.md` — plantilla para documentar
  incidentes.
- `docs/EMAIL_DELIVERABILITY_GUIDE.md` — diagnóstico y mitigación de
  problemas de email.
- `CLAUDE.md` — reglas operativas del proyecto, política de migrations,
  ventanas críticas.
