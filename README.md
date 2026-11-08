# NOVA PMS

SaaS hotelero multi-tenant. Este repositorio contiene la **Phase 1 — Foundation** ejecutable: monorepo, API NestJS, web Next.js, PostgreSQL/Redis, Prisma, contexto tenant en servidor, autorización por permisos, auditoría append-only, health checks, seeds sintéticos y pruebas de aislamiento.

> La autenticación actual es **solo de desarrollo**. No es producción-ready. Ver [Limitaciones](#limitaciones).

## Stack y versiones fijadas

| Componente      | Versión                       | Nota                              |
| --------------- | ----------------------------- | --------------------------------- |
| Node.js         | `>=20.11` (probado con 22.14) | `package.json` engines            |
| pnpm            | `8.15.1`                      | `packageManager`                  |
| Next.js / React | `14.2.15` / `18.3.1`          | App Router + Chakra UI 2.8.2      |
| NestJS          | `10.4.4`                      | API modular monolith              |
| Prisma          | `5.22.0`                      | Cliente generado en `postinstall` |
| PostgreSQL      | `17` (Docker)                 | Fuente de verdad                  |
| Redis           | `7` (Docker)                  | Auxiliar: readiness/cache futuro  |

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
pnpm db:migrate:deploy   # aplica la migración inicial
pnpm db:seed             # datos sintéticos idempotentes
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

La API carga `.env` desde `apps/api` y desde la raíz del repo. Next.js usa `NEXT_PUBLIC_API_URL` con default `http://localhost:3001`; para sobreescribirlo crea `apps/web/.env.local`.

## Autenticación de desarrollo (no producción)

No existe proveedor de identidad todavía. La API implementa una frontera explícita:

- Solo con `NODE_ENV != production` y `AUTH_MODE=dev-header`.
- El actor se resuelve desde el header `X-Dev-User-Id` y **se valida contra PostgreSQL** (usuario activo).
- En `NODE_ENV=production` la API rechaza `AUTH_MODE=dev-header` al arrancar y el guard también la rechaza aunque la configuración sea incorrecta.

El tenant **nunca** se toma del body:

- `X-Organization-Id`: selector validado contra `Membership` activa.
- `X-Property-Id`: selector opcional validado contra `PropertyMembership` activa y contra la organización seleccionada.

Un `organizationId`/`propertyId` inyectado en body/query no autoriza nada; los DTO rechazan campos desconocidos.

Usuarios sintéticos del seed:

| Usuario                     | ID (`X-Dev-User-Id`)                   | Acceso                           |
| --------------------------- | -------------------------------------- | -------------------------------- |
| `admin@demo.nova.local`     | `00000000-0000-4000-8000-000000000011` | Org A: Centro + Praia, rol admin |
| `reception@demo.nova.local` | `00000000-0000-4000-8000-000000000012` | Org A: Centro, recepción         |
| `auditor@demo.nova.local`   | `00000000-0000-4000-8000-000000000013` | Org A: Praia, auditoría          |
| `admin.b@demo.nova.local`   | `00000000-0000-4000-8000-000000000014` | Org B: Bosque                    |
| `disabled@demo.nova.local`  | `00000000-0000-4000-8000-000000000015` | Deshabilitado                    |

Ejemplo:

```bash
curl http://localhost:3001/api/v1/me \
  -H "X-Dev-User-Id: 00000000-0000-4000-8000-000000000011"

curl "http://localhost:3001/api/v1/audit-events?limit=20" \
  -H "X-Dev-User-Id: 00000000-0000-4000-8000-000000000011" \
  -H "X-Organization-Id: 00000000-0000-4000-8000-000000000001" \
  -H "X-Property-Id: 00000000-0000-4000-8000-000000000002"
```

## Endpoints implementados

| Método | Ruta                    | Guard         | Permiso                      |
| ------ | ----------------------- | ------------- | ---------------------------- |
| GET    | `/health/live`          | —             | —                            |
| GET    | `/health/ready`         | —             | comprueba PostgreSQL + Redis |
| GET    | `/api/v1/me`            | auth          | —                            |
| GET    | `/api/v1/organizations` | auth          | —                            |
| GET    | `/api/v1/properties`    | auth + tenant | — (solo membresías)          |
| POST   | `/api/v1/properties`    | auth + tenant | `property.manage`            |
| GET    | `/api/v1/audit-events`  | auth + tenant | `audit.read`                 |

`POST /properties` valida timezone IANA, moneda ISO de 3 letras y hora `HH:mm`, y escribe el `AuditEvent` en la misma transacción. El `propertyId` del evento es el contexto de autorización; la propiedad creada queda en `entityType/entityId`.

## Auditoría append-only

- No existe ruta HTTP para actualizar o borrar `AuditEvent`.
- `AuditService` solo expone `append` y `list`.
- La migración instala un trigger PostgreSQL que rechaza `UPDATE`, `DELETE` y `TRUNCATE` sobre `AuditEvent`.
- `metadata` está limitada a 8 KiB en API y base de datos.

## Comandos

| Comando                        | Descripción                                   |
| ------------------------------ | --------------------------------------------- |
| `pnpm dev`                     | API + web en watch                            |
| `pnpm build`                   | build de todos los workspaces                 |
| `pnpm lint`                    | ESLint API + Next                             |
| `pnpm typecheck`               | `tsc --noEmit` en API y web                   |
| `pnpm test`                    | tests unitarios de API                        |
| `pnpm test:e2e`                | E2E contra PostgreSQL/Redis locales sembrados |
| `pnpm format` / `format:check` | Prettier                                      |
| `pnpm db:generate`             | genera Prisma Client                          |
| `pnpm db:migrate`              | crea/aplica migración en desarrollo           |
| `pnpm db:migrate:deploy`       | aplica migraciones existentes                 |
| `pnpm db:seed`                 | datos sintéticos idempotentes                 |
| `pnpm db:reset`                | reset destructivo local + seed                |
| `pnpm infra:up` / `infra:down` | Docker Compose                                |

Los E2E requieren infraestructura levantada, migración aplicada y seed ejecutado:

```bash
pnpm infra:up
pnpm db:migrate:deploy
pnpm db:seed
pnpm test:e2e
```

## Estructura

```text
.
├── apps/
│   ├── api/                  # NestJS: auth dev, tenancy, permissions, audit, health
│   └── web/                  # Next.js + Chakra UI
├── docs/                     # producto, arquitectura, API, seguridad, decisiones
├── prisma/
│   ├── schema.prisma         # foundation
│   ├── migrations/           # SQL + constraints/trigger manuales
│   └── seed.ts
├── prompts/
├── docker-compose.yml
├── package.json
└── pnpm-workspace.yaml
```

## Integridad multi-tenant

Más allá de Prisma:

- FKs compuestas garantizan que `PropertyMembership` no mezcle organización, propiedad, rol y membresía de tenants distintos.
- `AuditEvent` no puede apuntar a una propiedad de otra organización.
- `email` se normaliza a minúsculas y sin espacios.
- Moneda y `operationalDayStart` tienen `CHECK` en PostgreSQL.
- Redis no participa en decisiones de integridad; solo readiness y coordinación efímera futura.

Detalle en `docs/DATABASE.md` y `docs/DECISIONS.md`.

## Limitaciones

- **Auth de desarrollo**: no hay login real, sesiones, cookies, CSRF ni recuperación de cuenta. No desplegar a producción.
- No hay rate limiting ni proveedor de identidad todavía.
- Los permisos son por propiedad. No existe todavía un rol organizacional separado de `PropertyMembership`; un usuario sin propiedad no tiene permisos efectivos.
- No hay endpoints de membresías, invitaciones, auditoría de accesos ni gestión de usuarios.
- `POST /properties` exige contexto de una propiedad existente con `property.manage`; no crea automáticamente membresías para la nueva propiedad.
- La API arranca aunque PostgreSQL esté caído: liveness responde `200` y readiness `503` hasta que la dependencia se recupera.
- No hay CI ejecutado en remoto todavía; el workflow está definido pero debe correr en GitHub.
- Los E2E usan la base local sembrada. No están aislados de datos de desarrollo y no deben apuntar a entornos reales.
- No se implementaron habitaciones, huéspedes, reservas, front office, folios, caja ni night audit (fases posteriores).

## Siguiente paso recomendado

Phase 2 — configuración de propiedad e inventario: timezone/currency/operational day aplicados, tipos de habitación, habitaciones, housekeeping separado de ocupación y fuera de servicio con historial auditado. Antes de reservas, definir y probar la estrategia de no-solapamiento en PostgreSQL.

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
- `prompts/PROMPT_01_FOUNDATION.md`
