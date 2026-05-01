# Checklist de Despliegue en Producción

Esta guía contiene los pasos necesarios para desplegar la aplicación de Reservas Corporativas para ~200 usuarios de forma segura y estable.

## 1. Variables de Entorno Obligatorias

### Backend (Railway / VPS)
Configura las siguientes variables en tu plataforma de alojamiento (ej. Railway):
*   `DATABASE_URL`: URI de conexión a PostgreSQL.
*   `JWT_SECRET`: Cadena larga y aleatoria (Ej. generada con `openssl rand -hex 32`). **NUNCA DEBE ESTAR VACÍA EN PRODUCCIÓN**.
*   `FRONTEND_URL`: URL pública exacta del frontend (ej. `https://reservasrealsabor.com.uy`). Requerido para CORS y links de emails.
*   `NODE_ENV`: `production` (Obligatorio para activar validaciones estrictas y protección de cache/limiter).
*   `TZ`: `America/Montevideo` (Para forzar el Timezone en Railway y que no calcule cierres en UTC).
*   **Correos (Al menos uno de los dos métodos):**
    *   *Opción A (Recomendada):* `RESEND_API_KEY` con tu key de Resend.com
    *   *Opción B (SMTP):* `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.

### Frontend (Vercel / Netlify / Railway)
Configura las siguientes variables en la plataforma donde alojes el frontend:
*   `VITE_API_BASE`: URL pública de tu backend (ej. `https://api.reservasrealsabor.com.uy`). No debe terminar con `/`.

---

## 2. Pasos de Despliegue

### Despliegue Backend (Railway)
1. Conecta el repositorio a Railway y selecciona la carpeta `backend/`.
2. Agrega PostgreSQL desde Railway.
3. Inyecta las variables de entorno listadas arriba.
4. El comando de inicio (`Start Command`) ya viene preconfigurado en `package.json` para ejecutar las migraciones automáticamente antes de levantar el servidor:
   ```bash
   npm run start
   # (npx prisma migrate deploy && node dist/index.js)
   ```
5. **Cuidado:** Bajo ninguna circunstancia ejecutes `npx prisma db push --accept-data-loss` en producción. Si necesitas migrar a mano, usa siempre `npx prisma migrate deploy`.

### Despliegue Frontend (Vercel)
1. Conecta tu repositorio a Vercel.
2. Define el "Root Directory" como `frontend/`.
3. Framework Preset: `Vite`.
4. Agrega la variable `VITE_API_BASE`.
5. Ejecuta el deploy.

---

## 3. Post-Deploy (Pruebas de Salud y Smoke Tests)

Una vez que ambas aplicaciones están corriendo, sigue estos 7 pasos rápidos (menos de 30 segundos) para validar que Producción está viva:

### 3.1 Healthcheck Liviano
Visita `https://api.tudominio.com/api/health` desde tu navegador.
*   **Deberías ver:** `{"ok":true,"service":"reservas-api","env":"production","timezone":"America/Montevideo", ...}`
*   Si no responde o da 500, el backend ni siquiera pudo levantar (revisa logs de inicio, puede faltar `JWT_SECRET`).

### 3.2 Readiness Check (Base de Datos)
Visita `https://api.tudominio.com/api/ready` desde tu navegador.
*   **Deberías ver:** `{"ok":true,"database":"ok", ...}`
*   **Si devuelve 503:** Significa que el servidor levantó bien, pero falló al comunicarse con PostgreSQL. Revisa que `DATABASE_URL` sea correcta, que no haya firewall bloqueando la IP, y lee los logs del backend.

### 3.3 Flujo de Usuario (Smoke Test)
1. **Abrir Frontend:** Entra a la web pública.
2. **Revisar `/api/health`:** Hecho arriba.
3. **Revisar `/api/ready`:** Hecho arriba.
4. **Login/Registro:** Inicia sesión con tu cuenta de admin o regístrate.
5. **Menú:** Revisa que los platos cargan bien para la semana activa.
6. **Reserva:** Intenta hacer una reserva real.
7. **Emails:** Verifica tu bandeja de entrada o la de tu usuario. Si los correos caen, mira el paso de Troubleshooting de SPAM. Generar un reporte PDF desde el admin sirve también como prueba de humo.

