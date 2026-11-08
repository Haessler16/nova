# NOVA PMS

SaaS hotelero multi-tenant. Este repositorio contiene la **Phase 1 — Foundation** y la **Phase 2 — Configuración de propiedad e inventario** ejecutables: monorepo, API NestJS, web Next.js, PostgreSQL/Redis, Prisma, autenticación local con sesiones, CSRF, rate limiting, contexto tenant en servidor, RBAC por organización y propiedad, auditoría append-only, health checks, inventario de habitaciones, estados operativos y de housekeeping separados, bloqueos out-of-order/out-of-service, seeds sintéticos y pruebas de aislamiento.

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

Todas las mutaciones de propiedades e inventario escriben `AuditEvent` en la misma transacción. No existe ruta HTTP para modificar o borrar auditoría ni historial de estado.

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

| Comando                        | Descripción                           |
| ------------------------------ | ------------------------------------- |
| `pnpm dev`                     | API + web en watch                    |
| `pnpm build`                   | build de todos los workspaces         |
| `pnpm lint`                    | ESLint API + Next                     |
| `pnpm typecheck`               | `tsc --noEmit` en API y web           |
| `pnpm test`                    | tests unitarios de API                |
| `pnpm test:e2e`                | E2E tenant/inventory con `dev-header` |
| `pnpm test:e2e:auth`           | E2E de sesiones/CSRF/rate limit       |
| `pnpm format` / `format:check` | Prettier                              |
| `pnpm db:generate`             | genera Prisma Client                  |
| `pnpm db:migrate`              | crea/aplica migración en desarrollo   |
| `pnpm db:migrate:deploy`       | aplica migraciones existentes         |
| `pnpm db:seed`                 | datos sintéticos idempotentes         |
| `pnpm db:verify`               | valida constraints/triggers manuales  |
| `pnpm db:reset`                | reset destructivo local + seed        |
| `pnpm infra:up` / `infra:down` | Docker Compose                        |

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

- La autenticación local no incluye MFA, recuperación de contraseña, bloqueo de cuenta, verificación de email ni proveedor de identidad. Debe revisarse antes de producción.
- El rate limiting es fixed-window y falla abierto si Redis no está disponible; no sustituye un WAF/rate limiter perimetral.
- Las sesiones no tienen rotación periódica de token ni listado/revocación administrativa de dispositivos.
- Los permisos de organización son aditivos y todavía no hay endpoints de administración de membresías, invitaciones o roles.
- El estado operativo se reconcilia de forma perezosa al leer habitaciones; no hay scheduler de expiración en segundo plano.
- No hay reservas, huéspedes, front office, folios, caja, night audit, OCR, offline ni Edge.
- No hay estrategia final de no-solapamiento de reservas. Antes de confirmar reservas debe definirse y probarse contra PostgreSQL.
- Los E2E usan la base local sembrada y no están aislados de datos de desarrollo; nunca deben apuntar a entornos reales.
- El workflow CI está definido pero no se ha observado una ejecución remota en GitHub.
- No hay backups/restore drill, observabilidad completa ni revisión de seguridad externa.

## Siguiente paso recomendado

Phase 3 — huéspedes y reservas: CRUD con minimización de datos, ciclo de vida de reserva, búsqueda de disponibilidad, asignación de habitación y pruebas de concurrencia. Antes de confirmar reservas, definir y validar la estrategia de no-solapamiento en PostgreSQL.

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
- `prompts/PROMPT_01_FOUNDATION.md`
