# NOVA PMS

SaaS hotelero multi-tenant. Este repositorio contiene la **Phase 1 — Foundation**, la **Phase 2 — Configuración de propiedad e inventario** y el backend de la **Phase 3 — Huéspedes y reservas** ejecutables: monorepo, API NestJS, web Next.js, PostgreSQL/Redis, Prisma, autenticación local con sesiones/MFA/recuperación, CSRF, rate limiting, contexto tenant en servidor, RBAC por organización y propiedad, auditoría append-only, health checks, inventario de habitaciones, estados operativos y de housekeeping separados, bloqueos out-of-order/out-of-service, huéspedes minimizados, reservas con disponibilidad y asignación transaccional, historial append-only de reservas, seeds sintéticos y pruebas de aislamiento.

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

Todas las mutaciones de propiedades, inventario, huéspedes y reservas escriben `AuditEvent` en la misma transacción. No existe ruta HTTP para modificar o borrar auditoría, historial de estado ni historial de reservas.

## Huéspedes y reservas

- `Guest` es property-scoped y minimizado: nombre, email/teléfono opcionales, documento opcional (tipo + número juntos) y notas. Sin borrado físico; `status = DISABLED`.
- `Reservation` usa fechas calendario de la propiedad `[checkInDate, checkOutDate)`, una habitación opcional y estados `CONFIRMED`/`CANCELLED` en esta fase (check-in/out pertenece a Front Office).
- `POST /reservations` acepta `idempotencyKey`; repetir la misma clave devuelve la reserva original y una clave reutilizada con otro payload responde `409 idempotency_key_reuse`.
- `GET /reservations/availability` excluye habitaciones inactivas, bloqueadas o ya reservadas en el rango solicitado.
- La asignación de habitación valida room type, bloqueos y solapamiento bajo lock de la fila `Room`. La garantía final es la exclusion constraint PostgreSQL `Reservation_room_date_no_overlap`.
- `ReservationHistory` es append-only; las modificaciones y cancelaciones preservan historial y auditoría.

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
- Los permisos de administración son API-only (sin UI) y aplican reglas conservadoras (subset de permisos del actor y protección del último administrador).
- El estado operativo se reconcilia en lecturas y mediante un scheduler in-process con advisory lock PostgreSQL; no sustituye observabilidad/alertas operativas.
- El backend de huéspedes y reservas existe, pero no hay calendario UI ni front office (check-in/out, room rack, room move), folios, caja, night audit, OCR, offline ni Edge.
- Una reserva admite una sola habitación y las estancias usan granularidad de fecha calendario; las horas de check-in/out y los conflictos con bloqueos a nivel de instante necesitan revisión en Front Office.
- El conflicto reserva↔bloqueo se serializa por el lock de la fila `Room`, pero no existe una constraint única que relacione ambas tablas.
- Los E2E aislados crean/drolean esquemas por ejecución y requieren PostgreSQL local/CI con permisos adecuados.
- El workflow CI está actualizado para E2E aislado, pero no se ha observado una ejecución remota en GitHub desde este entorno.
- Backups/restore drill y métricas/logs son baseline local/operador; no hay backups administrados, agregación de logs/métricas, revisión de seguridad externa ni hardening perimetral completo.

## Siguiente paso recomendado

Phase 4 — Front Office: room rack, listas de llegadas/salidas/in-house, check-in/check-out como máquina de estados idempotente, cambio de habitación y notas/incidencias. Antes de check-in, definir la relación entre reserva, estancia y estado de ocupación de la habitación.

Pendiente inmediato de Phase 3: calendario de reservas (RSV-006) y UI de huéspedes; el backend y sus garantías de concurrencia ya están implementados.

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
- `prompts/PROMPT_01_FOUNDATION.md`
