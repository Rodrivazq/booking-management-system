# Real Sabor — Plan de lanzamiento

**Fecha objetivo de lanzamiento:** lunes 11 de mayo de 2026.
**Primer cierre operativo real:** jueves 14 de mayo, 23:59 UY.
**Documento de referencia técnica permanente:** `CLAUDE.md`.

Este documento es operativo y temporal. Una vez estabilizado el
lanzamiento (≈11 de junio de 2026), archivar o eliminar.

## Objetivo de la semana del 4 al 10 de mayo

Llegar al lunes 11 con:
- 200 usuarios reales creados en producción.
- Emails de verificación y reset llegando a Gmail/Outlook sin spam.
- Backup de Postgres con restore ensayado al menos una vez.
- Prueba de carga ejecutada y resultados aceptables.
- Sentry configurado y recibiendo eventos.
- ✅ Plan de rollback escrito (`docs/ROLLBACK_PLAN.md`, cerrado el 3/5).
- Menú de la semana del 11 cargado por superadmin.

## Plan día por día

### Sábado 2/5 — Setup de infraestructura crítica ✅ CERRADO

**Manual (Rodrigo) — completado:**
- ✅ Dominio `reservasrealsabor.com.uy` ya estaba verificado en Resend
  (verificación previa, descubierto durante la auditoría del sábado).
- ✅ SPF y DKIM ya estaban cargados y validados por Resend.
- ✅ DMARC publicado en Cloudflare con política `p=none` y
  `rua=mailto:dmarc@reservasrealsabor.com.uy`.
- ✅ Cloudflare Email Routing configurado con tres direcciones:
  `dmarc@`, `soporte@`, `no-reply@`, todas reenviando a Gmail
  personal.
- ✅ `NODE_ENV=production` seteado en Railway.
- ✅ `TZ=America/Montevideo` confirmado en Railway.
- ✅ Plan Resend identificado: actualmente Free. Decisión: subir a
  Pro antes del miércoles 6/5 (día previo a la importación masiva).
- ✅ Plan Railway: decidido NO subir a Pro por ahora. Backups
  manuales con `pg_dump` se ejecutarán durante el rehearsal del
  lunes 4/5.

**Claude Code — completado:**
- ✅ Auditoría de `email.service.ts`. Hallazgo crítico: el SDK de
  Resend 6.9.2 NO tira excepción ante errores de la API; resuelve
  con `{ data: null, error: {...} }`. El código actual ignoraba
  este caso, devolviendo `true` aunque Resend rechazara el envío.
  Confirmado como bug que ya ocurrió en producción al menos una vez.
- ✅ Fix aplicado en `email.service.ts`: desestructuración de la
  respuesta de Resend, detección del caso `{ error }` como fallo,
  caída al fallback SMTP, logs con `subject` agregado, log del `id`
  de Resend en éxito.
- ✅ 2 tests nuevos en `email.test.ts` que mockean el escenario del
  bug y verifican que el sistema lo detecta correctamente.
- ✅ `npm test` — 93/93 OK. `npx tsc --noEmit` — exit 0.

**Pendiente para arrancar el domingo:**
- ✅ Deploy del fix de `email.service.ts` a producción (deployado el 3/5,
  commits `5d12750` en main, `02dbf33` en develop).
- ✅ Verificar healthchecks `/api/health` y `/api/ready` post-deploy.

### Domingo 3/5 — Verificación de email end-to-end + importación CSV ✅ MAYORMENTE CERRADO

**Manual (Rodrigo) — completado:**
- ✅ Deploy del fix de SDK Resend ejecutado y verificado en producción.
  Logs Railway muestran `[Email Service] Sent email via Resend ...
  id=...` ante envíos reales.
- ✅ Registro real probado en Gmail (NO spam) y Outlook (✗ va a spam).
  Decisión: el problema de Outlook es **reputación de dominio nuevo**,
  no de configuración. SPF/DKIM/DMARC validados. Se acepta como riesgo
  conocido — ver §Riesgos Conocidos.
