# Reporte De Incidente En Producción

Copiar esta plantilla para documentar incidentes que afecten la app de reservas.

## Detalles Generales

- **Título del incidente:**
- **Severidad:** Crítica / Alta / Media / Baja
- **Inicio (fecha/hora UY):**
- **Fin (fecha/hora UY):**
- **Responsable a cargo:**
- **Estado:** Abierto / Mitigado / Resuelto

## Impacto

- **Resumen del impacto:**
- **Sistemas afectados:** Frontend / Backend / Base de datos / Correos / DNS
- **Usuarios afectados:**
- **Funcionalidades afectadas:** Login / Reservas / Admin / Reportes / Emails

## Timeline

- **HH:MM:** Evento detectado.
- **HH:MM:** Primera revisión realizada.
- **HH:MM:** Acción de mitigación aplicada.
- **HH:MM:** Servicio recuperado.

## Causa

- **Causa probable:**
- **Causa raíz confirmada:**
- **Evidencia:** logs, capturas, healthchecks, deploy afectado.

## Mitigación

- **Acción inmediata tomada:**
- **Resultado de la acción:**
- **Validaciones realizadas:**
  - `/api/health`
  - `/api/ready`
  - login
  - flujo afectado

## Corrección Definitiva

- **Cambio aplicado:**
- **Commit/deploy relacionado:**
- **Pruebas realizadas:**

## Prevención Futura

- **Qué se hará para evitar repetición:**
- **Responsable:**
- **Fecha objetivo:**

## Cierre

- **Veredicto:** Resuelto / Mitigado con seguimiento / Pendiente
- **Notas adicionales:**
