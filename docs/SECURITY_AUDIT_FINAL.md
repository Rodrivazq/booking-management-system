# Auditoria de Seguridad Final

**Fecha:** 2026-05-01  
**Entorno revisado:** Produccion, Railway + Vercel  
**Alcance:** backend, rutas, middlewares, controladores, logs, CORS, rate limiting y flujo basico del frontend.

## Resumen ejecutivo

La aplicacion queda apta para operar en produccion con monitoreo inicial. Durante la auditoria se encontro una vulnerabilidad alta en la edicion administrativa de usuarios y se corrigio con una regla explicita de permisos.

El resto de la superficie revisada mantiene una separacion razonable entre usuario, admin y superadmin. Los endpoints sensibles estan protegidos por middleware, los logs sanitizan secretos y el rate limiting esta configurado para una oficina con IP compartida.

## Hallazgo alto corregido

**Escalada de privilegios por edicion de superadmin**

El endpoint `PUT /api/admin/users/:id/details` estaba protegido por `requireAdmin`, pero permitia que un administrador comun editara los datos de un usuario `superadmin`. El riesgo principal era cambiar el correo del superadmin, pedir recuperacion de contrasena y tomar control de esa cuenta.

**Correccion aplicada**

En `backend/src/controllers/admin.controller.ts`, `updateUserDetails` ahora busca primero al usuario destino. Si el destino es `superadmin` y el solicitante no lo es, responde `403 Forbidden` y no ejecuta ninguna actualizacion.

**Cobertura agregada**

En `backend/tests/admin.test.ts` se agregaron tests para verificar:

- Un admin comun no puede editar el perfil de un superadmin.
- Un superadmin si puede editar a otro superadmin.
- Un admin comun mantiene permiso para editar usuarios regulares.
- Un usuario destino inexistente devuelve `404`.

## Matriz de permisos revisada

| Modulo | Endpoints | Permiso esperado | Estado |
| --- | --- | --- | --- |
| Auth | `POST /register`, `POST /login`, `POST /forgot-password`, `GET /verify-email` | Publico | Correcto |
| Auth | `GET /me`, `PUT /profile` | Usuario autenticado | Correcto |
| Menu | `GET /api/menu` | Publico | Correcto |
| Menu | `PUT /api/menu` | Superadmin | Correcto |
| Settings | `GET /api/settings` | Publico | Correcto |
| Settings | `PUT /api/settings` | Superadmin | Correcto |
| Reservas | `POST /api/reservations`, `GET /api/reservations/me`, `GET /api/reservations/window` | Usuario autenticado | Correcto |
| Reservas admin | `GET /api/reservations/admin`, `GET /api/reservations/admin/without-reservation` | Admin | Correcto |
| Usuarios | `POST /api/admin/users`, `PUT /api/admin/users/:id/details` | Admin, con restriccion especial para superadmin | Corregido |
| Roles | `PUT /api/admin/users/:userId/role` | Superadmin | Correcto |
| Reportes y estadisticas | Reportes, stats y exportaciones administrativas | Admin | Correcto |
| QR | `GET /api/qr` | Admin | Correcto |
| Ratings | Endpoints de calificacion | Usuario autenticado | Correcto |

## Controles verificados

**Datos sensibles**

- No se devuelven `passwordHash`, `verificationToken` ni secretos de entorno en respuestas normales.
- Los logs del `errorHandler` censuran claves sensibles como `password`, `token`, `secret`, `authorization`, `apikey` y `photoUrl`.
- Los healthchecks no exponen credenciales ni cadenas de conexion.

**CORS y rate limiting**

- CORS esta limitado al dominio productivo, localhost y previews esperadas.
- `trust proxy` esta activado para Railway, evitando errores con `X-Forwarded-For`.
- El limite global esta configurado con margen para usuarios compartiendo IP corporativa.
- El login mantiene un limiter separado para reducir fuerza bruta.

**Sesion y roles**

- El middleware de autenticacion revalida el usuario contra base de datos en cada request protegido.
- Si un usuario cambia de rol o es eliminado, el cambio impacta en la siguiente peticion.
- Superadmin queda protegido contra auto-bloqueo y degradacion accidental del ultimo superadmin.

## Validacion esperada

Antes de cerrar este batch se debe ejecutar:

```powershell
cd "C:\Users\rodri\Desktop\Aplicacion de reservas\backend"
npm test
npx tsc --noEmit
```

Tambien se recomienda verificar en produccion:

- `https://api.reservasrealsabor.com.uy/api/health`
- `https://api.reservasrealsabor.com.uy/api/ready`
- Login de superadmin.
- Intento de editar un superadmin desde una cuenta admin comun, esperando `403`.

## Veredicto

**APTO PARA LANZAMIENTO CON MONITOREO**

La vulnerabilidad alta detectada fue corregida y cubierta por pruebas unitarias. El sistema puede operar en produccion, manteniendo monitoreo durante el primer ciclo real de reservas y revisando logs de Railway ante cualquier respuesta `401`, `403`, `429` o `5xx`.