- ✅ Resend reconfigurado y funcionando perfecto (confirmado por usuario).

**Claude Code — completado:**
- ✅ Endpoint `POST /api/admin/users/import-csv` implementado en
  `backend/src/controllers/admin.controller.ts` (commit local
  `a5196b8`, pendiente de push). Cumple los 6 requisitos:
  - ✅ Idempotencia: matching por email + funcNumber + documentId.
  - ✅ Confirmación runtime con `confirm: true`.
  - ✅ Password temporal random (32 chars, `crypto.randomBytes`),
    nunca logueada ni retornada. Onboarding por "olvidé contraseña".
  - ✅ Email de bienvenida best-effort (no aborta la creación si falla).
  - ✅ Reporte estructurado `{ created, skipped, failed }` con razón
    por fila + contadores `emailsSent` / `emailsFailed`.
  - ✅ 7 tests Vitest cubriendo: missing confirm, happy path,
    idempotencia DB, duplicados internos, datos inválidos no abortan,
    fallo email no aborta, payload no-array y oversize.
- ✅ Frontend `CsvPreviewPanel` ampliado con botón "Importar
  definitivamente" (post-preview), confirm dialog, y reporte visual
  del resultado (creados/saltados/fallidos + warning de emails
  fallidos).
- ✅ Tests backend: 101/101 OK. `tsc --noEmit` clean. Frontend `vite
  build` OK.
- ✅ **Bonus: ROLLBACK_PLAN.md escrito (originalmente para 6/5,
  adelantado al 3/5)**. Commit local `8f29716`. 514 líneas con
  criterios de decisión, 8 escenarios paso a paso, plantillas de
  comunicación, smoke post-rollback, plan específico para 11/5.

**Fixes emergentes encontrados y resueltos el 3/5:**
- ✅ **Avatar upload roto** (deployado, commits `ebcd6d3` main,
  `324a59b` develop): el componente producía base64, el backend
  rechazaba con `validateImageUrl` por policy de seguridad. UI quedaba
  bloqueando el registro público y la creación admin. Fix:
  AvatarUploader pasa a display-only (toast amigable si se intenta
  upload), foto deja de ser obligatoria. La feature volverá
  post-lanzamiento con endpoint de upload real.
- ✅ **Backend `auth.controller.register` exigía `photoUrl`**
  (deployado, commits `da6a55a` main, `a8ae44b` develop): después de
  sacar la obligación en frontend, el backend seguía devolviendo 400
  "Todos los campos obligatorios son requeridos". Quitada la
  obligación + agregado test de registro sin foto.
- ✅ **Login error genérico** (deployado, commits `203bac3` main,
  `262d728` develop): `api.ts` trataba todo 401 como sesión expirada
  y enmascaraba el mensaje real del backend. Ahora solo redirige
  cuando había token; si no, propaga "Credenciales invalidas" /
  "Debes verificar tu correo" para que el usuario sepa qué pasó.
- ✅ **`tsconfig.moduleResolution: "node"` deprecation** (deployado
  con el commit anterior): cambiado a `"bundler"` (recomendado para
  Vite). Build sigue verde.

**Checkpoint:** ✅ Emails entregando OK en Gmail. Outlook a spam
(riesgo conocido). Endpoint CSV import con tests pasando local. Fix
del SDK de Resend en producción. ROLLBACK_PLAN escrito.

### Lunes 4/5 — Staging + rehearsal de backup

**Manual:**
- Antes de empezar: pushear los 2 commits locales del 3/5 que quedaron
  pendientes para review (ver §Commits locales sin pushear). Una vez
  aprobados y pusheados, mergear a develop para deploy en Railway.
- Crear staging: proyecto Railway separado con DB propia, o DB
  Postgres aparte y backend local apuntando ahí.
