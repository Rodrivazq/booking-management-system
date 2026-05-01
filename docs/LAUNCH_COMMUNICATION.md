# Comunicación de Lanzamiento

Este documento contiene mensajes sugeridos para comunicar el lanzamiento del sistema de reservas a usuarios y administradores.

Se recomienda enviar la comunicación en dos tandas:

1. **Anuncio inicial:** lunes o martes.
2. **Recordatorio de cierre:** jueves durante la mañana.

## 1. Mensaje Corto Para WhatsApp

```text
Hola, equipo.

A partir de esta semana las reservas de comedor se realizan desde el nuevo sistema:

https://reservasrealsabor.com.uy

Pasos:
1. Ingresá al link.
2. Registrate o iniciá sesión.
3. Elegí el menú de la próxima semana.
4. Confirmá tu reserva.

Recordá que las reservas cierran los jueves a las 23:59.

Si tenés problemas para ingresar, contactá a Administración.
```

## 2. Mensaje Formal Para Email Interno

**Asunto:** Nuevo sistema de reservas de menú

```text
Estimado equipo:

Informamos que a partir de esta semana las reservas de menú se realizarán desde el nuevo sistema:

https://reservasrealsabor.com.uy

Pasos para usarlo:

1. Ingresar al link.
2. Registrarse o iniciar sesión.
3. Seleccionar el menú de la próxima semana.
4. Confirmar la reserva.

Las reservas cierran los jueves a las 23:59. Hasta ese momento se puede modificar la selección.

Ante problemas de acceso, comunicarse con Administración.

Saludos.
```

## 3. Mensaje Para Administradores

```text
Checklist de lanzamiento:

1. Confirmar que el menú actual y próximo están cargados.
2. Confirmar que /api/health y /api/ready están OK.
3. Probar login de administrador.
4. Probar una reserva real.
5. Verificar que la reserva aparece en el panel admin.
6. Revisar usuarios sin reserva antes del cierre.
7. Descargar reportes después del cierre.

Si hay problemas con correos, revisar Resend y logs de Railway antes de reenviar invitaciones.
```

## 4. Mensaje Para Usuarios Que No Recibieron Email

```text
Hola.

Si no recibiste el correo del sistema:

1. Revisá Spam / Correo no deseado / Promociones.
2. Esperá unos minutos y volvé a revisar.
3. Confirmá que el correo ingresado esté bien escrito.
4. Si sigue sin llegar, contactá a Administración para revisar tu cuenta.
```

## 5. Recordatorio De Cierre

```text
Recordatorio:

Hoy a las 23:59 cierra el sistema para reservar el menú de la próxima semana.

Ingresá a:
https://reservasrealsabor.com.uy

Después del cierre no se podrán realizar cambios desde la app.
```

## 6. FAQ Breve

### No puedo entrar

Verificá que estés usando el email o número de funcionario correcto. Si olvidaste la contraseña, usá "Olvidaste tu contraseña".

### No me llegó el correo

Revisá spam, promociones y correo no deseado. Si no aparece, contactá a Administración.

### Me olvidé la contraseña

Usá la opción "Olvidaste tu contraseña" e ingresá tu email. El enlace de recuperación tiene validez limitada.

### No veo el menú

Puede que el menú todavía no esté cargado o que estés mirando una semana sin disponibilidad. Avisá a Administración.

### Ya reservé, ¿puedo cambiar?

Sí, mientras la ventana de reservas esté abierta. El cierre configurado es jueves a las 23:59.

### ¿Hasta cuándo puedo reservar?

Hasta el jueves a las 23:59, salvo que Administración cambie la configuración.

## 7. Recomendaciones De Soporte

- Mantener un canal único de consultas durante la primera semana.
- Tener una persona responsable de revisar usuarios sin reserva.
- No reenviar correos masivamente sin revisar primero Resend/Railway.
- Documentar problemas frecuentes para mejorar el FAQ.
