# NOVA PMS — Phase 2 Report: Property Settings & Inventory (+ Auth Hardening)

Date: 2026-11-08
Scope: the four Phase 1 limitations agreed for this iteration plus Phase 2 (property settings/timezone/operational day, inventory, housekeeping vs. operational state, out-of-order/out-of-service, history and audit).

## Delivered scope

### 1. Production-shaped authentication (transitional)

- Local credential sign-in with Node `scrypt` (`PasswordService`).
- Opaque server-side sessions; only SHA-256 token hashes persisted (`Session`).
- HttpOnly `nova_session` cookie; readable `nova_csrf` cookie with HMAC-SHA256 signed double-submit tokens.
- Global `CsrfGuard` for non-safe methods in `local-session` mode.
- Redis-backed fixed-window login rate limiting keyed by hashed IP + email.
- Session-aware `AuthenticationGuard` with `local-session`, `dev-header` (non-production only) and `disabled` modes.
- `POST /auth/logout` revokes the session and clears cookies.
- `dev-header` retained for deterministic tenant/inventory E2E tests.

### 2. Organization role separate from `PropertyMembership`

- `Membership.roleId` nullable; regular staff keep `null`.
- Effective permissions are the union of organization-role and property-role permissions.
- Organization-wide property access requires `property.read` on the organization role (`ORG_ADMIN`).
- Composite FK prevents assigning a role from another organization.
- `GET /me`, `GET /organizations` and `GET /properties` expose organization roles and accessible properties.

### 3. Property creation creates the creator's membership

- `POST /properties` requires `organization.properties.manage`.
- Property, creator `PropertyMembership`, and `property.created` audit are written in one transaction.
- Missing assignable role returns `403 property_role_required`.

### 4. Manual SQL constraints preserved and verified

- `scripts/verify-db-integrity.ts` asserts 37 constraints, 4 triggers, 2 functions and the `btree_gist` extension.
- Root `pnpm db:verify`; CI runs it after migrate + seed.

### 5. Phase 2 — Property settings and operational day

- `GET/PATCH /api/v1/properties/current` for name, IANA timezone, ISO currency and `operationalDayStart` (`HH:mm`).
- `GET /api/v1/properties/current/operational-day` computes the hotel date without assuming midnight, using `Intl.DateTimeFormat`.
- Settings changes are audited with before/after values.

### 6. Phase 2 — Inventory

- `RoomType` per property with unique code, capacity and bed type.
- `Room` per property with unique number, floor/building, attributes and room type.
- Housekeeping workflow: `DIRTY → CLEANING → CLEAN → INSPECTED → DIRTY` (with controlled reprocess paths), returning `422` on invalid transitions.
- Operational state `AVAILABLE / OUT_OF_ORDER / OUT_OF_SERVICE` derived from active `RoomBlock` rows.
- Blocks with reason and interval; overlapping active blocks rejected with `409 room_block_overlap`.
- PostgreSQL exclusion constraint `RoomBlock_active_no_overlap` (range type + `btree_gist`) as the final guarantee.
- Append-only `RoomStatusHistory` for both categories; triggers reject `UPDATE`/`DELETE`/`TRUNCATE`.
- Lazy expiry/reconciliation of operational state on room reads.
- Audit coverage for room types, rooms, blocks and state changes.

## Key files

### Schema, migrations and seeding

- `prisma/schema.prisma`
- `prisma/migrations/20261108120000_phase2_inventory_auth/migration.sql`
- `prisma/seed.ts`
- `scripts/verify-db-integrity.ts`
- `tsconfig.seed.json`

### Authentication

- `apps/api/src/auth/auth.controller.ts`
- `apps/api/src/auth/authentication.guard.ts`
- `apps/api/src/auth/csrf.guard.ts`
- `apps/api/src/auth/csrf.service.ts`
- `apps/api/src/auth/password.service.ts`
- `apps/api/src/auth/session.service.ts`
- `apps/api/src/auth/login-rate-limiter.service.ts`
- `apps/api/src/auth/dto/login.dto.ts`
- `apps/api/src/common/http/cookies.ts`
- `apps/api/src/config/env.validation.ts`

### Tenancy, properties and access

- `apps/api/src/access/permissions.ts`
- `apps/api/src/common/http/request-context.ts`
- `apps/api/src/tenancy/tenancy.service.ts`
- `apps/api/src/properties/properties.controller.ts`
- `apps/api/src/properties/properties.service.ts`
- `apps/api/src/properties/dto/update-property-settings.dto.ts`
- `apps/api/src/operational-day/operational-day.ts`

### Inventory