- `pg_dump` de producción → restaurar en staging. Este dump es
  también el primer backup verificado (decisión del sábado: no se
  paga Railway Pro por ahora; los backups son manuales).
- Documentar comandos exactos de dump y restore. Guardar fuera del
  repo. **Referencia ya cubierta:** `docs/BACKUP_AND_RECOVERY.md` §B/§C
  (comandos pg_dump/pg_restore PowerShell y Bash) y `docs/ROLLBACK_PLAN.md`
  §1.3/§4.5 (cuándo y cómo restaurar).
- Evaluar automatización de backups con servicio gratuito tipo
  SimpleBackups o Backup Ninja, o GitHub Action propia.

**Claude Code:**
- Escribir script de prueba de carga sintética
  (`scripts/load-test.ts`) usando `Promise.all` y `undici` o
  `node-fetch`. Simular 50, 100, 200 reservas concurrentes. Medir
  latencia p50/p95 y errores.

**Checkpoint:** staging con copia de prod. Restore documentado.
Importación CSV probada contra staging con CSV de 10 usuarios falsos
(ya implementada — solo falta correrla).

### Martes 5/5 — Importación masiva en staging + carga

**Manual:**
- Conseguir CSV real de los 200 empleados (pedirlo a tu padre / RRHH
  con anticipación; idealmente ya lo tenés el lunes).
- Correr preview CSV contra el archivo real en staging. Limpiar
  errores y warnings.
- Correr importación real contra staging. Verificar 200 usuarios
  creados y mails de bienvenida funcionando.
- Decidir si en staging se usan emails reales o ficticios (si reales,
  coordinar con tu padre que el equipo recibirá un mail de prueba).

**Claude Code:**
- Correr script de carga contra staging. Documentar resultados.
- Si aparecen errores 500/timeouts, debuggear: probable culpable es
  pool de conexiones Prisma chico, rate limit propio bloqueando, o
  validaciones lentas.

**Checkpoint:** importación CSV funciona con 200 reales en staging.
Carga muestra p95 < 2s con 100 concurrentes.

### Miércoles 6/5 — Observabilidad

**Manual:**
- **Subir plan Resend a Pro** (decisión del sábado, ejecutar este
  día como tarde para tener cuota suficiente para los 200 mails del
  jueves).
- Configurar Sentry en backend (1-2hs). DSN en `SENTRY_DSN`.
- Configurar alertas básicas en Railway: error rate, CPU/RAM,
  conexiones DB.
- ✅ ~~Escribir `ROLLBACK_PLAN.md`~~ **Adelantado al 3/5**
  (`docs/ROLLBACK_PLAN.md`, commit local `8f29716`). 514 líneas
  cubriendo 8 escenarios, plantillas de comunicación, plan
  específico para 11/5. Revisar y commitear/pushear.
- Bloquear agenda jueves 14/5 22:00-00:30 para monitorear primer
  cierre real.

**Claude Code:**
- Agregar logging estructurado en puntos críticos del cierre:
  cuándo se cierra la ventana, cuántas reservas hay al cierre,
  cuántos usuarios sin reserva.
- Revisar `reminder.job.ts`: zona horaria, comportamiento ante
  reinicio del contenedor, claridad de logs por ejecución.

**Checkpoint:** Sentry recibiendo eventos. Logs de cierre listos para
inspeccionar. Resend en plan Pro.

### Jueves 7/5 — Importación a producción + comunicación

**Manual (día clave):**
- Importación CSV contra **producción** antes del horario laboral
  (~7am UY) para que cuando los empleados lleguen, ya tengan el
  mail.
- Confirmar con tu padre o un piloto que el mail llegó OK.
- Mandar mensaje oficial a los 200 empleados (canal a definir:
  WhatsApp grupal, mail institucional). Mensaje corto: qué es, cómo
  entran, deadline de la primera semana, contacto de soporte.
