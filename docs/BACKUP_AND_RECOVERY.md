# Plan de Backup, Rollback y Recuperación Ante Incidentes

Este documento define la estrategia para proteger los datos de producción y recuperar el sistema ante fallas operativas.

## A. Estrategia De Backup

### Datos críticos

La base PostgreSQL contiene:

- `User`: usuarios, roles, datos de acceso y datos operativos.
- `Reservation`: reservas semanales.
- `WeeklyMenu`: menús por semana.
- `Settings`: configuración de cierre, marca y operación.
- `DishRating`: calificaciones de platos.
- `PasswordReset`: tokens temporales de recuperación.

### Cuándo hacer backup

- Antes del primer día de uso masivo.
- Antes de cargar usuarios en cantidad.
- Antes de cambios de esquema o migraciones.
- Antes de releases importantes.
- Antes de cambios masivos en menús, usuarios o configuración.
- Antes del primer cierre operativo real.

### Frecuencia recomendada

- **Primera semana:** backup diario.
- **Operación estable:** backup semanal como mínimo.
- **Momentos críticos:** backup antes de cargas masivas, migraciones y cambios operativos grandes.

## B. Backup Manual Con Railway

1. Abrir Railway.
2. Seleccionar el servicio PostgreSQL.
3. Revisar si el plan permite backups/snapshots.
4. Crear o verificar un backup reciente.
5. Registrar fecha, hora, responsable y motivo.
6. Validar que el backup figura como exitoso.

No asumir que hay backup válido sin verlo explícitamente en Railway o sin tener un dump probado.

## C. Backup Con `pg_dump`

Usar solo si se entiende qué base se está copiando. No pegar `DATABASE_URL` real en documentación, issues, commits ni capturas.

### PowerShell

```powershell
New-Item -ItemType Directory -Force -Path backups | Out-Null
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
pg_dump "$env:DATABASE_URL" -Fc -f "backups/backup_$timestamp.dump"
```

### Bash

```bash
mkdir -p backups
pg_dump "$DATABASE_URL" -Fc -f "backups/backup_$(date +%Y-%m-%d_%H-%M-%S).dump"
```

Reglas:

- No commitear dumps.
- No subir dumps a chats.
- Guardar backups en ubicación segura.
- Probar restauración en entorno no productivo cuando sea posible.

## D. Restore

Restaurar un backup puede pisar datos actuales. No ejecutar restore sobre producción sin:

- Backup previo del estado actual.
- Confirmación del archivo correcto.
- Ventana de mantenimiento.
- Comunicación a usuarios.
- Responsable técnico presente.
- Prueba previa en entorno seguro si es posible.

### Referencia Con `pg_restore`

```bash
pg_restore --clean --if-exists -d "$DATABASE_URL" "backups/backup_YYYY-MM-DD_HH-mm-ss.dump"
```

Este comando es de referencia. No ejecutarlo sobre producción sin autorización explícita.

## E. Rollback De Backend

1. Abrir Railway.
2. Ir al servicio backend.
3. Entrar a Deployments.
4. Seleccionar último deployment estable.
5. Ejecutar Redeploy.
6. Verificar:
   - `/api/health`
   - `/api/ready`
   - login
   - una ruta protegida del admin
7. Revisar logs durante algunos minutos.

## F. Rollback De Frontend

1. Abrir Vercel.
2. Ir a Deployments.
3. Seleccionar deployment anterior estable.
4. Promoverlo a producción.
5. Verificar que el frontend carga.
6. Verificar que apunta al backend correcto.
7. Probar login y navegación básica.

## G. Rollback Con Migraciones

Un rollback de código no revierte migraciones.

Reglas:

- Evitar migraciones destructivas.
- Preferir migraciones aditivas.
- No borrar columnas o tablas sin backup y plan de transición.
- Si una migración destructiva salió mal, evaluar restaurar backup de DB además del rollback de código.
- No usar `prisma db push` en producción.

## H. Incidentes Comunes

| Incidente | Síntoma | Qué revisar | Acción inmediata | Criterio de resolución |
|---|---|---|---|---|
| Backend caído | 502/503, `/api/health` falla | Logs Railway, último deploy, variables | Redeploy del último estable o corregir variable faltante | `/api/health` 200 |
| DB caída | `/api/ready` 503 | Servicio PostgreSQL, conexiones, disco | Revisar Railway DB, pausar operación si afecta reservas | `/api/ready` 200 |
| Deploy fallido | Build OK pero healthcheck falla | Logs de runtime, variables, migraciones | Revisar logs y redeployar versión estable si hay impacto | Deploy healthy |
| CORS | Frontend no carga datos | Origen frontend, CORS backend, `FRONTEND_URL` | Corregir variable/config y redeployar | Sin errores CORS |
| Rate limit/proxy | Error de `X-Forwarded-For` o 429 incorrecto | `trust proxy`, logs Railway | Confirmar fix desplegado | Sin errores de proxy/rate limit |
| Usuarios no ingresan | 401/403 | Credenciales, email verificado, rol, token viejo | Cerrar sesión, reset password, revisar cuenta en admin | Usuario ingresa |
| Reportes lentos | PDF/Excel tarda mucho | RAM/CPU Railway, rango, cantidad usuarios | Evitar horas pico, acotar rango, escalar si persiste | Reporte descarga estable |
| Correos fallan | Warning o no llega email | Resend, DNS, límites, Railway logs | Pausar envíos masivos, usar canal interno | Envíos de prueba OK |
| Datos incorrectos cargados | Usuarios/menús mal cargados | Panel admin, backup reciente | Corregir desde UI si es chico; plan técnico si es masivo | Datos validados |
| Reservas duplicadas | Usuario aparece dos veces | Constraint, logs, datos puntuales | No borrar sin backup; escalar a soporte técnico | Una reserva válida por usuario/semana |
| Menú incorrecto | Usuarios ven platos incorrectos | Panel admin, semana seleccionada | Corregir menú desde admin y avisar si afectó reservas | Menú correcto visible |

## I. Plantilla De Registro De Incidente

Usar `docs/INCIDENT_RESPONSE_TEMPLATE.md` para documentar incidentes.

Campos mínimos:

- Fecha/hora.
- Responsable.
- Impacto.
- Usuarios afectados.
- Causa probable.
- Acción tomada.
- Resultado.
- Pendiente preventivo.
