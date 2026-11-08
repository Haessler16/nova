# NOVA PMS — Implementation Plan

## Delivery strategy

Build a vertical slice foundation first. Do not ask the coding agent to implement the entire PMS in one pass. Each phase must be merged only after acceptance criteria and tests pass.

## Phase 0 — Repository discovery (0.5–1 week)

- Inspect repo and current toolchain.
- Confirm Node/pnpm versions and package manager.
- Confirm deployment target and environment strategy.
- Create architecture decision records for unresolved stack/version choices.
- No feature code until the current state is understood.

Exit:

- reproducible setup plan;
- no unreviewed destructive changes;
- documented decisions and risks.

## Phase 1 — Foundation (approx. 2–4 weeks)

Status: **implemented locally on 2026-11-08**; remote CI not yet observed.

- [x] pnpm monorepo.
- [x] Next.js web app and NestJS API.
- [x] Docker Compose PostgreSQL + Redis.
- [x] Prisma and first migration.
- [x] lint, format, typecheck, unit tests, E2E test skeleton.
- [x] health endpoints (liveness + readiness with real DB/Redis checks).
- [x] Organization, Property, User, Membership, PropertyMembership, Role/Permission baseline.
- [x] authentication/session strategy documented; development header auth isolated and non-production.
- [x] tenant context and authorization guard/service.
- [x] audit event foundation (append-only API + DB trigger).
- [x] seed local development data (synthetic, deterministic, idempotent).

Exit:

- [x] fresh clone starts using documented commands (verified locally).
- [x] migrations apply cleanly (verified from empty DB).
- [x] cross-tenant access tests pass (18 E2E tests).
- [x] health/readiness checks work (verified live).
- [x] CI commands documented and green locally; workflow added, remote run pending.

Known Phase 1 gaps (addressed or re-scoped in Phase 2 where noted):

- real identity provider, sessions, CSRF, rate limiting — **partially addressed in Phase 2** with local credential sessions (ADR-008); external IdP still open;
- org-level RBAC — **addressed in Phase 2** (ADR-009); membership administration endpoints still open;
- remote CI execution and migration drift checks — **migration drift verification added in Phase 2** (`pnpm db:verify`); remote CI run still pending;
- E2E isolation from the local seeded database — still open.

## Phase 2 — Hotel configuration and inventory (approx. 2–3 weeks)

Status: **implemented locally on 2026-11-08**; remote CI not yet observed.

- [x] property settings: timezone, currency, operational day start, name.
- [x] operational day endpoint using property timezone and `operationalDayStart` (`Intl`, no new dependency).
- [x] room types per property with capacity, bed type and status.
- [x] rooms per property with number, floor, building, attributes.
- [x] housekeeping state and operational state as separate dimensions.
- [x] out-of-order / out-of-service blocks with reasons and release flow.
- [x] non-overlapping active blocks enforced by PostgreSQL exclusion constraint (`btree_gist`).
- [x] append-only room state history (operational + housekeeping) with DB triggers.
- [x] audit coverage for every inventory/property mutation.
- [x] lazy operational-state reconciliation on room reads.
- [x] local credential sessions, CSRF, login rate limiting, session revocation.
- [x] organization roles additive to property roles; creator membership on property creation.
- [x] manual DB integrity verification (`pnpm db:verify`) wired into CI.
- [x] seed extended with room types, rooms, housekeeper user and permissions.
- [x] unit tests (8 suites / 32 tests), dev-header E2E (2 suites / 30 tests) and auth E2E (1 suite / 5 tests) pass locally.

Exit:

- [x] authorized staff can configure inventory;
- [x] invalid/cross-property relations rejected;
- [x] room state transitions tested;
- [x] cross-tenant inventory access denied;
- [x] manual constraints/triggers preserved and verified.

Known Phase 2 gaps:

- no MFA, password recovery, email verification, account lockout or administrative session listing;
- login rate limiting is fixed-window and fails open if Redis is down;
- organization-wide access depends on a seeded `ORG_ADMIN` role; no membership/role administration endpoints;
- room blocks do not yet interact with reservations or availability search;
- operational-state expiry is reconciled lazily, not by a background scheduler;
- E2E still shares the local seeded database.

## Phase 3 — Guests and reservations (approx. 4–6 weeks)

- guest CRUD with privacy minimization.
- reservation lifecycle.
- availability search.
- room assignment and conflict handling.
- concurrent booking tests.
- idempotency for creation/update commands where needed.
- calendar UI.

Exit:

- simultaneous attempts cannot confirm incompatible assignments;
- cancellations and modifications preserve history;
- tenant isolation passes.

## Phase 4 — Front Office (approx. 3–5 weeks)

- room rack.
- arrivals/departures/in-house lists.
- check-in/out state machine.
- room move.
- notes/incidents.
- keyboard-friendly desktop UX.

Exit:

- complete reception flows E2E;
- state transitions and audit events verified.

## Phase 5 — Folio, cash and operational day (approx. 4–6 weeks)

- folio and charge records.
- payment records (no card data).
- cash sessions and movements.
- closeout/night audit with idempotency and controlled exception path.
- basic operational dashboard/reports.

Exit:

- financial invariants and reconciliation tests;
- closeout replay does not duplicate entries;
- audit trail complete.

## Phase 6 — Pilot hardening and onboarding (approx. 3–5 weeks)

- operational onboarding.
- guided tour and isolated demo sandbox (small first version).
- monitoring, backup/restore drill, load/concurrency tests.
- accessibility and UX polish.
- pilot instrumentation and feedback workflow.

Exit:

- pilot checklist signed off;
- support/runbook prepared;
- restore test successful.

## Phase 7 — Limited offline and imports (separate scope, approx. 4–8+ weeks)

- PWA shell caching.
- explicit online/offline status.
- limited safe local reads and notes.
- outbox/idempotency/reconciliation.
- import pipeline CSV/XLSX first; OCR/PDF/images later.
- security/retention review.

Exit:

- simulated disconnections do not duplicate operations;
- conflicts are visible and recoverable;
- no critical operation is falsely shown as committed offline.

## Phase 8 — NOVA Edge / integrations (discovery then estimate)

- validate hotel LAN topology and hardware.
- local coordinator architecture.
- security, update, backup, sync and support design.
- PIX/fiscal/OTA/legacy integrations scoped independently.
- no commitment before provider/hotel validation.

## Indicative timeline

For one experienced full-stack developer working full-time, a usable pilot-quality Front Office core may take roughly 20–30+ weeks depending on discovery, test depth, design and integration complexity. A broader hardened commercial release may take 30–40+ weeks. Treat these as planning ranges, not promises. Validate with a hotel pilot before fixing a commercial date.

## Release gates

- Alpha: foundation and internal workflows.
- Pilot: one property, controlled staff, support and rollback plan.
- Beta: multiple properties, measured reliability and onboarding.
- Commercial: security review, backup/restore, support process, monitoring, terms and operational readiness.