- Abrir canal de soporte directo (WhatsApp tuyo o de tu padre, mail
  `soporte@reservasrealsabor.com.uy` ya configurado).

**Claude Code:**
- Standby. Sin cambios grandes. Solo bugs críticos.

**Checkpoint:** 200 usuarios en prod, mail enviado, comunicación
oficial hecha.

### Viernes 8/5 — Soporte y onboarding

**Manual:**
- Atender reportes. 80% será "no me llegó el mail" (revisar spam) o
  "no me acuerdo el password". 20% serán bugs reales o casos borde.
  Anotar todo.
- Monitorear logs Railway + Sentry. Foco: errores de login y de
  envío de email.
- Confirmar que el menú de la semana del 11 está cargado por
  superadmin. CRÍTICO: sin menú, nadie puede reservar.

**Claude Code:**
- Solo fixes mínimos para bugs reportados. Cada fix con test que
  cubra el caso. Sin refactors aprovechando.

**Checkpoint:** mayoría de empleados pudo entrar al menos una vez.
Menú de semana del 11 cargado.

### Sábado 9/5 y Domingo 10/5 — Buffer y verificación

Días de margen, no de trabajo planificado. Si algo se atrasó, se
cierra acá.

**Manual:**
- Correr checklist post-deploy completa de `CLAUDE.md`.
- Revisar logs de la semana buscando patrones raros (401s repetidos,
  500s, intentos de login fallidos masivos).
- Confirmar acceso superadmin desde un dispositivo distinto al
  habitual (continuidad si te quedás sin laptop el lunes).
- **Domingo a la noche: dormir.**

### Lunes 11/5 — Lanzamiento

Sistema abierto para 200 empleados. Disponibilidad total para
soporte. Sin cambios de código a menos que sea bug bloqueante.

### Jueves 14/5 22:00-00:30 — Primer cierre real

Monitoreo activo: logs Railway, Sentry, `/api/reservations/window`,
contadores de reservas vs usuarios activos. Si el cierre se ejecuta
bien y el viernes 15 cocina tiene los datos que necesita, semana
ganada.

## Checklist consolidada pre-lanzamiento

Antes del lunes 11:
- [x] Dominio Resend "Verified" con SPF/DKIM/DMARC.
- [ ] Plan Resend Pro activado (target: miércoles 6/5).
- [x] Email de verificación funcionando en Gmail (3/5).
- [ ] Email funcionando en Outlook (actualmente cae a spam por
      reputación de dominio nuevo — riesgo aceptado, ver §Riesgos).
- [ ] Email funcionando en un tercer proveedor (Hotmail/iCloud).
- [x] Fix del SDK de Resend implementado y testeado.
- [x] Fix del SDK deployado a producción (3/5).
- [x] Endpoint de importación CSV con tests pasando (3/5, **commit
      local sin pushear `a5196b8`**).
- [x] `ROLLBACK_PLAN.md` escrito (3/5, **commit local sin pushear
      `8f29716`**).
- [ ] Commits locales del 3/5 revisados, pusheados y deployados a
      develop.
- [ ] Staging operativo con copia de prod (target 4/5).
- [ ] Rehearsal de backup/restore documentado (target 4/5).
- [ ] Script de prueba de carga (target 4/5).
- [ ] Importación de 200 usuarios reales ejecutada en staging
      (target 5/5).
- [ ] Prueba de carga con 100+ concurrentes ejecutada y aceptable
      (target 5/5).
- [ ] Sentry configurado, recibiendo eventos (target 6/5).
- [ ] Alertas Railway configuradas (target 6/5).
- [ ] Importación de 200 usuarios reales ejecutada en producción
      (target 7/5).
- [ ] Comunicación oficial enviada a los 200 empleados (target 7/5).
- [ ] Menú de la semana del 11 cargado por superadmin (target 8/5).
- [ ] Acceso superadmin verificado desde dispositivo alternativo
      (target 9-10/5).

