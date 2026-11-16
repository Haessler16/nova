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

Status: **implemented locally on 2026-11-08** (API and web UI); remote CI observation pending.

- [x] guest CRUD with privacy minimization and assisted (non-merging) search.
- [x] reservation lifecycle (create, modify, cancel; `CONFIRMED` → `CANCELLED`).
- [x] availability search by property date range, room type, blocks and active reservations.
- [x] room assignment/reassignment with transactional conflict handling.
- [x] concurrent booking tests and PostgreSQL exclusion constraint.
- [x] idempotent reservation creation (`idempotencyKey` per property).
- [x] append-only reservation history and audit coverage.
- [x] calendar UI (RSV-006).

Exit:

- [x] simultaneous attempts cannot confirm incompatible assignments;
- [x] cancellations and modifications preserve history;
- [x] tenant isolation passes.

Known Phase 3 gaps (guests/reservations):

- one room per reservation; no multi-room or multi-guest reservation model yet;
- stays use calendar-date granularity; check-in/out times, room moves and stay statuses belong to Front Office;
- reservation↔room-block conflicts are serialized by the `Room` row lock but not by a single cross-table database constraint;
- no rates, pricing, deposits or folio yet;
- no remote CI observation.

## Phase 4 — Front Office (approx. 3–5 weeks)

Status: **implemented locally on 2026-11-08** (API and web UI).

- [x] room rack.
- [x] arrivals/departures/in-house lists.
- [x] check-in/out state machine.
- [x] room move.
- [x] notes/incidents.
- [x] keyboard-friendly desktop UX baseline.

Exit:

- [x] complete reception flows E2E;
- [x] state transitions and audit events verified.

Known Phase 4 gaps:

- single room/stay per reservation; no multi-room or shared-stay model;
- check-in/out times, early check-in, late checkout, day-use and no-show policy need pilot validation;
- incidents are not a ticketing system: no assignment, SLA, attachments or comments;
- the UI does not hide actions by permission; the API returns `403` for read-only roles;
- no folio, charges or payments are created by check-in/out yet.

## Phase 5 — Folio, cash and operational day (approx. 4–6 weeks)

Status: **implemented locally on 2026-11-09** (API and web UI); remote CI not yet observed.

- [x] Prisma schema: `Folio`, `FolioLine`, `Payment`, `CashSession`, `CashMovement`, `OperationalClose` and status enums.
- [x] Migrations `20261109021002_phase5_folio_cash` (draft), `20261109030000_phase5_folio_hardening` (final model, restored tenant constraints, money/status checks), `20261109032000_cash_session_currency` and `20261109033000_folio_active_unique`.
- [x] API service/controller for folios: open, charge, void charge, payment and cancel; header plus posted/void line history.
- [x] API service/controller for payments by method, without card data and with overpayment protection.
- [x] API service/controller for cash sessions: open, movements and close with counted amount and variance reason.
- [x] Night audit: `POST /api/v1/operational-days/close` with blockers, forced close with reason, idempotent replay and controlled reopen.
- [x] Web UI: `/folios`, `/folios/[id]` and `/cashier` (session list, open/close, movements and folio search).
- [x] `pnpm db:verify` tracks Phase 5 tenant FKs, money/status/idempotency checks and partial unique indexes.
- [x] E2E tests for folio, payment, cash session, night audit, permissions and tenant isolation.

Exit:

- [x] financial invariants and reconciliation tests (no overpayment, no underfunded void, variance reason on close);
- [x] closeout replay does not duplicate entries;
- [x] audit trail complete for every financial mutation.

Known Phase 5 gaps (pilot validation):

- folio/charge amounts, settlement and cancellation policy need pilot validation;
- payment methods are free-form uppercase codes; bank reconciliation and card/PSP tokenization are not integrated;
- a cash session captures one currency from the property at open; multi-currency cash is out of scope;
- night audit closes the operational day from a request-time snapshot; no scheduler triggers it automatically;
- corrections to a closed day rely on reopen + re-close, without separate adjusting entries;
- the UI does not hide actions by permission; the API returns `403`;
- remote CI was not observed from this environment.

## Phase 6 — Pilot hardening and onboarding (approx. 3–5 weeks)

Status: **implemented locally on 2026-11-09** (first version); pilot sign-off and remote CI pending.

- [x] operational onboarding checklist (`/pilot`) with persisted progress and links to implemented flows.
- [x] isolated demo sandbox (first version): `pnpm demo:sandbox` provisions a `demo_sandbox` PostgreSQL schema with migrations and synthetic seed, local-only and confirmation-gated.
- [x] monitoring baseline verified: `/health/live`, `/health/ready`, `/metrics`, structured request logs and audit/security surfaces.
- [x] backup plus restore drill executed successfully against a temporary database.
- [x] concurrency tests: parallel folio opening, competing payments and concurrent cash session opening; P2002 races now map to `409` instead of `500`.
- [x] accessibility polish: skip link, `<main>` landmark, focus-visible styles and labeled controls.
- [x] pilot feedback workflow: property-scoped `PilotFeedback`, submit/read/review permissions, API and `/pilot` UI.
- [x] runbook (`docs/PILOT_RUNBOOK.md`) and sign-off checklist (`docs/PILOT_CHECKLIST.md`).

Exit:

- [ ] pilot checklist signed off by the hotel pilot (pending real session);
- [x] support/runbook prepared;
- [x] restore test successful.

Known Phase 6 gaps:

