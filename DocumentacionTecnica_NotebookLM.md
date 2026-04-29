# Documentación Técnica: Sistema de Reservas Corporativo

## 1. Ficha Técnica

- **Propósito del Sistema:** Plataforma integral web diseñada para la gestión automatizada de reservas semanales de menús para una plantilla de 500 empleados. Permite a los usuarios seleccionar sus comidas díarias y a los administradores gestionar los menús, cierres y reportes.
- **Stack Tecnológico:**
  - **Frontend:** React 19, Vite, TypeScript, Zustand (gestión de estado global), React Router DOM (enrutamiento), Tailwind CSS / Vanilla CSS, Recharts (gráficos), XLSX & JSPDF (exportación de reportes), React-Turnstile (protección anti-bots).
  - **Backend:** Node.js, Express.js, TypeScript.
  - **Base de Datos / ORM:** Prisma ORM interactuando con PostgreSQL (y soporte para SQLite en desarrollo).
  - **Autenticación y Seguridad:** JSON Web Tokens (JWT), Bcryptjs (hashing de contraseñas), Express-Rate-Limit (protección contra fuerza bruta), Helmet (cabeceras HTTP seguras).
  - **Comunicaciones / Mailing:** Resend API y Nodemailer para la verificación de cuentas y recuperación de contraseñas.
  - **Testing:** Vitest para pruebas unitarias y de integración.

---

## 2. Arquitectura del Sistema

La aplicación sigue una **Arquitectura Cliente-Servidor (SPA + API RESTful)** tradicional.

- **Flujo de Datos:**
  1.  **Frontend (Cliente):** La interfaz de usuario envía peticiones HTTP asíncronas vía Fetch API a los endpoints del servidor Express. El estado local se sincroniza fuertemente usando Zustand, limitando recargas innecesarias.
  2.  **Validación y Seguridad (Capa Media Backend):** Toda petición que requiere autorización pasa por middlewares de Express. Estos validan la existencia y caducidad del token JWT (identificando rol de usuario/admin). Peticiones de login/registro pasan primero por validación de Cloudflare Turnstile.
  3.  **Controladores (Backend):** Reciben el Request, orquestan las operaciones y llaman a Prisma.
  4.  **Capa de Datos (Base de Datos):** Prisma ORM traduce las consultas de TypeScript a lenguaje SQL seguro, evitando inyecciones SQL. Los datos se almacenan en tablas relacionales estructuradas (Users, Reservations, WeeklyMenu, Settings). Las respuestas de la base de datos se formatean y devuelven como JSON limpio al cliente.

---

## 3. Lógica de Negocio Centralizadas

- **Reglas de Reserva (Deadline Engine):** Las reservas trabajan exclusivamente sobre el concepto de "Next Monday" (la semana siguiente). Existe una tabla de "Configuración (`Settings`)" que define el día de cierre límite (ej. Jueves a las 23:59). El motor bloquea transacciones transcurrido ese tiempo de forma dinámica, permitiendo que el periodo de reservas se abra "naturalmente" durante los fines de semana.
- **Manejo de Colisiones:** Solo se permite una reserva lógica por semana por empleado. Si un usuario que ya había enviado su reserva de lunes a viernes decide cambiar el menú del miércoles, el sistema realiza un "Upsert" transparente: actualiza el registro existente en base al `userId` y `weekStart` en lugar de generar un duplicado o error.
- **Perfiles de Usuario:** Existen dos roles fundamentales (`user` y `admin`).
  - `Role User:` Autenticación estricta con verificación de correo obligatoria. El acceso se restringe a vistas de perfil y sus propias reservas.
  - `Role Admin:` Capacidad de configurar menú, visualizar estadísticas completas, descargar listados y reportes paginados de reservas de la plantilla.

---

## 4. Análisis de Código: Módulos de Alta Complejidad

A continuación se desglosan las 3 lógicas de código más técnicas y elaboradas del proyecto:

### A. Controlador `createReservation` (reservation.controller.ts)

- **Propósito:** Procesa el envío y validación de las selecciones alimenticias semanales.
- **Lógica Paso a Paso:**
  1.  **Evaluación Temporal:** Determina la fecha del próximo lunes usando algoritmos matemáticos en base al objeto `Date`. Recupera reglas de vencimiento dinámicas de la tabla `Settings`.
  2.  **Validación de Cierres Reales:** Convierte días de la semana y horas string ("23:59") a comparadores numéricos. Introduce una lógica de "Week Shift" que puentea el fin de semana, evaluando si el tiempo presente es mayor al día y hora límite marcados en settings.
  3.  **Verificación de Menú (Integridad Referencial de UI/BD):** Descarga el menú real expuesto para esa semana en concreto. Itera sobre cada día (Lunes a Viernes) y asegura, cotejando cadenas JSON, que el plato (meal) y el postre seleccionados por el cliente sean opciones legalmente ofrecidas ese día.
  4.  **Transacción Abierta:** Chequea si el cliente tiene registros previos en esa semana, realizando la actualización de la cadena JSON de selecciones u originando una nueva fila.