## Commits locales sin pushear (review pendiente)

Revisar y pushear cuando se valide en local. Una vez en `origin/main`,
cherry-pick a `origin/develop` para que Railway redeploye.

| Hash    | Tipo  | Descripción                                              |
|---------|-------|----------------------------------------------------------|
| `8f29716` | docs  | `ROLLBACK_PLAN.md` (514 líneas, plan operativo completo) |
| `a5196b8` | feat  | Endpoint CSV import + UI + 7 tests (101/101 OK local)    |

Comandos para pushear ambos juntos:

```
git push origin main
git fetch origin && git checkout origin/develop
git cherry-pick 8f29716 a5196b8
git push origin HEAD:develop
git checkout main
```

## Riesgos Conocidos

### Outlook envía emails a spam (descubierto 3/5)

**Síntoma:** mails de verificación enviados desde
`no-reply@reservasrealsabor.com.uy` llegan correctamente a Gmail
pero caen a la carpeta de SPAM en Outlook/Hotmail.

**Causa:** reputación baja del dominio. SPF, DKIM y DMARC validados
en Resend; el problema NO es de configuración. Microsoft aplica
filtrado más agresivo que Google sobre dominios nuevos hasta que
acumulan historial de envíos legítimos (semanas a meses).

**Impacto en lanzamiento:** desconocido sin saber qué proporción de
los 200 empleados usa Outlook/Hotmail. Si es >30%, riesgo medio:
muchos no van a ver el email de bienvenida del 7/5 hasta revisar
spam. Si es <10%, riesgo bajo.

**Mitigaciones disponibles (ejecutar antes del 7/5):**

1. **Mail-Tester** (mail-tester.com): enviar un correo de prueba al
   email que ellos generan, ver el score (objetivo: ≥9/10) y revisar
   recomendaciones específicas.
2. **SNDS de Microsoft** (postmaster.live.com): registrar el dominio
   para ver datos de reputación contra IPs de Microsoft. Lleva
   24-48hs aceptación.
3. **JMRP** (Junk Mail Reporting Program): registrar para recibir
   notificaciones cuando usuarios marcan los emails como spam.
   Ayuda a detectar el problema temprano.
4. **Calentamiento del dominio:** durante 4-7 a 5-7, enviar 2-3
   emails diarios desde el dominio (registros de prueba propios,
   resets de prueba). Volumen bajo y constante mejora reputación.
5. **Comunicación al onboarding:** en el mensaje oficial del 7/5
   incluir explícitamente: *"Si no recibís el email de bienvenida,
   revisá la carpeta de spam y marcalo como 'No es spam'"*.
6. **Coordinar con piloto Outlook:** pedir a 1-2 empleados con
   Outlook que reciban un email antes del blast del 7/5 y lo
   marquen como "No es spam" — eso ayuda a la reputación inicial.

**Mitigación post-lanzamiento (no ejecutar antes del 11/6):**
endurecer DMARC de `p=none` a `p=quarantine` cuando haya
historial estable.

### Outros riesgos previos (sin cambios)

- Plan free de Resend insuficiente para 200 mails simultáneos.
  Mitigación: subir a Pro el 6/5.
- Backups Railway dependen del proveedor. Mitigación: pg_dump manual
  durante rehearsal del 4/5.
- Carga concurrente nunca medida. Mitigación: load test el 5/5.
- Sin observabilidad activa hasta Sentry. Mitigación: configurar 6/5.

## Checklist post-deploy

(Idéntica a `CLAUDE.md` para tenerla a mano.)

1. `GET /api/health` → 200
2. `GET /api/ready` → 200
3. Login superadmin
4. Verificar menú de semana activa/próxima
5. Crear/actualizar reserva de prueba
6. Confirmar que aparece en admin/reportes
7. Revisar logs Railway: 500s, 401s inesperados, emails fallidos
8. Revisar dashboard Sentry: errores no manejados últimas 2hs

