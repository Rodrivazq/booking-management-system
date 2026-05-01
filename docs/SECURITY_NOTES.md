# Notas de Seguridad — Matriz de Roles y Permisos

## Roles del Sistema

| Rol | Descripción |
|---|---|
| `user` | Usuario corporativo registrado |
| `admin` | Administrador de operaciones |
| `superadmin` | Administrador con control total del sistema |

---

## Matriz de Permisos por Endpoint

### Endpoints Públicos (sin autenticación)
| Endpoint | Método | Acceso |
|---|---|---|
| `/api/health` | GET | Público |
| `/api/ready` | GET | Público |
| `/api/menu` | GET | Público |
| `/api/settings` | GET | Público (necesario para renderizar login) |
| `/api/auth/register` | POST | Público |
| `/api/auth/login` | POST | Público (con rate limit) |
| `/api/auth/verify-email` | GET | Público |
| `/api/auth/forgot-password` | POST | Público |
| `/api/auth/reset` | POST | Público |

### Endpoints de Usuario Autenticado
| Endpoint | Método | Acceso mínimo |
|---|---|---|
| `/api/auth/me` | GET | `user` |
| `/api/auth/profile` | PUT | `user` |
| `/api/reservations/window` | GET | `user` |
| `/api/reservations` | POST | `user` |
| `/api/reservations/me` | GET | `user` |
| `/api/ratings/my` | GET | `user` |
| `/api/ratings` | PUT | `user` |

### Endpoints de Admin
| Endpoint | Método | Acceso mínimo |
|---|---|---|
| `/api/reservations/admin` | GET | `admin` |
| `/api/reservations/admin/without-reservation` | GET | `admin` |
| `/api/admin/users` | POST | `admin` |
| `/api/admin/users/:id/details` | PUT | `admin` |
| `/api/ratings/admin` | GET | `admin` |
| `/api/reports/stats` | GET | `admin` |
| `/api/stats` | GET | `admin` |
| `/api/stats/weeks` | GET | `admin` |
| `/api/qr` | GET | `admin` |

### Endpoints Exclusivos de SuperAdmin
| Endpoint | Método | Acceso mínimo |
|---|---|---|
| `/api/admin/users/:id/role` | PUT | `superadmin` |
| `/api/settings` | PUT | `superadmin` |
| `/api/menu` | PUT | `superadmin` |

---

## Principios de Aislamiento de Datos

- **Usuario no puede ver datos de otro usuario:** Los endpoints `/api/reservations/me` y `/api/ratings/my` siempre usan `req.user.id` proveniente del JWT validado + lookup en BD. No se acepta un `userId` arbitrario del body/params.
- **Admin no puede auto-asignarse superadmin:** El endpoint de cambio de rol es exclusivo de superadmin, incluyendo para el propio admin.
- **El QR endpoint está restringido a admin:** El endpoint `GET /api/qr` acepta un `url` en query params. Para prevenir SSRF o Open Redirect, fue protegido con `requireAdmin`.

---

## QUÉ NO HACER

- **No abrir endpoints de admin a usuarios autenticados** sin verificar `requireAdmin`.
- **No confiar en `userId` del body para acciones sensibles** — siempre usar `req.user.id`.
- **No permitir que un usuario lea/modifique datos de otro** sin pasar por la verificación de rol de admin.
