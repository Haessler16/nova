# NOVA PMS — Phase 1 Foundation Report

> Historical document. Authentication/session/CSRF/rate-limiting limitations listed here were partially addressed in Phase 2. See `docs/PHASE_2_REPORT.md` and ADR-008/ADR-009 in `docs/DECISIONS.md`.

Date: 2026-11-08
Scope: Phase 1 only (no rooms, guests, reservations, front office, folios, cash, night audit, OCR, offline, Edge).

## Delivered architecture

- pnpm workspace with `apps/api` (NestJS), `apps/web` (Next.js + Chakra UI), root Prisma schema/migrations/seed.
- PostgreSQL 17 and Redis 7 via `docker-compose.yml` with healthchecks and persistent volumes.
- Prisma 5.22 with an initial migration; generated client wired for API and seed.
- Server-side tenant resolution:
  1. resolve actor from development-only `X-Dev-User-Id` and PostgreSQL;
  2. validate ACTIVE `Membership` for `X-Organization-Id`;
  3. optionally validate property ownership and ACTIVE `PropertyMembership`;
  4. build immutable `TenantContext` with property-scoped permissions.
- Authorization:
  - atomic permissions (`property.read`, `property.manage`, `audit.read`);
  - `@RequirePermissions` + `PermissionsGuard`;
  - no body/query tenant trust; DTO whitelist rejects unknown fields.
- Audit:
  - `AuditService.append`/`list` only;
  - `POST /properties` writes audit in the same transaction;
  - DB triggers reject UPDATE/DELETE/TRUNCATE on `AuditEvent`.
- Health:
  - `/health/live` process-only;
  - `/health/ready` checks PostgreSQL and Redis concurrently.
- Error envelope `{ code, message, correlationId, details? }`; correlation id middleware; no raw Prisma errors to clients.
- Web landing page with live readiness status.
- Seeds: 2 synthetic organizations, 3 properties, 5 users, 5 roles, permissions and memberships. Deterministic ids.
- CI workflow for fresh install, migration, seed, lint, typecheck, unit, build and E2E.

## Relevant file tree

```text
.github/workflows/ci.yml
apps/api/
  src/
    access/permissions.ts
    audit/{audit.module.ts,audit.controller.ts,audit.service.ts,dto/}
    auth/{auth.module.ts,authentication.guard.ts}
    common/{decorators,filters,http,validators}
    config/env.validation.ts
    health/{health.module.ts,health.controller.ts,health.service.ts}
    identity/identity.controller.ts
    prisma/{prisma.module.ts,prisma.service.ts}
    properties/{properties.module.ts,properties.controller.ts,properties.service.ts,dto/}
    redis/{redis.module.ts,redis.service.ts}
    tenancy/{tenancy.module.ts,tenancy.service.ts,tenant-context.guard.ts,permissions.guard.ts}
    app.module.ts
    app.setup.ts
    main.ts
  test/tenant-isolation.e2e-spec.ts
apps/web/
  src/app/{layout.tsx,page.tsx,providers.tsx}
  src/components/health-status.tsx
prisma/
  schema.prisma
  migrations/20261108000000_init/migration.sql
  seed.ts
docker-compose.yml
```

## Commands executed and real results

Infrastructure:

```bash
docker compose up -d
# nova-postgres healthy, nova-redis healthy
```

Database:

```bash
pnpm db:migrate:deploy   # 1 migration applied from empty DB
pnpm db:seed             # 2 orgs, 3 properties, 5 users, 5 roles
```

Quality:

```bash
pnpm lint       # pass (API ESLint + Next lint)
pnpm typecheck  # pass (API + web)
pnpm test       # 4 suites, 16 tests passed
pnpm test:e2e   # 1 suite, 18 tests passed
pnpm build      # API + Next production build pass
```

Runtime verification:

- `GET /health/live` → `200`.
- `GET /health/ready` → `200` with `{database:"up", redis:"up"}`.
- With Redis stopped: `503` with `{database:"up", redis:"down"}`; restored → `200`.
- With PostgreSQL stopped: `503` with `{database:"down", redis:"up"}`; restored → `200`.
- API booted while PostgreSQL was down: liveness `200`, readiness `503`; after PostgreSQL recovered → readiness `200`.
- `GET /api/v1/me` with seeded admin → `200` with memberships.
- Production API start (`node dist/main.js`) → verified after fixing a stale TypeScript incremental-build issue (`incremental: false` in `tsconfig.build.json`).
- Next.js production server → `200`, title `NOVA PMS — Foundation`.

E2E coverage includes: no auth, disabled user, valid identity, organization spoofing, cross-organization property, missing property membership, missing tenant headers, permission denial, audit scoping, mass-assignment rejection, atomic audit write, DB-level audit immutability, HTTP audit mutation absent.

## Decisions

See ADR-001…ADR-007 in `docs/DECISIONS.md`: dev-header auth boundary, validated tenant selectors, property-scoped RBAC, append-only audit, composite tenant FKs, Redis auxiliary only, pinned versions.

## Risks and limitations

- Development authentication is not production-ready; no sessions, CSRF, rate limiting or identity provider.
- No organization-wide role separate from `PropertyMembership`; a user without any property has no effective permissions.
- `POST /properties` does not grant membership on the new property.
- Manual SQL constraints are invisible to Prisma drift checks.
- E2E depends on a seeded local database and must never target real environments.
- CI workflow has not been observed running on GitHub.
- Next/Nest/Prisma majors are intentionally pinned; upgrades need a decision.

## Recommended next task

Phase 2 — property configuration and inventory:

1. apply property timezone/currency/operational day to reads and date boundaries;
2. room types and physical rooms with tenant-safe relations;
3. separate occupancy/operational state from housekeeping state;
4. out-of-order/out-of-service with reason, interval and audit history;
5. define and test PostgreSQL overlap strategy before any reservation confirmation.

Do not start reservation confirmation until the overlap/concurrency design is proven against PostgreSQL.