- `apps/api/src/inventory/inventory.controller.ts`
- `apps/api/src/inventory/inventory.module.ts`
- `apps/api/src/inventory/room-types.service.ts`
- `apps/api/src/inventory/rooms.service.ts`
- `apps/api/src/inventory/room-blocks.service.ts`
- `apps/api/src/inventory/room-state.service.ts`
- `apps/api/src/inventory/housekeeping-transitions.ts`
- `apps/api/src/inventory/dto/*.ts`

### Tests and CI

- `apps/api/src/auth/password.service.spec.ts`
- `apps/api/src/auth/csrf.service.spec.ts`
- `apps/api/src/auth/authentication.guard.spec.ts`
- `apps/api/src/tenancy/tenancy.service.spec.ts`
- `apps/api/src/operational-day/operational-day.spec.ts`
- `apps/api/src/inventory/housekeeping-transitions.spec.ts`
- `apps/api/src/audit/audit.service.spec.ts`
- `apps/api/test/inventory.e2e-spec.ts`
- `apps/api/test/auth-session.e2e-spec.ts`
- `apps/api/test/tenant-isolation.e2e-spec.ts`
- `apps/api/test/jest-e2e-auth.config.js`
- `apps/api/test/setup-env-auth.ts`
- `.github/workflows/ci.yml`

### Configuration and docs

- `.env.example`
- `package.json`, `apps/api/package.json`
- `README.md`
- `docs/API.md`, `docs/DATABASE.md`, `docs/DECISIONS.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/SECURITY.md`

## Commands executed and results

All were run locally on macOS with Node `v22.14.0`, pnpm `8.15.1`, PostgreSQL/Redis via Docker Compose.

| Command                                                | Result                                                                   |
| ------------------------------------------------------ | ------------------------------------------------------------------------ |
| `pnpm exec prisma format && pnpm exec prisma validate` | schema valid                                                             |
| `pnpm db:migrate:deploy`                               | both migrations applied                                                  |
| `pnpm db:generate`                                     | Prisma Client generated                                                  |
| `pnpm db:reset`                                        | migrations re-applied from empty DB + seed                               |
| `pnpm db:seed`                                         | `2 organizations, 3 properties, 6 users, 6 roles, 3 room types, 6 rooms` |
| `pnpm db:verify`                                       | `37 constraints, 4 triggers, 2 functions and btree_gist`                 |
| `pnpm --filter @nova/api typecheck`                    | pass                                                                     |
| `pnpm --filter @nova/api lint`                         | pass                                                                     |
| `pnpm --filter @nova/api test`                         | 8 suites / 32 tests passed                                               |
| `pnpm --filter @nova/api test:e2e`                     | 2 suites / 30 tests passed                                               |
| `pnpm --filter @nova/api test:e2e:auth`                | 1 suite / 5 tests passed                                                 |

No test was skipped or disabled to obtain these results.

## Behavioral guarantees covered by tests

- Cross-organization and cross-property inventory access is denied.
- Room type codes and room numbers are unique per property.
- A room cannot reference a room type from another property.
- Invalid housekeeping transitions return `422`.
- `RoomStatusHistory` `UPDATE`/`DELETE` are rejected by the database trigger.
- Overlapping active blocks return `409`; releasing restores `AVAILABLE`.
- Out-of-service blocks produce `OUT_OF_SERVICE`; out-of-order takes precedence.
- Property settings changes are audited and the operational day reflects the configured timezone/start.
- CSRF requires matching signed cookie + header.
- Invalid credentials return one generic error.
- Session cookie is HttpOnly/`SameSite=Lax`; logout revokes it (`/me` returns `401` afterwards).
- Repeated logins are rate limited (`429`).

## Data and isolation notes

- All seed data is synthetic. No real guest, employee or document data is used.
- Demo password for every seeded user: `NovaDemo!2026`.
- Local E2E suites share the seeded database and must never point at a real environment.
- Redis is used only for readiness and login rate limiting; PostgreSQL remains the authority.

## Limitations and open items

- Local credentials are transitional: no MFA, password reset, email verification, account lockout or administrative session listing.
- Login rate limiting is fixed-window and fails open when Redis is unavailable; a perimeter limiter/WAF is still required.
- Session tokens are not rotated periodically.
- No membership, invitation or role-administration endpoints; role changes are seed/database operations.
- Room blocks do not yet interact with reservations or availability search.
- Operational-state expiry is reconciled lazily; there is no background scheduler.
- E2E tests are not isolated per run from the seeded database.
- Remote GitHub Actions execution has not been observed.
- No backups/restore drill, full observability or external security review yet.
- Reservation non-overlap strategy remains an explicit Phase 3 blocker.
