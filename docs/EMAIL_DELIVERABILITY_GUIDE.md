# Guía de Entregabilidad y Correos

Esta guía define cómo operar los correos transaccionales del sistema: verificación de cuenta, recuperación de contraseña y bienvenida de usuarios creados por administración.

## 1. Proveedor y Variables

El backend prioriza **Resend** cuando `RESEND_API_KEY` está configurada. Si no hay clave de Resend o el envío falla, puede intentar SMTP si las variables SMTP están completas.

Variables relevantes:

- `FRONTEND_URL`: debe apuntar a `https://reservasrealsabor.com.uy`.
- `RESEND_API_KEY`: clave privada de Resend. No debe exponerse ni commitearse.
- `SMTP_HOST`: host SMTP alternativo.
- `SMTP_PORT`: puerto SMTP, normalmente `587` o `465`.
- `SMTP_SECURE`: `true` para puerto `465`, `false` para `587`.
- `SMTP_USER`: usuario SMTP.
- `SMTP_PASS`: contraseña o app password SMTP.
- `SMTP_FROM`: remitente visible del correo.

## 2. Comportamiento Del Sistema

- **Registro:** si el correo de verificación falla, el usuario queda creado, pero la API responde con `warning: true`.
- **Recuperación de contraseña:** mantiene respuesta neutral para evitar enumeración de usuarios. No revela si el email existe.
- **Creación desde admin:** si falla el correo de bienvenida, el backend responde con warning para que el administrador pueda contactar al usuario por otro canal.
- **Logs:** no deben imprimirse contraseñas, tokens, links completos, `DATABASE_URL`, `JWT_SECRET` ni API keys.

## 3. DNS Necesario

Para buena entregabilidad, el dominio debe estar verificado en el proveedor de correo.

En Resend, revisar:

- **DKIM:** firma del dominio.
- **SPF:** autorización del proveedor de envío.
- **DMARC:** política de autenticación y reporte.

En Cloudflare o el proveedor DNS:

- Cargar exactamente los registros que indique Resend.
- Mantenerlos en modo DNS only si Resend así lo indica.
- Esperar propagación y volver a verificar desde el panel de Resend.

No asumir que el correo está listo hasta que Resend marque el dominio como verificado.

## 4. Si Resend Marca Failed

Revisar:

1. Dashboard de Resend -> Emails / Logs.
2. Estado del dominio.
3. Remitente configurado.
4. Si la API key sigue vigente.
5. Si se alcanzó un límite del plan contratado.
6. Logs de Railway para confirmar si el backend recibió error del proveedor.

## 5. Si Los Correos Llegan A Spam

Acciones recomendadas:

- Verificar SPF, DKIM y DMARC.
- Usar remitente del dominio propio, no Gmail/Outlook personal.
- Evitar asuntos exagerados, mayúsculas, emojis excesivos o texto promocional.
- Usar contenido breve, directo y transaccional.
- Pedir a usuarios piloto que marquen el correo como "No es spam".
- Probar con herramientas como Mail-Tester antes de lanzamiento masivo.
- Evitar enviar demasiados correos de golpe desde un dominio nuevo.

## 6. Buenas Prácticas De Contenido

Usar asuntos claros:

- `Verificá tu cuenta de Reservas Real Sabor`
- `Restablecé tu contraseña`
- `Tu cuenta de reservas fue creada`

Evitar:

- Promesas comerciales.
- Muchas imágenes.
- Links acortados.
- Exceso de signos de exclamación.
- Adjuntos innecesarios.

## 7. Prueba Manual Sin Envío Masivo

Antes del lanzamiento:

1. Crear un usuario real de prueba.
2. Verificar recepción del correo.
3. Probar recuperación de contraseña.
4. Revisar spam.
5. Revisar logs de Resend.
6. Revisar logs de Railway.
7. Confirmar que los links apuntan a `https://reservasrealsabor.com.uy`.

## 8. Plan De Contingencia

Si el correo falla el día del lanzamiento:

1. No hacer envíos masivos repetidos.
2. Revisar Resend y Railway logs.
3. Confirmar dominio verificado.
4. Usar comunicación por WhatsApp/canal interno para explicar el incidente.
5. Si los usuarios fueron creados por admin, informarles el método de acceso definido.
6. Si el flujo depende de verificación de email y falla masivamente, pausar el onboarding hasta corregir DNS/proveedor.

## 9. Rotación De API Key

Si `RESEND_API_KEY` fue expuesta en capturas, chats, videos o documentación:

1. Revocar la clave en Resend.
2. Crear una nueva.
3. Actualizar Railway.
4. Redeployar backend.
5. Probar envío con un usuario de prueba.

## 10. Recomendación Final

Estado recomendado: **GO CON OBSERVACIONES** hasta confirmar dominio verificado, límites del plan y recepción real en Gmail/Outlook.