- onboarding is a checklist, not a step-by-step overlay tour;
- the sandbox isolates by PostgreSQL schema, not by cluster;
- no external load-testing tool or multi-replica metrics aggregation;
- monitoring alerts are documented thresholds, not automated paging;
- pilot sign-off and remote CI observation remain pending;
- the `/pilot` UI was built and compiled but not visually reviewed in a browser in this run.

## Phase 7 — Limited offline and imports (separate scope, approx. 4–8+ weeks)

Status: **first slice implemented locally on 2026-11-09**. No offline write outbox yet.

- [x] CSV guest import with server-side preview, row errors and explicit confirmation.
- [x] all-or-nothing commit with a property-scoped idempotency key (`GuestImport`); retries do not duplicate guests.
- [x] CSV limits (500 rows / 512 KB), quoted fields, comma or semicolon delimiters.
- [x] PWA shell caching: service worker caches the offline page and static assets, never API responses.
- [x] explicit online/offline status (existing indicator) plus a central guard that blocks mutations while offline.
- [ ] limited safe local reads and notes (deferred).
- [ ] outbox/reconciliation (deferred: requires per-domain conflict rules).
- [ ] XLSX and OCR/PDF/images (deferred; CSV first by design).
- [x] security/retention review for imports: no CSV stored, audit holds counts only, synthetic demo data only.

Exit:

- [x] simulated disconnections do not duplicate operations (idempotency replay plus offline write blocking);
- [x] conflicts are visible and recoverable (preview lists row errors; idempotency reuse returns `409`);
- [x] no critical operation is falsely shown as committed offline (mutations are rejected before the request).

Known Phase 7 gaps:

- the service worker is registered only in production builds and was not exercised in a browser in this run;
- there is no offline outbox, so writes require connectivity by design;
- no XLSX/OCR import, local read cache or offline notes yet;
- imports are capped at 500 rows and upload the whole CSV in one request;
- duplicate guests across separate files are allowed and remain a human dedupe decision.

## Phase 8 — NOVA Edge / integrations (discovery then estimate)

- validate hotel LAN topology and hardware.
- local coordinator architecture.
- security, update, backup, sync and support design.
- PIX/fiscal/OTA/legacy integrations scoped independently.
- no commitment before provider/hotel validation.

Status: discovery only. Groundwork implemented locally without committing the Edge architecture: `/health/version` diagnostics, audited CSV exports (guests, reservations, folios) and cursor/date/actor filters for the audit feed. There is no local coordinator, sync, agent or provider integration yet; those remain blocked on hotel/provider validation.

## Phase 9 — Documents & Reports v1 (implemented locally)

Status: **implemented locally on 2026-11-13**.

- [x] property-scoped immutable document templates, typed context and safe HTML preview;
- [x] server-side A4 PDF, private bytes in PostgreSQL, SHA-256, snapshot and authenticated download;
- [x] print events (dialog/request only), physical-signature receipt and reprint history;
- [x] fixed report catalog (occupancy, arrivals, departures, reservations, cash-daily), permissions, 62-day window, pagination;
- [x] PDF/CSV export with formula neutralization, 5000-row cap and audit-backed execution history;
- [x] contextual UI on reservation, guest, check-in, check-out and folio;
- [ ] logo per property, object storage/signed URLs, real printer/margin validation, XLSX and scheduled delivery;
- [x] FNRH remains discovery/integration boundary only; no HTTP client or credentials.

## Phase 10 — Reservation party / FNRH local model (implemented locally)

Status: **first internal slice implemented locally on 2026-11-16; external FNRH integration not implemented**.

- [x] `ReservationGuest` party with one `PRIMARY` per reservation and legacy backfill;
- [x] optional `GuestFnrhProfile` separated from the operational guest profile;
- [x] party API, readiness (FNRH vs hotel check-in), minor supervision and authorization rules;
- [x] legal check-in block only for party legal codes; incomplete FNRH does not block hotel check-in;
- [x] reservation detail UI for principal, companions, minors, conversion to adult and removal guards;
- [x] migration applied and verified in the authorized local database; not applied to staging/production;
- [ ] product/legal/DPO/security gates, Front Office arrival checklist, accessibility and legacy cleanup;
- [ ] FNRH adapter, credentials, homologation, operation ledger and real submission.

## Phase 11 — Notes & Instructions v1 (implemented locally)

Status: **implemented locally on 2026-11-15**.

- [x] structured reservation instructions with category, priority, visibility, assignment and status transitions;
- [x] immutable source text with PAN/CVV redaction, hashes and deterministic pt-BR parser suggestions;
- [x] human confirmation and deduplication; no payment, charge, rate or room mutation;
- [x] append-only instruction events, tags and validity window;
- [x] persistent guest notes separated from reservation instructions;
- [x] reservation, guest and check-in summary UI, including pending payment instructions;
- [x] isolated API/unit coverage and `datetime-local` timezone limitation documented;
- [ ] real preauthorization/payment provider integration (requires the payment module);
- [ ] property-timezone wall-clock editing for instruction validity and room blocks.

## Indicative timeline

For one experienced full-stack developer working full-time, a usable pilot-quality Front Office core may take roughly 20–30+ weeks depending on discovery, test depth, design and integration complexity. A broader hardened commercial release may take 30–40+ weeks. Treat these as planning ranges, not promises. Validate with a hotel pilot before fixing a commercial date.

## Release gates

- Alpha: foundation and internal workflows.
- Pilot: one property, controlled staff, support and rollback plan.
- Beta: multiple properties, measured reliability and onboarding.
- Commercial: security review, backup/restore, support process, monitoring, terms and operational readiness.