### B. Controlador `login` adaptativo (auth.controller.ts)

- **Propósito:** Portal de entrada seguro flexible.
- **Lógica Paso a Paso:**
  1.  **Validación Bot / Humano:** El token provisto es contrastado remotamente con la API secreta de Turnstile usando comprobación de IP (`verifyTurnstileToken`).
  2.  **Identificación Ambivalente:** Evalúa el string del usuario de entrada. Si incluye un símbolo `@`, limpia y procesa la directiva lógica para buscar un email en base de datos. Si no, quita espacios y normaliza como número de funcionario / legajo, todo en una única consulta Prisma que utiliza el operador `OR`.
  3.  **Chequeos Cascada de Estados:** Después de verificar el hash BCrypt, valida el estado `isEmailVerified` (excepto admins) previniendo ingresos no autorizados.
  4.  **Sesión Condicional:** Instancia un token JWT con durabilidad variable (`12h` o `30d`) dependiendo del flag "Mantener sesión iniciada", insertando el ID inmutable en el payload y excluyendo datos pesados inyectados (como la URL base64 de imagenes del avatar del usuario, que rompería el tamaño de encabezado HTTP normal).

### C. Controlador Extendido `getAllReservations` con paginación optimizada

- **Propósito:** Enviar volúmenes masivos de datos controlados al tablero administrador.
- **Lógica Paso a Paso:**
  1.  **Aritmética de Paginación:** Resuelve los punteros numéricos `skip` y `take` en base al `pageNumber` y `limitNumber` requeridos, para no agotar la memoria al tener 500 registros con uniones complejas.
  2.  **Construcción Dinámica de WHERE Clauses:** Crea objetos de consulta para Prisma donde introduce el formato genérico de búsqueda multidimensional (búsqueda _insensitive case_ sobre nombre, o email, o número de funcionario usando arrays `OR`).
  3.  **Ejecución Concurrente Eficiente:** El uso de `Promise.all` para lanzar asíncronamente en paralelo la captura de filas `findMany()` y el conteo total `count()`. Reduce de forma enorme la latencia de respuesta global en redes pobladas.
  4.  **Hidratación de JSON Anidado:** Extrae de las uniones relacionales (Include de User) e "hidrata" el array planchando datos útiles desde JSON hacia una estructura llana que el DataGrid del panel Frontend puede leer con alto rendimiento.

---

## 5. Desafíos y Soluciones Técnicas

- **Desafío 1: Concurrencia Picos de Carga.** Al contar con 500 empleados, los viernes o jueves previos al cierre, la API podría saturarse de solicitudes asíncronas simultáneas.
  - **Solución:** Despliegue de un backend manejado asíncronamente (Node/Express). Integración del middleware **express-rate-limit** para mitigar repeticiones perjudiciales (DDOS). Uso de pooling de conexiones automáticos mediante configuración de **Prisma ORM**, manejando las consultas con altas performances.
- **Desafío 2: Validar bots en accesos y prevención de spam.** El acceso abierto al sistema invitaba posibles vulneraciones de fuerza bruta en cuentas no inicializadas.
  - **Solución:** Incorporación de **Cloudflare Turnstile** en la interfaz React antes de desencadenar la validación Backend, así como exigencias estrictas de verificación de correos automatizados transaccionales utilizando la API de **Resend**.
- **Desafío 3: Cambio de Semanas y Des-sincronía.** Muchos usuarios olvidaban reservar o reservaban la semana incorrecta por desfase en la lectura del tiempo en distintos dispositivos y navegadores web.
  - **Solución:** El backend se volvió la autoridad cronológica absoluta (`getNextMonday()`). El Frontend pide el tiempo referencial del server al iniciar sesión, y la base de datos gobierna mediante cierres paramétrizados (`deadlineDay`, `deadlineTime`), impidiendo inconsistencias estado-tiempo.

---

## 6. Roadmap: Próximos Pasos (Pendientes)

1.  **Soporte Multi-Turnos (Turnos de Comida):** Ampliar el concepto de "timeSlot" actual a una configuración por sectores y departamentos, permitiendo que Recursos Humanos divida masivamente los grandes volúmenes de empleados.
2.  **Notificaciones en Tiempo Real y Push:** Modificar el servidor de Express para admitir Socket.io o SSE, avisando en vivo a los administradores las reservas que entran o para notificar recordatorios directamente sobre el navegador antes de que el cierre de la ventana ocurra.
3.  **Exportaciones Integradas de Auditoría:** Implementar un servicio CRON (`node-cron` que ya figura en dependencias) que envíe reportes agregados en PDF a través de correo electrónico hacia contabilidad de forma desatendida, finalizando cada periodo de reservas.
