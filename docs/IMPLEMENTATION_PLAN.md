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

- pnpm monorepo.
- Next.js web app and NestJS API.
- Docker Compose PostgreSQL + Redis.
- Prisma and first migration.
- lint, format, typecheck, unit tests, E2E test skeleton.
- health endpoints.
- Organization, Property, User, Membership, PropertyMembership, Role/Permission baseline.
- authentication/session strategy (select only after documenting decision).
- tenant context and authorization guard/service.
- audit event foundation.
- seed local development data.

Exit:
- fresh clone starts using documented commands;
- migrations apply cleanly;
- cross-tenant access tests pass;
- health/readiness checks work;
- CI commands documented and green.

## Phase 2 — Hotel configuration and inventory (approx. 2–3 weeks)

- property settings/timezone/currency/operational day.
- room types, rooms, attributes.
- room occupancy/operational state separated from housekeeping.
- out-of-order/out-of-service.
- history and audit.

Exit:
- authorized staff can configure inventory;
- invalid/cross-property relations rejected;
- room state transitions tested.

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
