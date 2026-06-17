# Runbook — Datos de demostración para presentar la app "operativa"

Genera usuarios simulados, reservas de varias semanas y **reseñas coherentes
(no al azar)** que se reflejan en los reportes, para mostrarle a la empresa el
sistema funcionando con actividad real. Todo es **borrable** con un comando.

> Cumple la regla 12 del proyecto: idempotencia testeada, confirmación en
> runtime, dry-run, plan de rollback y reporte estructurado.

## Qué genera

- **~35 usuarios** ficticios con nombres uruguayos. Marcados de forma
  inequívoca: email `@demo.realsabor.local` (dominio `.local`, **nunca se
  envía correo real**), `funcNumber` con prefijo `D`, `preferences = __DEMO_REAL_SABOR__`.
- **6 semanas** de historia (5 pasadas + la actual).
- **Reservas** por usuario/semana (participación realista ~75-90%, no todos
  reservan todas las semanas), con horarios de retiro variados.
- **Reseñas** sólo sobre platos **ya servidos** (regla 6: nunca futuros). No
  son aleatorias: cada plato tiene un perfil de popularidad fijo, así los
  rankings cuentan una historia creíble (milanesa/brownie arriba, lentejas/
  pescado abajo) y son **estables** entre ejecuciones.
- **Coherencia con menús reales:** si en una semana ya existe un menú real en
  producción, las reseñas se generan sobre **esos** platos, no sobre los del
  catálogo demo. Sólo se crean menús nuevos donde no había.

## Dónde se ve

- **Admin → Reportes**: platos más reservados, reservas por día, horarios,
  usuarios activos vs totales.
- **Admin → Calificaciones** (semanal y global): tendencia liked/neutral/
  disliked por plato.
- Login como cualquier usuario demo para recorrer la vista de funcionario.

Credenciales demo (se imprimen al finalizar): contraseña por defecto
`DemoRealSabor2026!` (configurable con `DEMO_PASSWORD`).

## Procedimiento recomendado (en orden)

Desde `backend/`.

### 1. Ver el plan sin tocar ninguna base (offline)

```bash
npm run seed:demo-prod -- --plan-only
```

### 2. Ensayar en STAGING (lee, no escribe)

```bash
# PowerShell
$env:DATABASE_URL="postgresql://...staging..."
npm run seed:demo-prod -- --dry-run
```

### 3. Ejecutar en STAGING (escritura real, para validar de punta a punta)

```bash
$env:DATABASE_URL="postgresql://...staging..."
npm run seed:demo-prod
# Escribir "CONFIRMO" cuando lo pida.
```

Verificá en la app de staging que reportes y calificaciones se ven bien.
Probá el rollback en staging antes de ir a prod:

```bash
npm run rollback:demo-prod -- --dry-run     # muestra qué borraría
npm run rollback:demo-prod                   # escribir "BORRAR"
```

### 4. Ejecutar en PRODUCCIÓN

Requiere el flag explícito `ALLOW_PROD_TARGET=true` **y** confirmación en runtime.

```bash
$env:DATABASE_URL="postgresql://...prod..."
$env:ALLOW_PROD_TARGET="true"
npm run seed:demo-prod          # escribir "CONFIRMO"
```

Se crea `backend/.demo-manifest.json` (ignorado por git) con la lista de menús
creados y el login de ejemplo. **No lo borres hasta hacer el rollback**, porque
es lo que permite borrar exactamente los menús que creó el seed.

## Rollback (dejar la base como estaba)

```bash
$env:DATABASE_URL="postgresql://...prod..."
$env:ALLOW_PROD_TARGET="true"
npm run rollback:demo-prod -- --dry-run     # revisar conteos
npm run rollback:demo-prod                   # escribir "BORRAR"
```

- Borra los usuarios demo (identificados por sus **dos** marcadores: prefijo
  `D` en funcNumber **y** dominio `@demo.realsabor.local`). Sus reservas y
  reseñas se eliminan **en cascada** (definido en el schema).
- Borra **sólo** los menús que el seed creó (listados en el manifest). Nunca
  toca menús reales.
- Tras borrar, el manifest se renombra a `.demo-manifest.json.done`.

## Seguridad e idempotencia

- **Idempotente:** re-ejecutar el seed no duplica nada (usuarios por
  funcNumber/email, reservas por `(userId, weekStart)`, reseñas por su unique
  compuesto). Comprobado en `tests/demo-core.test.ts`.
- **No envía correos:** el dominio `.local` no es enrutable.
- **No pisa datos reales:** sólo crea lo que falta; no actualiza menús ni
  reservas existentes.
- **No colisiona con empleados reales:** `documentId` en rango ficticio
  `9.xxx.xxx`, `funcNumber` con prefijo `D`.

## Importante antes del uso real con empleados

Si vas a sembrar demo en la **misma** base que después usarán los 200
empleados reales, **corré el rollback antes del lanzamiento** para no mezclar
datos demo con reservas reales en los reportes. Lo ideal es presentar contra
**staging**; usar prod sólo si la empresa exige ver el dominio productivo.

## Parámetros (variables de entorno opcionales)

| Variable           | Default              | Descripción                        |
|--------------------|----------------------|------------------------------------|
| `DEMO_USER_COUNT`  | `35`                 | Cantidad de usuarios simulados     |
| `DEMO_WEEKS`       | `6`                  | Semanas de historia (incluye actual)|
| `DEMO_PASSWORD`    | `DemoRealSabor2026!` | Contraseña de los usuarios demo    |
| `ALLOW_PROD_TARGET`| —                    | `true` para permitir host de prod  |