---

## 4. Resolución de Problemas (Troubleshooting)

### Error de CORS en el Frontend
*   **Síntoma:** El frontend carga pero no muestra menús y la consola del navegador dice "CORS policy".
*   **Solución:** Confirma que el dominio del frontend coincida EXACTAMENTE con el `origin` permitido en `backend/src/app.ts` y con tu variable `FRONTEND_URL`. (Recuerda que `https://tudominio.com` es distinto de `https://www.tudominio.com`).

### Los correos no llegan o caen en SPAM
*   **Solución:** Si usas Resend, asegúrate de haber configurado los registros DNS (DKIM/SPF) en tu proveedor de dominio (Godaddy, Namecheap). Hasta que no verifiques el dominio, los correos caerán en SPAM o serán bloqueados.

### Diferencia de Datos (Local vs Prod)
*   **Síntoma:** "Ayer probé en local y funcionaba, hoy en producción no me deja reservar".
*   **Solución:** Producción corre en un servidor distinto. Asegúrate de que el backend tenga configurada la variable `TZ="America/Montevideo"`. De lo contrario, Railway trabajará en horario UTC (Londres) y el reloj se adelantará 3 horas, cortando las reservas a las 21:00 locales en vez de a las 23:59.

### Errores 413 (Payload Too Large) o App Colgada por Fotos
*   **Síntoma:** Un usuario trata de subir perfil/logo y la petición rebota o da 413.
*   **Solución:** El backend restringe cualquier JSON mayor a `1MB` de forma estricta, y rechaza URLs en Base64. Esto es intencional. Usa un proveedor de imágenes externo y guarda solo la URL válida de la imagen (ej: `https://imgur.com/foto.jpg`).

---

## 5. Primer Día de Operación

Durante el primer día, el sistema necesitará un Administrador General y la carga del primer menú, sin tener que tocar PostgreSQL a mano.

### 5.1 Crear el Primer SuperAdmin
No ingreses a la base de datos para forzar usuarios. Te recomendamos usar las variables de entorno de tu plataforma (ej. Railway) de forma temporal para no dejar contraseñas en el historial de tu consola.

1. Configura estas variables en Railway (o tu plataforma):
   * `ADMIN_EMAIL` (ej: admin@tudominio.com)
   * `ADMIN_PASSWORD` (¡Usa una contraseña segura!)
   * `ADMIN_NAME` (ej: Admin General)
   * `ADMIN_FUNC_NUMBER` (ej: ADMIN001)
   * `ADMIN_DOCUMENT_ID` (ej: 11111111)
2. Ejecuta el comando desde la terminal integrada de Railway:
   ```bash
   npm run seed:superadmin
   ```
3. **IMPORTANTE:** Una vez ejecutado, borra `ADMIN_PASSWORD` de tus variables de entorno.

*⚠️ Advertencia: No pegues contraseñas reales en comandos compartidos ni capturas de pantalla.*
*Nota: Este script es idempotente (si lo corres 2 veces, no duplicará el usuario).*

### 5.2 Revisar Salud Operativa
Para ver rápidamente si la gente se está registrando y si cargaste los menús, usa el comando de chequeo operativo:
```bash
npm run ops:check
```
Esto imprimirá en consola un reporte limpio: cuántos usuarios hay, cuántas reservas y si el menú de la semana próxima está o no cargado.

### 5.3 QUÉ NO HACER EN PRODUCCIÓN
*   **NO uses `npx prisma db push`**: Borrará tablas enteras si hay conflictos. Usa SIEMPRE `npx prisma migrate deploy`.
*   **NO edites PostgreSQL a mano (ej. DBeaver o pgAdmin) salvo emergencia extrema**: El panel de SuperAdmin del frontend tiene permisos para cambiar roles y editar usuarios de forma auditada y segura. Usa la UI.
