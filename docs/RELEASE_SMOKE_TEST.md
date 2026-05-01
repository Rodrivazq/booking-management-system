# Release Smoke Test Report

**Fecha y Hora:** 2026-05-01 15:45 (UY)  
**Entorno:** Producción (Railway + Vercel)  
**Commit Desplegado:** `7cd2548` (fix: trust Railway proxy for rate limiting)

## 1. URLs Probadas

- **Frontend:** [https://reservasrealsabor.com.uy](https://reservasrealsabor.com.uy)
- **Backend Health:** [https://api.reservasrealsabor.com.uy/api/health](https://api.reservasrealsabor.com.uy/api/health)
- **Backend Ready:** [https://api.reservasrealsabor.com.uy/api/ready](https://api.reservasrealsabor.com.uy/api/ready)

## 2. Healthchecks

| Endpoint | Resultado Esperado | Resultado Real | Estado |
|---|---|---|---|
| `/api/health` | `ok: true`, `env: production`, `timezone: America/Montevideo` | `{"ok":true,"service":"reservas-api","env":"production",...}` | OK |
| `/api/ready` | `ok: true`, `database: ok` | `{"ok":true,"database":"ok",...}` | OK |

## 3. Pruebas Funcionales (E2E Real)

| Acción | Resultado | Observaciones |
|---|---|---|
| Carga de Login | OK | Sin errores 404 ni CORS. |
| Login Superadmin | OK | Acceso completo a Reservas, Menú, Usuarios, Reportes y Configuración. |
| Gestión de Menú | OK | Visualización correcta de platos para semana actual y próxima. |
| Reserva de Usuario | OK | Flujo completo: selección de platos, confirmación y modal de éxito. |
| Verificación Admin | OK | La reserva aparece instantáneamente en la lista de administración. |
| Reportes Operativos | OK | Datos coherentes: se reflejan las cantidades de platos reservados. |
| Usuarios sin Reserva | OK | Se actualiza al confirmar la reserva del usuario de prueba. |
| Logout / Login | OK | Persistencia de sesión y limpieza de tokens al cerrar sesión correcta. |

## 4. Auditoría de Consola y Logs (Producción)

- **Consola:** cero errores CORS. Sin 401 persistentes después de login.
- **Railway Logs:** sin errores de Prisma ni filtrado de secretos. Healthchecks livianos sin impacto en performance.
- **Rate Limit:** no se detectaron bloqueos indebidos durante el smoke test.

---

## Veredicto Final: LISTO PARA OPERAR

**Observaciones:**

- El sistema se encuentra funcional en sus capas principales: Auth, DB, lógica de negocio y reportes.
- Se realizó un ajuste temporal del día de cierre para permitir la prueba de reserva un día viernes, y se restauró exitosamente a jueves.
- Los usuarios de prueba (`tester@reservas.local` y `user@reservas.local`) fueron eliminados de la base de datos tras finalizar el test para mantener la integridad de producción.

**Pendientes:**

- Monitorear el primer cierre masivo de reservas el próximo jueves a las 23:59.
- Confirmar feedback de usuarios reales sobre la velocidad de carga de reportes PDF grandes.
