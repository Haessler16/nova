# NOVA PMS — Phase 3 Implementation Report (2026-11-08)

## Scope implemented in this session

Selected by the user (Phase 3 reservations not selected):

1. **Auth + administration** — MFA/TOTP, password recovery, email verification, account lockout, session listing/revocation, membership/role administration endpoints.
2. **E2E isolation + CI** — per-run PostgreSQL schema isolation and reproducible CI workflow updates.
3. **Backups + observability** — backup/restore drill scripts, structured request logs, metrics endpoint, extended configuration.
4. **Scheduler + inventory resilience** — background room-block expiry with PostgreSQL advisory lock, keeping PostgreSQL as integrity authority.

## Verified commands/results (executed in this workspace)

| Command                                                | Result                                                                                                                                            |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm db:generate`                                     | pass                                                                                                                                              |
| `pnpm db:migrate:deploy`                               | pass (applied `20261108180000_phase3_security_admin_runtime`)                                                                                     |
| `pnpm db:seed`                                         | pass (synthetic data; 2 orgs, 3 properties, 6 users, 6 roles, 3 room types, 6 rooms)                                                              |
| `pnpm db:verify`                                       | pass — `50 constraints, 6 triggers, 3 functions, 2 indexes and btree_gist`                                                                        |
| `pnpm format`                                          | pass                                                                                                                                              |
| `pnpm --filter @nova/api typecheck`                    | pass (after fixes)                                                                                                                                |
| `pnpm typecheck`                                       | pass (API + web)                                                                                                                                  |
| `pnpm lint`                                            | pass (API + web)                                                                                                                                  |
| `pnpm --filter @nova/api test -- totp password-policy` | pass — 2 suites / 10 tests                                                                                                                        |
| `pnpm test`                                            | pass — **10 suites / 42 tests**                                                                                                                   |
| `pnpm --filter @nova/api build`                        | pass                                                                                                                                              |
| `pnpm test:e2e:all:isolated`                           | pass — **5 suites / 51 E2E tests** (default: 4 suites/40 tests; auth: 1 suite/11 tests), per-run isolated schemas created/migrated/seeded/dropped |

## Key implementation details

### Schema / DB

- `prisma/migrations/20261108180000_phase3_security_admin_runtime/migration.sql`: User MFA/lockout/verification fields, `Session.userAgent`/`ipHash`, `Role.system`, `PasswordResetToken`, `EmailVerificationToken`, `SecurityEvent`, partial unique active-token indexes, checks, and `SecurityEvent` append-only trigger/function.
- `scripts/verify-db-integrity.ts` extended to verify new constraints/triggers/function/indexes.

### Auth

- `apps/api/src/auth/totp.service.ts`: RFC 6238 TOTP (HMAC-SHA1, 6 digits, 30s, windowed verify, base32).
- `apps/api/src/auth/mfa.service.ts`: AES-256-GCM encryption for TOTP secrets and signed short-lived MFA challenge tokens (requires `MFA_ENCRYPTION_KEY`).
- `apps/api/src/auth/password-policy.ts`: server-side password policy.
- `apps/api/src/auth/auth-token.service.ts`: hashed one-time reset/verification tokens.
- `apps/api/src/auth/auth.service.ts`: login with lockout + optional MFA challenge, MFA login completion, password change/reset flows, email verification request/confirm, MFA setup/enable/disable, session listing/revocation, security events/metrics.
- `apps/api/src/auth/auth.controller.ts`: new endpoints for sessions, password change/forgot/reset, email verification, MFA setup/enable/disable, MFA login completion.
- `apps/api/src/auth/session.service.ts`: stores user agent/IP hash metadata; supports self-service/admin revocation helpers.

### Administration

- `apps/api/src/admin/*`: organization-scoped membership/role administration, property membership assignment, member session revocation, security event listing.
- Permission escalation guard: actor can only grant permissions/roles whose permissions are a subset of their organization permissions.
- Last-admin guard prevents removing the final active administrator who can manage memberships.
- New permissions in `apps/api/src/access/permissions.ts` and seed.

### Scheduler / inventory resilience

- `apps/api/src/inventory/room-block-expiry.scheduler.ts`: in-process interval scheduler (disabled in tests), PostgreSQL advisory lock, idempotent `runOnce()`; delegates to existing `RoomStateService.reconcileProperty` so DB constraints/transactions remain authoritative.

### E2E isolation + CI

- `scripts/run-e2e-isolated.ts`: creates unique schema, migrates, seeds, runs command, drops schema in `finally`.
- Root scripts: `test:e2e:isolated`, `test:e2e:auth:isolated`, `test:e2e:all:isolated`.
- `.github/workflows/ci.yml` uses `pnpm test:e2e:all:isolated`.

### Backups + observability

- `scripts/backup-db.sh`, `scripts/restore-drill.sh` (local Docker safeguards + explicit confirmation for restore drill).
- `apps/api/src/observability/*`: structured JSON request logging interceptor, in-process Prometheus metrics (`/metrics`, excluded from `/api/v1` prefix, optional bearer token), request counters/histograms.
- `apps/api/src/security-events/*`: append-only security event service/DTO/module.

### Config

- `apps/api/src/config/env.validation.ts`: MFA/lockout/token delivery/scheduler/metrics env vars; production rejects `AUTH_TOKEN_DELIVERY!=none`.
- `.env.example`, `apps/api/test/setup-env-auth.ts` updated.

## Security notes (review)

- One-time tokens and session tokens are stored only as hashes/digests.
- TOTP secrets are encrypted at rest; MFA feature degrades to 503 when not configured.
- Password reset responses avoid account enumeration.
- CSRF remains required for unsafe local-session requests.
- Admin endpoints enforce organization permissions and subset/last-admin guards.
- Raw IPs are hashed before storage in session/security metadata.

## E2E coverage added (isolated schemas)

- `apps/api/test/auth-session.e2e-spec.ts` (local-session): CSRF, login/logout/session, invalid credentials, rate limit, **account lockout**, **session listing/revocation**, **password change + policy + session revocation**, **password reset with one-time token** (`AUTH_TOKEN_DELIVERY=response`), **email verification with one-time token**, **MFA setup/enable/challenge login/disable**.
- `apps/api/test/admin.e2e-spec.ts` (dev-header): membership list/create/update/deactivate, audit coverage, role create/immutability, last-admin guard, property membership CRUD/scope, cross-org denial, security event listing/permission denial, metrics endpoint.
- `apps/api/test/resilience.e2e-spec.ts` (dev-header): **scheduler `runOnce()` idempotent reconciliation** of expired active blocks, `SecurityEvent` append-only DB trigger, readiness/metrics.
- Existing `inventory.e2e-spec.ts` and `tenant-isolation.e2e-spec.ts` still pass under isolation.

## Remaining gaps / not fully completed

- **E2E depth still has edges**: positive privilege-escalation path with a limited-but-authorized actor (seeded ORG_ADMIN holds all permissions), `METRICS_TOKEN` protection path, some negative admin/role/membership branches, and UI flows (no UI tests).
- **Docs not fully refreshed**: `docs/API.md`, `docs/DATABASE.md`, `docs/SECURITY.md`, `docs/BACKLOG.md`, `docs/IMPLEMENTATION_PLAN.md` need comprehensive endpoint/table/contract updates.
- **Email delivery**: no provider integration; production token delivery is intentionally disabled.
- **MFA recovery**: no recovery codes/admin reset workflow.
- **Admin UI**: API-only.
- **Backups/observability in production**: scripts are local/operator baselines; no managed backup, log aggregation, alerting, or multi-replica metrics aggregation.
- **External-only limitations (cannot complete from this environment)**: WAF/perimeter rate limiting, external security review/penetration test, and observing a real remote GitHub Actions run.

## Suggested next commands

```bash
pnpm format:check
pnpm test          # full unit suite including new specs
pnpm test:e2e:all:isolated
pnpm build
```

---

# Phase 3 (continued) — Guests and reservations

Implemented on 2026-11-08 as the remaining Phase 3 scope from `docs/IMPLEMENTATION_PLAN.md` (GST-001/002; RSV-001/002/003/005). The auth/admin/runtime scope above is preserved.

## Scope

- Guest CRUD per property with data minimization, assisted search and no hard delete.
- Reservation lifecycle: create (optional room), modify, assign/reassign room, cancel, list/get, append-only history.
- Availability search by hotel date range, room type, active blocks and active reservations.
- Transactional room assignment (`SELECT ... FOR UPDATE` on `Room`) plus a PostgreSQL exclusion constraint as the final double-booking authority.
- Optional per-property idempotency key for reservation creation.
- Permissions `guests.read/manage`, `reservations.read/manage`; seed roles updated; 3 synthetic guests added.

## Verified commands/results (executed after the disconnect)

| Command                         | Result                                                                                              |
| ------------------------------- | --------------------------------------------------------------------------------------------------- |
| `pnpm db:generate`              | pass                                                                                                |
| `pnpm db:migrate:deploy`        | pass (applied `20261108210000_phase3_guests_reservations`)                                          |
| `pnpm db:seed`                  | pass (2 orgs, 3 properties, 6 users, 6 roles, 3 room types, 6 rooms, 3 guests)                      |
| `pnpm db:verify`                | pass — 77 constraints, 8 triggers, 4 functions, 2 indexes and `btree_gist`                          |
| `pnpm test`                     | pass — **11 suites / 46 tests** (new `reservation-dates.spec.ts`)                                   |
| `pnpm lint`                     | pass (API + web; removed 3 pre-existing unused-symbol lint errors)                                  |
| `pnpm typecheck`                | pass (API + web)                                                                                    |
| `pnpm format` / `format:check`  | pass                                                                                                |
| `pnpm --filter @nova/api build` | pass                                                                                                |
| `pnpm test:e2e:all:isolated`    | pass — **6 suites / 62 E2E tests** (default 5 suites/51; auth 1 suite/11), isolated schemas dropped |

## Files added/changed

- `prisma/schema.prisma`, `prisma/migrations/20261108210000_phase3_guests_reservations/migration.sql`: `Guest`, `Reservation`, `ReservationHistory`, enums, composite tenant FKs, checks, `Reservation_room_date_no_overlap`, append-only trigger.
- `apps/api/src/guests/*`, `apps/api/src/reservations/*`: controllers, services, DTOs, calendar-date helpers, module wiring.
- `apps/api/src/access/permissions.ts`, `prisma/seed.ts`, `scripts/verify-db-integrity.ts`.
- `apps/api/test/guests-reservations.e2e-spec.ts`, `apps/api/src/reservations/reservation-dates.spec.ts`.
- Docs: `README.md`, `docs/API.md`, `docs/DATABASE.md`, `docs/SECURITY.md`, `docs/DECISIONS.md` (ADR-022/023/024), `docs/BACKLOG.md`, `docs/IMPLEMENTATION_PLAN.md`.

## Remaining Phase 3 gaps

- Calendar UI (RSV-006) and guest UI are not implemented; the API is the only surface.
- One room per reservation; no multi-room/multi-guest reservation model.
- Check-in/check-out, room moves, stay statuses and instants belong to Front Office (Phase 4).
- Reservation↔room-block conflicts rely on the `Room` row lock; there is no single cross-table database constraint.
- No rates/pricing, deposits, folios or payments.
- Remote GitHub Actions execution still not observed.
