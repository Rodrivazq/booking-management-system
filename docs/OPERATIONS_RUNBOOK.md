# Manual de Operaciones (Runbook) - Sistema de Reservas

Este documento describe los procedimientos operativos necesarios para mantener la salud y el correcto funcionamiento del sistema de reservas en producción.

## 1. Roles y Contactos Sugeridos

- **SuperAdmin:** responsable de la configuración global, permisos críticos y ajustes del sistema.
- **Administrador Operativo:** responsable de cargar menús semanales, revisar reservas y descargar reportes para cocina.
- **Soporte Técnico:** responsable de Railway, Vercel, base de datos, dominios, deploys, logs e incidentes técnicos.

## 2. Checklists de Operación

### 2.1. Checklist Previo al Primer Día

- [ ] Verificar que el SuperAdmin real tiene acceso al sistema.
- [ ] Confirmar que `/api/health` responde `ok: true`, `env: production` y `timezone: America/Montevideo`.
- [ ] Confirmar que `/api/ready` responde `ok: true` y `database: ok`.
- [ ] Cargar el menú de la primera semana operativa.
- [ ] Cargar o registrar la lista inicial de usuarios.
- [ ] Ejecutar `npm run ops:check` desde el backend si se tiene acceso operativo a la consola.
- [ ] Verificar que `FRONTEND_URL`, `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV` y `TZ` estén configuradas en Railway.
- [ ] Confirmar que el frontend de Vercel usa la API productiva.
- [ ] Realizar una reserva real de prueba y verificarla desde el panel admin.
- [ ] Realizar un backup antes de abrir el sistema a todos los usuarios.

### 2.2. Checklist Diario (Administrador)

- [ ] Confirmar que la app carga correctamente.
- [ ] Revisar si hay usuarios con problemas de acceso.
- [ ] Revisar si hay errores reportados por cocina o administración.
- [ ] Verificar el volumen de reservas si se acerca la fecha de cierre.
- [ ] Revisar reportes solo cuando haga falta, evitando exportaciones innecesarias en horas pico.

### 2.3. Checklist Semanal

- **Lunes:** verificar que el menú de la semana actual esté visible.
- **Martes/Miércoles:** revisar volumen de reservas. Si es bajo, enviar recordatorio operativo.
- **Jueves antes del cierre:**
  - [ ] Validar que el menú de la próxima semana esté cargado.
  - [ ] Revisar "Usuarios sin reserva" y notificar si corresponde.
  - [ ] Confirmar que el horario de cierre configurado es correcto.
- **Jueves 23:59:** el sistema debe cerrar automáticamente según configuración.
- **Viernes mañana:**
  - [ ] Descargar reporte de cocina.
  - [ ] Descargar listado de reservas si se necesita respaldo operativo.
  - [ ] Revisar logs si hubo quejas o comportamiento extraño.

## 3. Resolución de Incidentes

### 3.1. Backend / API no responde

1. Verificar Railway Dashboard.
2. Abrir `https://api.reservasrealsabor.com.uy/api/health`.
3. Si falla, revisar logs de Railway buscando errores de arranque, OOM, Prisma o variables faltantes.
4. Si el último deploy falló, redeployar el último despliegue estable.

### 3.2. Base de Datos no responde

1. Abrir `https://api.reservasrealsabor.com.uy/api/ready`.
2. Si devuelve `database: "error"`, revisar el servicio PostgreSQL en Railway.
3. Revisar límites de conexiones, espacio en disco y estado del servicio.
4. No ejecutar `db push` en producción.
5. Si el problema persiste, contactar a soporte técnico antes de tocar datos.

### 3.3. Los correos no llegan

1. Revisar logs del backend buscando errores de `Resend` o `SMTP`.
2. Verificar que `RESEND_API_KEY` siga vigente.
3. Revisar estado del dominio en Resend: SPF, DKIM y DMARC.
4. Revisar límites diarios del proveedor.
5. Si el correo cae en spam, revisar reputación de dominio, asunto, remitente y autenticación DNS.

### 3.4. Usuario no puede ingresar

1. Confirmar que el usuario existe.
2. Confirmar que el email o número de funcionario no tiene espacios o errores.
3. Confirmar si el usuario requiere verificación de email.
4. Usar recuperación de contraseña si no recuerda su clave.
5. Si el usuario fue creado por admin, verificar que `isEmailVerified` esté activo.

### 3.5. Usuario no aparece en reportes

1. Confirmar que el usuario hizo reserva para la semana seleccionada.
2. Confirmar que el admin está mirando la semana correcta: actual, próxima o historial.
3. Revisar si la reserva fue modificada después de la carga inicial.
4. Validar desde el panel admin antes de revisar base de datos.

### 3.6. Reservas duplicadas

1. Verificar si el usuario tiene más de una reserva para la misma semana.
2. Confirmar que existe el constraint único por `userId + weekStart`.
3. Revisar logs para detectar errores de concurrencia.
4. Si aparece duplicado real, no borrar manualmente sin backup previo.

### 3.7. Reportes lentos o fallidos

1. Evitar generar PDF/Excel masivos en horas pico.
2. Probar exportar una semana específica.
3. Revisar memoria y CPU del backend en Railway.
4. Si hay reinicios por memoria, escalar el servicio o dividir reportes por fecha.

## 4. Infraestructura y Monitoreo

### 4.1. Monitoreo Manual

- **Health:** `https://api.reservasrealsabor.com.uy/api/health`
- **Ready:** `https://api.reservasrealsabor.com.uy/api/ready`
- **Logs:** Railway -> servicio backend -> View Logs.
- **Deploys backend:** Railway -> Deployments.
- **Deploys frontend:** Vercel -> Deployments.

### 4.2. Backups

- Realizar backup manual antes del primer día de operación.
- Realizar backup antes de cargas masivas de usuarios.
- Realizar backup antes de cambios estructurales de base de datos.
- Mantener una frecuencia mínima semanal, idealmente diaria durante las primeras semanas.
- Validar restauración en entorno seguro antes de usar un backup sobre producción.

## 5. Protocolo de Rollback

Si un deploy rompe producción:

1. Identificar el último commit estable.
2. En Railway, seleccionar el deployment anterior y redeployar.
3. En Vercel, seleccionar el deployment anterior y promoverlo a producción.
4. Confirmar `/api/health` y `/api/ready`.
5. Hacer login de prueba.
6. Si hubo migraciones de base de datos, no asumir que rollback de código alcanza. Revisar impacto antes de continuar.

## 6. Criterio Operativo

El sistema puede operar si:

- `/api/health` y `/api/ready` están OK.
- Hay al menos un SuperAdmin activo.
- Menú actual y próximo están cargados.
- Los usuarios pueden iniciar sesión.
- Un usuario puede reservar.
- El admin puede ver reservas y reportes.
- Existe un backup reciente antes de abrir operación masiva.
