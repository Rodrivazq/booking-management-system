# Plan de Onboarding de Usuarios (Producción)

Este documento define la estrategia recomendada para incorporar aproximadamente 200 usuarios iniciales al sistema de reservas, manteniendo integridad de datos, trazabilidad operativa y bajo riesgo en producción.

## 1. Campos Requeridos del Usuario

Según el modelo actual y los flujos del backend, los datos principales para crear usuarios son:

- `name`: nombre visible del funcionario.
- `email`: único. Debe estar en minúsculas y sin espacios.
- `funcNumber`: único. Debe estar sin espacios y normalizado.
- `documentId`: único. Documento o CI.
- `phoneNumber`: opcional, recomendado para soporte operativo.
- `role`: `user`, `admin` o `superadmin`.
- `isEmailVerified`: los usuarios creados por admin quedan verificados para poder ingresar.
- `photoUrl`: opcional según flujo de creación.

## 2. Estrategia Recomendada Para El Primer Lanzamiento

Para 200 usuarios, la estrategia más segura es una **carga controlada por administración**, evitando SQL manual y evitando scripts de seed.

### Opción A: Carga Manual Por Panel Admin

Recomendada si la cantidad real a cargar es manejable por etapas.

1. Ir a **Panel Admin -> Usuarios -> Crear Usuario**.
2. Cargar nombre, email, número de funcionario, documento y teléfono.
3. El backend normaliza los datos.
4. El usuario queda con `isEmailVerified: true`.
5. El sistema intenta enviar correo de bienvenida.
6. Si el correo falla, el panel debe mostrar warning y el administrador debe contactar al usuario por canal interno.

**Ventajas:**

- Usa las validaciones reales de la app.
- Evita duplicados.
- No toca la base manualmente.
- Permite cargar por tandas.

**Desventajas:**

- Es lento para 200 usuarios si se hace todo de una vez.

### Opción B: Autogestión De Usuarios

Recomendada solo si la empresa acepta que cada funcionario se registre.

1. El usuario entra a `https://reservasrealsabor.com.uy/login`.
2. Hace clic en "Registrarse".
3. Completa sus datos.
4. Valida su correo.
5. Ingresa y reserva.

**Ventajas:**

- Reduce carga administrativa.
- Valida que el correo existe.
- El usuario elige su contraseña.

**Riesgos:**

- Puede haber errores de tipeo.
- Usuarios pueden registrarse tarde.
- Si el correo cae en spam, se frena el alta.
- Puede haber menos control sobre el padrón real.

### Opción C: Carga CSV Controlada

No existe todavía como feature productiva. Se recomienda implementarla más adelante si el cliente necesita altas masivas recurrentes.

La carga CSV futura debería:

- Ser accesible solo para SuperAdmin.
- Validar todas las filas antes de escribir.
- Mostrar errores por fila.
- Ser transaccional o permitir confirmar solo filas válidas.
- No crear usuarios duplicados.
- No guardar contraseñas en texto plano.
- No ejecutarse automáticamente al deploy.

## 3. Reglas De Limpieza De Datos

- **Email:** `trim().toLowerCase()`.
- **Número de funcionario:** sin espacios. Si aplica, en mayúsculas.
- **Documento/CI:** sin espacios. Definir si se permiten puntos o guiones antes de cargar.
- **Teléfono:** preferentemente solo números, manteniendo prefijo si corresponde.
- **Rol:** por defecto `user`. Evitar cargar admins en masa.
- **Duplicados:** validar contra `email`, `funcNumber` y `documentId`.

## 4. Manejo De Casos Especiales

### Usuarios Sin Email Válido

El sistema funciona mejor con email real porque recuperación de contraseña y avisos dependen de correo.

Si un funcionario no tiene email:

- Definir un email interno controlado, por ejemplo `func001@reservas.local`.
- Crear el usuario desde el panel admin.
- Informar que la recuperación automática de contraseña no funcionará para ese usuario.
- Mantener una vía manual de soporte.

### Usuarios Con Datos Duplicados

El backend debe rechazar:

- Email ya registrado.
- Número de funcionario ya registrado.
- Documento ya registrado.

No corregir duplicados directamente en PostgreSQL sin backup y revisión previa.

### Usuarios Que Olvidan Contraseña

Flujo recomendado:

1. Usar "Olvidaste tu contraseña".
2. Ingresar email real.
3. Revisar bandeja de entrada y spam.
4. Si no llega, admin valida email y proveedor de correo.

## 5. Comunicación Sugerida

Mensaje sugerido para WhatsApp o correo interno:

```text
Hola, equipo.

A partir de esta semana las reservas de menú se realizan desde el nuevo sistema:

https://reservasrealsabor.com.uy/login

Pasos:
1. Ingresá al link.
2. Registrate o iniciá sesión con tus datos.
3. Elegí el menú de la próxima semana.
4. Confirmá tu reserva.

Recordá que las reservas cierran los jueves a las 23:59.

Si tenés problemas para ingresar, contactá al administrador del servicio.
```

## 6. Checklist Antes De Cargar Usuarios

- [ ] Backup realizado.
- [ ] Menú actual cargado.
- [ ] Menú próximo cargado.
- [ ] Correo de bienvenida probado.
- [ ] SuperAdmin confirmado.
- [ ] Roles definidos.
- [ ] Lista de usuarios revisada.
- [ ] Duplicados detectados antes de cargar.
- [ ] Canal de soporte definido.

## 7. Checklist Después De Cargar Usuarios

- [ ] Verificar cantidad total de usuarios.
- [ ] Revisar admins/superadmins.
- [ ] Probar login con un usuario real.
- [ ] Probar recuperación de contraseña.
- [ ] Confirmar que los usuarios aparecen en reportes.
- [ ] Monitorear consultas de soporte durante las primeras 24 horas.

## 8. Plan De Rollback

Si se carga mal una tanda:

1. No borrar masivamente sin backup.
2. Identificar usuarios afectados.
3. Exportar o respaldar estado actual.
4. Corregir desde panel admin si son pocos casos.
5. Si son muchos casos, planificar corrección controlada con script revisado y probado fuera de producción.

## 9. Scripts Locales De Desarrollo

Existen scripts locales de simulación como:

- `backend/src/scripts/seed-200.ts`
- `backend/src/scripts/check-progress.ts`

Estos scripts no deben commitearse ni ejecutarse en producción. Sirven solo para pruebas locales y pueden llenar la base con usuarios o reservas ficticias.

## 10. Recomendación Final

Para el primer lanzamiento:

1. Cargar usuarios reales por panel admin en tandas si el padrón ya está definido.
2. Usar autogestión solo si la empresa acepta que cada funcionario complete sus datos.
3. Implementar importación CSV en un batch futuro si la operación va a repetirse para otras empresas o muchas altas mensuales.
