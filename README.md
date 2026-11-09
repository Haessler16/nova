# NOVA PMS

SaaS hotelero multi-tenant. Este repositorio contiene las **Phases 1–4** ejecutables de punta a punta —Foundation, configuración de propiedad e inventario, huéspedes y reservas, y **Front Office**—: monorepo, API NestJS, **UI web Next.js + Chakra UI para fases 1–4**, PostgreSQL/Redis, Prisma, autenticación local con sesiones/MFA/recuperación, CSRF, rate limiting, contexto tenant en servidor, RBAC por organización y propiedad, auditoría append-only, health checks, inventario de habitaciones, estados operativos y de housekeeping separados, bloqueos out-of-order/out-of-service, huéspedes minimizados, reservas con disponibilidad y asignación transaccional, historial append-only de reservas, calendario gráfico, room rack, llegadas/salidas/in-house, check-in/check-out idempotentes, cambio de habitación, incidencias, seeds sintéticos y pruebas de aislamiento.

> La autenticación local con usuario/contraseña es una transición controlada, no un proveedor de identidad definitivo. No es producción-ready sin revisión de seguridad, MFA/recuperación de cuenta y secretos gestionados. Ver [Limitaciones](#limitaciones).

## Stack y versiones fijadas

| Componente      | Versión                       | Nota                              |
| --------------- | ----------------------------- | --------------------------------- |
| Node.js         | `>=20.11` (probado con 22.14) | `package.json` engines            |
| pnpm            | `8.15.1`                      | `packageManager`                  |
| Next.js / React | `14.2.15` / `18.3.1`          | App Router + Chakra UI 2.8.2      |
| NestJS          | `10.4.4`                      | API modular monolith              |
| Prisma          | `5.22.0`                      | Cliente generado en `postinstall` |
| PostgreSQL      | `17` (Docker)                 | Fuente de verdad                  |
| Redis           | `7` (Docker)                  | Rate limiting/readiness auxiliar  |

Las versiones están fijadas deliberadamente. Un cambio de major requiere una decisión en `docs/DECISIONS.md`.

## Requisitos

- Node.js 20.11+ y pnpm 8.15+
- Docker Desktop (o Docker Engine + Compose v2)
- Puertos libres: `3000` (web), `3001` (API), `5432` (PostgreSQL), `6379` (Redis)

## Inicio rápido

```bash
cp .env.example .env
pnpm install
pnpm infra:up            # PostgreSQL + Redis con healthchecks
pnpm db:migrate:deploy   # aplica migraciones
pnpm db:seed             # datos sintéticos idempotentes
pnpm db:verify           # valida constraints/triggers manuales
pnpm dev                 # API + web en paralelo
```

Servicios:

- Web: <http://localhost:3000>
- API: <http://localhost:3001>
- Swagger: <http://localhost:3001/docs> (solo fuera de producción)
- Liveness: <http://localhost:3001/health/live>
- Readiness: <http://localhost:3001/health/ready>

Para un entorno limpio:

```bash
pnpm db:reset   # drop + migrate + seed (destructivo solo en local)
```

## Aplicación web (Phases 1–4)

La web es una app operativa client-side contra la API real. No guarda el tenant en el cliente como autoridad: envía `X-Organization-Id`/`X-Property-Id` y el backend valida membresías y permisos en cada request.

| Ruta                    | Contenido                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `/login`                | Login local (email/contraseña + MFA) o selector de usuario en `dev-header`          |
| `/dashboard`            | KPIs operativos, llegadas, alertas, día operativo, readiness y accesos rápidos      |
| `/front-office`         | Llegadas, en casa, salidas, room rack, check-in/out, room move e incidencias        |
| `/calendar`             | Calendario gráfico habitación × noche (7/14/21 días)                                |
| `/reservations`         | Listado/filtros, disponibilidad, alta, edición, asignación, cancelación e historial |
| `/guests`               | Búsqueda, alta/edición y activación/desactivación de huéspedes                      |
| `/inventory/rooms`      | Habitaciones, housekeeping, bloqueos, liberación e historial                        |
| `/inventory/room-types` | Tipologías, capacidad y estado                                                      |
| `/settings`             | Nombre, timezone, moneda y hora de corte del día operativo                          |
| `/audit`                | Eventos de auditoría append-only con metadatos                                      |
| `/admin`                | Membresías, roles/permisos y eventos de seguridad (contexto de organización)        |
| `/account`              | Sesiones activas, cambio de contraseña y enrolamiento/desenrolamiento MFA           |

Notas de uso:

- En `AUTH_MODE=dev-header` (default local) el login muestra usuarios sintéticos; el id elegido se guarda en `localStorage` solo para desarrollo y se envía como `X-Dev-User-Id`.
- En `AUTH_MODE=local-session` el navegador usa la cookie HttpOnly y la UI obtiene un token CSRF antes de cada mutación.
- El selector de organización/propiedad persiste la última selección y se revalida contra `/organizations` y `/properties` al recargar.
- La UI sigue `docs/DESIGN_SYSTEM.md`: tokens Sky & Mint centralizados en `apps/web/src/theme`, sidebar navy, tipografía Inter y estados de color accesibles.
- Los errores de permisos se muestran como alertas de la API; la UI no replica reglas de autorización.
- Un 401 durante la navegación cierra la sesión local de la UI y redirige a `/login`.

## Variables de entorno

`.env.example` documenta todas las variables. `DATABASE_URL` y `REDIS_URL` son obligatorias; el resto tiene defaults locales.

La API carga `.env` desde `apps/api` y desde la raíz del repo. Next.js usa `NEXT_PUBLIC_API_URL` con default `http://localhost:3001`.

Variables relevantes:

| Variable                          | Default        | Uso                                                   |
| --------------------------------- | -------------- | ----------------------------------------------------- |
| `AUTH_MODE`                       | `dev-header`   | `dev-header`, `local-session` o `disabled`            |
| `CSRF_SECRET`                     | —              | Obligatorio con `local-session`; mínimo 32 caracteres |
| `SESSION_TTL_HOURS`               | `8`            | Duración de sesión local                              |
| `SESSION_COOKIE_NAME`             | `nova_session` | Cookie HttpOnly de sesión                             |
| `CSRF_COOKIE_NAME`                | `nova_csrf`    | Cookie legible por JS para double-submit              |
| `LOGIN_RATE_LIMIT_MAX`            | `10`           | Intentos por ventana (IP + email)                     |
| `LOGIN_RATE_LIMIT_WINDOW_SECONDS` | `900`          | Ventana fija de rate limiting                         |

## Autenticación

### Modo `local-session`

```bash
# 1. Obtener CSRF token y cookie
curl -c cookies.txt http://localhost:3001/api/v1/auth/csrf

# 2. Login (usar el csrfToken devuelto y la cookie)
curl -b cookies.txt -c cookies.txt \
  -H 'Content-Type: application/json' \
  -H 'X-CSRF-Token: <csrfToken>' \
  -d '{"email":"admin@demo.nova.local","password":"NovaDemo!2026"}' \
  http://localhost:3001/api/v1/auth/login

# 3. Usar la cookie de sesión
curl -b cookies.txt http://localhost:3001/api/v1/me
```

Implementación:

- Contraseñas con `scrypt` (Node built-in, parámetros versionados en el hash).
- Tokens de sesión opacos de 256 bits; solo se persiste su SHA-256 en `Session`.
- Cookie de sesión `HttpOnly`, `SameSite=Lax`, `Secure` con `NODE_ENV=production`.
- CSRF double-submit firmado con HMAC-SHA256; obligatorio en métodos no seguros.
- Rate limiting de login en Redis. Si Redis no está disponible el login degrada y lo registra; PostgreSQL sigue siendo la autoridad de identidad.
- Logout revoca la sesión en base de datos y limpia cookies.

### Modo `dev-header` (solo desarrollo/tests)

Con `NODE_ENV != production` y `AUTH_MODE=dev-header`, el actor se resuelve desde `X-Dev-User-Id` y se valida contra PostgreSQL. En producción la API rechaza este modo al arrancar y el guard también lo rechaza.

### Usuarios sintéticos del seed

Todos usan la contraseña `NovaDemo!2026`.

| Usuario                       | ID (`X-Dev-User-Id`)                   | Acceso                                   |
| ----------------------------- | -------------------------------------- | ---------------------------------------- |
| `admin@demo.nova.local`       | `00000000-0000-4000-8000-000000000011` | Org A, rol `ORG_ADMIN` (todas las props) |
| `reception@demo.nova.local`   | `00000000-0000-4000-8000-000000000012` | Org A: Centro, recepción                 |
| `auditor@demo.nova.local`     | `00000000-0000-4000-8000-000000000013` | Org A: Praia, auditoría                  |
| `housekeeper@demo.nova.local` | `00000000-0000-4000-8000-000000000016` | Org A: Centro, housekeeping              |
| `admin.b@demo.nova.local`     | `00000000-0000-4000-8000-000000000014` | Org B: Bosque                            |
| `disabled@demo.nova.local`    | `00000000-0000-4000-8000-000000000015` | Deshabilitado                            |

### Tenancy

- `X-Organization-Id`: selector validado contra `Membership` activa.
- `X-Property-Id`: selector opcional validado contra `PropertyMembership` activa u organización con `property.read` global.
- Roles de organización son aditivos. `ORG_ADMIN` accede a todas las propiedades de la organización.
- `POST /properties` requiere `organization.properties.manage` y crea automáticamente la `PropertyMembership` del creador.
- Un `organizationId`/`propertyId` inyectado en body/query no autoriza nada; los DTO rechazan campos desconocidos.

## Endpoints implementados

| Método | Ruta                                                   | Guard         | Permiso                          |
| ------ | ------------------------------------------------------ | ------------- | -------------------------------- |
| GET    | `/health/live`                                         | —             | —                                |
| GET    | `/health/ready`                                        | —             | PostgreSQL + Redis               |
| GET    | `/api/v1/auth/csrf`                                    | —             | —                                |
| POST   | `/api/v1/auth/login`                                   | CSRF          | —                                |
| POST   | `/api/v1/auth/logout`                                  | auth + CSRF   | —                                |
| GET    | `/api/v1/auth/session`                                 | auth          | —                                |
| GET    | `/api/v1/me`                                           | auth          | —                                |
| GET    | `/api/v1/organizations`                                | auth          | —                                |
| GET    | `/api/v1/properties`                                   | auth + tenant | — (membresías/rol org)           |
| GET    | `/api/v1/properties/current`                           | auth + tenant | —                                |
| GET    | `/api/v1/properties/current/operational-day`           | auth + tenant | —                                |
| PATCH  | `/api/v1/properties/current`                           | auth + tenant | `property.manage`                |
| POST   | `/api/v1/properties`                                   | auth + tenant | `organization.properties.manage` |
| GET    | `/api/v1/audit-events`                                 | auth + tenant | `audit.read`                     |
| GET    | `/api/v1/inventory/room-types`                         | auth + tenant | `inventory.read`                 |
| POST   | `/api/v1/inventory/room-types`                         | auth + tenant | `inventory.manage`               |
| GET    | `/api/v1/inventory/room-types/:id`                     | auth + tenant | `inventory.read`                 |
| PATCH  | `/api/v1/inventory/room-types/:id`                     | auth + tenant | `inventory.manage`               |
| GET    | `/api/v1/inventory/rooms`                              | auth + tenant | `inventory.read`                 |
| POST   | `/api/v1/inventory/rooms`                              | auth + tenant | `inventory.manage`               |
| GET    | `/api/v1/inventory/rooms/:id`                          | auth + tenant | `inventory.read`                 |
| PATCH  | `/api/v1/inventory/rooms/:id`                          | auth + tenant | `inventory.manage`               |
| POST   | `/api/v1/inventory/rooms/:id/housekeeping-transitions` | auth + tenant | `housekeeping.manage`            |
| GET    | `/api/v1/inventory/rooms/:id/blocks`                   | auth + tenant | `inventory.read`                 |
| POST   | `/api/v1/inventory/rooms/:id/blocks`                   | auth + tenant | `inventory.manage`               |
| POST   | `/api/v1/inventory/rooms/:id/blocks/:blockId/release`  | auth + tenant | `inventory.manage`               |
| GET    | `/api/v1/inventory/rooms/:id/history`                  | auth + tenant | `inventory.read`                 |
| GET    | `/api/v1/guests`                                       | auth + tenant | `guests.read`                    |
| POST   | `/api/v1/guests`                                       | auth + tenant | `guests.manage`                  |
| GET    | `/api/v1/guests/:id`                                   | auth + tenant | `guests.read`                    |
| PATCH  | `/api/v1/guests/:id`                                   | auth + tenant | `guests.manage`                  |
| GET    | `/api/v1/reservations/availability`                    | auth + tenant | `reservations.read`              |
| GET    | `/api/v1/reservations`                                 | auth + tenant | `reservations.read`              |
| POST   | `/api/v1/reservations`                                 | auth + tenant | `reservations.manage`            |
| GET    | `/api/v1/reservations/:id`                             | auth + tenant | `reservations.read`              |
| PATCH  | `/api/v1/reservations/:id`                             | auth + tenant | `reservations.manage`            |
| POST   | `/api/v1/reservations/:id/room-assignment`             | auth + tenant | `reservations.manage`            |
| POST   | `/api/v1/reservations/:id/cancel`                      | auth + tenant | `reservations.manage`            |
| GET    | `/api/v1/reservations/:id/history`                     | auth + tenant | `reservations.read`              |
| GET    | `/api/v1/front-office/overview`                        | auth + tenant | `front_office.read`              |
| POST   | `/api/v1/front-office/reservations/:id/check-in`       | auth + tenant | `front_office.manage`            |
| POST   | `/api/v1/front-office/reservations/:id/no-show`        | auth + tenant | `front_office.manage`            |
| POST   | `/api/v1/front-office/stays/:id/check-out`             | auth + tenant | `front_office.manage`            |
| POST   | `/api/v1/front-office/stays/:id/room-move`             | auth + tenant | `front_office.manage`            |
| GET    | `/api/v1/front-office/incidents`                       | auth + tenant | `incidents.read`                 |
| POST   | `/api/v1/front-office/incidents`                       | auth + tenant | `incidents.manage`               |
| POST   | `/api/v1/front-office/incidents/:id/resolve`           | auth + tenant | `incidents.manage`               |

Todas las mutaciones de propiedades, inventario, huéspedes, reservas y Front Office escriben `AuditEvent` en la misma transacción. No existe ruta HTTP para modificar o borrar auditoría, historial de estado ni historial de reservas.

## Huéspedes y reservas

- `Guest` es property-scoped y minimizado: nombre, email/teléfono opcionales, documento opcional (tipo + número juntos) y notas. Sin borrado físico; `status = DISABLED`.
- `Reservation` usa fechas calendario de la propiedad `[checkInDate, checkOutDate)` y una habitación opcional. El ciclo completo es `CONFIRMED → CHECKED_IN → CHECKED_OUT`, con `CANCELLED`/`NO_SHOW` como salidas alternativas.
- `POST /reservations` acepta `idempotencyKey`; repetir la misma clave devuelve la reserva original y una clave reutilizada con otro payload responde `409 idempotency_key_reuse`.
- `GET /reservations/availability` excluye habitaciones inactivas, bloqueadas o ya reservadas en el rango solicitado.
- La asignación de habitación valida room type, bloqueos y solapamiento bajo lock de la fila `Room`. La garantía final es la exclusion constraint PostgreSQL `Reservation_room_date_no_overlap`.
- `ReservationHistory` es append-only; las modificaciones y cancelaciones preservan historial y auditoría.

## Front Office

- `Stay` es único por reserva y representa la estancia operativa (`IN_HOUSE`/`CHECKED_OUT`). La ocupación se deriva de estancias `IN_HOUSE`; sigue separada de housekeeping.
- `GET /front-office/overview` devuelve día operativo, llegadas, salidas, in-house, candidatos a no-show y room rack por propiedad.
- Check-in exige reserva `CONFIRMED`, habitación asignada, habitación `ACTIVE`/`AVAILABLE`, sin bloqueo activo y sin otra estancia in-house. Es idempotente: repetirlo devuelve la misma estancia.
- Check-out es idempotente, marca la reserva `CHECKED_OUT` y libera la habitación para nuevas llegadas.
- Room move exige mismo room type, habitación libre y sin solapamiento; actualiza reserva y estancia y conserva historial.
- No-show solo se permite después de la fecha de llegada y no si ya existe una estancia.
- `Incident` registra notas/incidencias con tipo, severidad, alcance opcional (habitación/reserva/estancia) y resolución auditable.
- Todas las acciones de Front Office escriben `ReservationHistory` append-only y `AuditEvent`.

## Inventario y estados

- `RoomType`: tipo configurable por propiedad, código único, capacidades y estado.
- `Room`: número único por propiedad, tipo, piso/edificio, atributos.
- **Housekeeping** (`DIRTY → CLEANING → CLEAN → INSPECTED → DIRTY`) describe limpieza. No representa ocupación.
- **Operational state** (`AVAILABLE`, `OUT_OF_ORDER`, `OUT_OF_SERVICE`) se deriva de bloqueos activos.
- `RoomBlock`: motivo, intervalo, tipo, estado y liberación. Dos bloqueos activos de la misma habitación no pueden solaparse; la garantía final es una exclusion constraint PostgreSQL con `btree_gist`.
- `RoomStatusHistory`: append-only, registra cada cambio operativo y de housekeeping. Un trigger rechaza `UPDATE`, `DELETE` y `TRUNCATE`.
- La expiración/activación de bloqueos se reconcilia de forma perezosa al leer habitaciones; la historia y auditoría se generan en la misma transacción.

## Día operativo

`GET /api/v1/properties/current/operational-day` calcula la fecha hotelera usando el timezone IANA y `operationalDayStart` de la propiedad. No asume medianoche. La implementación usa `Intl.DateTimeFormat` para manejar DST sin offsets fijos.

## Auditoría append-only

- No existe ruta HTTP para actualizar o borrar `AuditEvent`.
- `AuditService` solo expone `append` y `list`.
- Triggers PostgreSQL rechazan `UPDATE`, `DELETE` y `TRUNCATE` sobre `AuditEvent` y `RoomStatusHistory`.
- `metadata` está limitada a 8 KiB en API y base de datos.

## Integridad de base de datos

`pnpm db:verify` valida que la base aplicada contiene las constraints y triggers manuales que Prisma no modela:

- FKs compuestas organización/propiedad/rol/membresía;
- checks de email, moneda, hora operativa, tokens de sesión, habitaciones y bloqueos;
- exclusion constraint de solapamiento de bloqueos;
- constraints de `Stay`/`Incident`, coherencia tenant y unicidad de estancia por reserva;
- funciones y triggers append-only;
- extensión `btree_gist`.

Esto cierra la limitación de que una migración futura pueda borrar silenciosamente reglas manuales. CI ejecuta `pnpm db:verify`.

## Comandos

| Comando                        | Descripción                                    |
| ------------------------------ | ---------------------------------------------- |
| `pnpm dev`                     | API + web en watch                             |
| `pnpm build`                   | build de todos los workspaces                  |
| `pnpm lint`                    | ESLint API + Next                              |
| `pnpm typecheck`               | `tsc --noEmit` en API y web                    |
| `pnpm test`                    | tests unitarios de API                         |
| `pnpm test:e2e`                | E2E tenant/inventory/reservas con `dev-header` |
| `pnpm test:e2e:auth`           | E2E de sesiones/CSRF/rate limit                |
| `pnpm test:e2e:all:isolated`   | Todos los E2E en schemas PostgreSQL aislados   |
| `pnpm format` / `format:check` | Prettier                                       |
| `pnpm db:generate`             | genera Prisma Client                           |
| `pnpm db:migrate`              | crea/aplica migración en desarrollo            |
| `pnpm db:migrate:deploy`       | aplica migraciones existentes                  |
| `pnpm db:seed`                 | datos sintéticos idempotentes                  |
| `pnpm db:verify`               | valida constraints/triggers manuales           |
| `pnpm db:reset`                | reset destructivo local + seed                 |
| `pnpm infra:up` / `infra:down` | Docker Compose                                 |

Los E2E requieren infraestructura levantada, migración aplicada, seed ejecutado y `db:verify`:

```bash
pnpm infra:up
pnpm db:migrate:deploy
pnpm db:seed
pnpm db:verify
pnpm test:e2e
pnpm test:e2e:auth
```

## Estructura

```text
.
├── apps/
│   ├── api/                  # NestJS: auth, tenancy, permissions, audit, inventory, health
│   └── web/                  # Next.js + Chakra UI
├── docs/                     # producto, arquitectura, API, seguridad, decisiones
├── prisma/
│   ├── schema.prisma         # foundation + inventory
│   ├── migrations/           # SQL + constraints/triggers manuales
│   └── seed.ts
├── scripts/
│   └── verify-db-integrity.ts
├── prompts/
├── docker-compose.yml
├── package.json
└── pnpm-workspace.yaml
```

## Limitaciones

- La autenticación local es una transición controlada: incluye MFA TOTP, recuperación/verificación por token hash, bloqueo por intentos fallidos y administración básica de sesiones/membresías/roles, pero **no** incluye proveedor de identidad final, recovery codes, desbloqueo administrativo completo, ni entrega de correo en producción.
- El rate limiting es fixed-window y falla abierto si Redis no está disponible; no sustituye un WAF/rate limiter perimetral.
- Los tokens de reset/verificación solo se registran/devuelven fuera de producción según `AUTH_TOKEN_DELIVERY`; en producción se requiere proveedor de correo.
- La administración tiene UI (`/admin`) pero aplica reglas conservadoras en API (subset de permisos del actor y protección del último administrador); no incluye aprobaciones de cambios sensibles.
- El estado operativo se reconcilia en lecturas y mediante un scheduler in-process con advisory lock PostgreSQL; no sustituye observabilidad/alertas operativas.
- La UI cubre listas, calendario, Front Office y administración, pero no folios, caja, night audit, reportes, OCR, offline ni Edge.
- Una reserva admite una sola habitación y las estancias usan granularidad de fecha calendario. El check-in se habilita por fecha local; las horas exactas de llegada/salida y los conflictos con bloqueos a nivel de instante siguen pendientes de validación con el hotel piloto.
- El room rack y las acciones de Front Office se validan en backend, pero la UI no oculta acciones según permisos: un rol de solo lectura recibe el `403` de la API.
- El conflicto reserva↔bloqueo se serializa por el lock de la fila `Room`, pero no existe una constraint única que relacione ambas tablas.
- Los E2E aislados crean/drolean esquemas por ejecución y requieren PostgreSQL local/CI con permisos adecuados.
- El workflow CI está actualizado para E2E aislado, pero no se ha observado una ejecución remota en GitHub desde este entorno.
- Backups/restore drill y métricas/logs son baseline local/operador; no hay backups administrados, agregación de logs/métricas, revisión de seguridad externa ni hardening perimetral completo.

## Siguiente paso recomendado

Phase 5 — Folio, caja y night audit: cargos/pagos sin datos de tarjeta, sesiones de caja, cierre del día operativo idempotente y reportes operativos básicos. Antes de implementarlo, definir la estrategia decimal/menor unidad, moneda e idempotencia financiera con el hotel piloto.

Pendiente inmediato de producto: validar con el piloto las horas de check-in/out, no-show y la política de overbooking antes de refinar la granularidad de fechas.

## Documentación

- `AGENTS.md`
- `docs/PRODUCT_BRIEF.md`
- `docs/ARCHITECTURE.md`
- `docs/DATABASE.md`
- `docs/API.md`
- `docs/SECURITY.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/DECISIONS.md`
- `docs/PHASE_1_REPORT.md`
- `docs/PHASE_2_REPORT.md`
- `docs/PHASE_3_REPORT.md`
- `docs/PHASE_4_REPORT.md`
- `prompts/PROMPT_01_FOUNDATION.md`