## Plan de rollback

✅ Escrito en `docs/ROLLBACK_PLAN.md` el 3/5 (adelantado del 6/5).
Cubre criterios de decisión, 8 escenarios paso a paso, plantillas de
comunicación, smoke post-rollback, plan específico para 11/5.
Commit local `8f29716`, pendiente de push.

## Decisiones tomadas durante la ejecución del plan

**Domingo 3/5:**
- Outlook envía a spam: aceptado como riesgo conocido por reputación
  de dominio nuevo. Mitigaciones disponibles documentadas en §Riesgos
  Conocidos. NO se bloquea el lanzamiento por esto.
- Avatar upload: deshabilitado en UI hasta que exista endpoint de
  upload real (post-lanzamiento). La policy de seguridad
  (`validateImageUrl` rechaza base64) se mantiene intacta. La feature
  se reactiva con la opción C del audit (endpoint multipart + storage
  persistente, no antes del 11/6).
- Login error: el backend ya diferenciaba "credenciales inválidas"
  (401) de "email no verificado" (403); el problema era que `api.ts`
  enmascaraba ambos como "Sesión expirada". Fix sin tocar backend.
- `tsconfig.moduleResolution`: cambiado de `"node"` (deprecated en
  TS 5+) a `"bundler"` (recomendado para Vite). Build sigue verde,
  no hay impacto runtime.
- ROLLBACK_PLAN: adelantado del 6/5 al 3/5 porque el trabajo era
  tipo documentación, sin dependencias de infra.
- CSV import: 6 requisitos del LAUNCH_PLAN cumplidos en
  implementación. Decisión adicional: emails de bienvenida son
  best-effort (un fallo no aborta la creación del usuario); el
  reporte trae contadores `emailsSent`/`emailsFailed` para que el
  admin re-notifique manualmente lo que haga falta.

**Sábado 2/5:**
- Cloudflare Email Routing configurado con tres direcciones (`dmarc`,
  `soporte`, `no-reply`) reenviando a Gmail personal. Permite recibir
  respuestas a mails del sistema y reportes DMARC sin Google
  Workspace.
- DMARC con política `p=none` y reportes a
  `dmarc@reservasrealsabor.com.uy`. Endurecimiento a `p=quarantine`
  post-lanzamiento.
- Plan Railway: se mantiene Hobby. Backups manuales con `pg_dump`
  durante rehearsal del lunes. Evaluación de upgrade post-lanzamiento
  con datos reales.
- Plan Resend: subir a Pro el miércoles 6/5, no antes. Free no
  alcanza para los 200 mails del jueves 7/5.
- Bug del SDK de Resend: SDK 6.9.2 no tira excepción ante errores
  de API; resuelve con `{ data: null, error }`. Fix aplicado y
  testeado. Decisión de NO agregar retry/backoff (sobreingeniería
  para esta etapa); evaluación post-lanzamiento.

## Contactos críticos

| Rol | Nombre | Contacto |
|---|---|---|
| Cliente / cantina | (tu padre) | (a completar) |
| Soporte empleados | Rodrigo | (a completar) |
| Backup operativo | (a definir) | (a completar) |
| Soporte Railway | — | dashboard Railway |
| Soporte Resend | — | dashboard Resend |

## Cosas que NO entran a este plan a propósito

- Optimización de bundle frontend / lazy loading.
- Refactors de UI del admin.
- Mejoras en reportes PDF/Excel.
- Productización de Real Sabor para venta a otras cantinas.
  Decisión estratégica: foco principal post-lanzamiento es agente
  WhatsApp para barberías; Real Sabor productizado solo si aparece
  demanda orgánica, como proyecto secundario. Ver
  `STRATEGIC_CONTEXT.md`.
- Agente WhatsApp (segundo producto). No se menciona hasta cobrar
  primera mensualidad de Real Sabor.
