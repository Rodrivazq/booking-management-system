# Go-Live Checklist - Producción

Este documento debe ser completado por el responsable operativo antes de abrir el sistema a todos los usuarios.

## 1. Infraestructura y Configuración

- [ ] **DNS:** `reservasrealsabor.com.uy` apunta al frontend y `api.reservasrealsabor.com.uy` apunta al backend.
- [ ] **SSL/HTTPS:** certificados activos en ambos dominios.
- [ ] **Backend:** Railway muestra el servicio online y el último deploy exitoso.
- [ ] **Frontend:** Vercel muestra el deployment productivo activo.
- [ ] **Variables Backend:** `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `NODE_ENV=production`, `TZ=America/Montevideo` configuradas.
- [ ] **Variables Frontend:** `VITE_API_BASE` apunta a `https://api.reservasrealsabor.com.uy`.

## 2. Base de Datos y Estado

- [ ] **Migraciones:** producción usa `npx prisma migrate deploy`.
- [ ] **Sin db push:** confirmado que no se usa `prisma db push` en producción.
- [ ] **Conectividad:** `/api/ready` responde `database: ok`.
- [ ] **Backup Inicial:** realizado backup antes de abrir el sistema.
- [ ] **SuperAdmin:** al menos un SuperAdmin real activo.

## 3. Seguridad

- [ ] **JWT:** `JWT_SECRET` real configurado, no valor de desarrollo.
- [ ] **Passwords:** no hay contraseñas reales en logs ni documentación.
- [ ] **Rate Limiting:** activo y sin errores de proxy en Railway.
- [ ] **Logs:** no imprimen tokens, API keys, passwords ni URLs completas de base de datos.

## 4. Datos Maestros y Operación

- [ ] **Menú actual:** cargado y visible.
- [ ] **Menú próximo:** cargado y visible.
- [ ] **Usuarios:** lista inicial cargada o procedimiento de registro validado.
- [ ] **Día de cierre:** configurado correctamente.
- [ ] **Horario de cierre:** configurado correctamente.
- [ ] **Responsable operativo:** definido para monitoreo durante el primer día.

## 5. Pruebas de Humo Finales

- [ ] **Healthcheck:** `/api/health` responde `env=production` y `timezone=America/Montevideo`.
- [ ] **Readiness:** `/api/ready` responde `database=ok`.
- [ ] **Login Admin:** funciona.
- [ ] **Login Usuario:** funciona.
- [ ] **Reserva:** una reserva de prueba fue realizada.
- [ ] **Panel Admin:** la reserva aparece en la lista.
- [ ] **Usuarios sin reserva:** se actualiza correctamente.
- [ ] **Reportes:** muestran datos coherentes.
- [ ] **Emails:** se verificó entrega o se documentó el fallback operativo.
- [ ] **Logout/Login:** no quedan 401 persistentes después de login correcto.

## 6. Go / No-Go

### GO

- [ ] Todos los checks críticos están en verde.
- [ ] Hay backup reciente.
- [ ] Hay responsable operativo disponible.
- [ ] Hay plan de rollback conocido.

### NO-GO

Marcar NO-GO si ocurre cualquiera de estos puntos:

- [ ] `/api/health` falla.
- [ ] `/api/ready` falla.
- [ ] No se puede iniciar sesión como SuperAdmin.
- [ ] No se puede crear o visualizar una reserva.
- [ ] No hay menú cargado para la semana operativa.
- [ ] No hay backup previo.
- [ ] Hay errores repetidos de Prisma, CORS o rate limit en producción.

**Veredicto:** GO / NO-GO  
**Responsable:** ____________________  
**Fecha:** ____/____/2026
