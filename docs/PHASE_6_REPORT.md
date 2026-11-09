# NOVA PMS — Phase 6 Implementation Report (2026-11-09)

## Scope implemented

- Pilot onboarding checklist at `/pilot` with persisted progress and links to implemented flows.
- Pilot feedback: `PilotFeedback` model, migration, tenant-scoped API (`submit`, `read`, `review`), permissions, audit and `/pilot` UI.
- Isolated demo sandbox (first version): `pnpm demo:sandbox` provisions a `demo_sandbox` PostgreSQL schema with the same migrations and synthetic seed.
- Concurrency hardening: parallel folio opening, competing payments and concurrent cash session opening; unique-constraint races return `409` instead of `500`.
- Accessibility baseline: skip link, `<main>` landmark, focus-visible styles and labeled controls.
- Runbook (`docs/PILOT_RUNBOOK.md`) and sign-off checklist (`docs/PILOT_CHECKLIST.md`).
- Backup and restore drill executed successfully against a temporary database.

## Verified commands/results (executed in this workspace)

| Command                      | Result                                                                                   |
| ---------------------------- | ---------------------------------------------------------------------------------------- |
| `pnpm prisma migrate deploy` | pass — applied `20261109120000_phase6_pilot_feedback`                                    |
| `pnpm db:seed`               | pass — new `pilot.feedback.*` permissions and grants applied                             |
| `pnpm db:verify`             | pass — **154 constraints, 8 triggers, 4 functions, 14 indexes and btree_gist**           |
| `pnpm lint`                  | pass — API + web                                                                         |
| `pnpm typecheck`             | pass — API + web                                                                         |
| `pnpm test`                  | pass — **11 suites / 46 unit tests**                                                     |
| `pnpm build`                 | pass — API + web; `/pilot` route generated                                               |
| `pnpm test:e2e:all:isolated` | pass — **8 suites / 72 tests** (default) and **1 suite / 12 tests** (auth)               |
| `pnpm format:check`          | pass                                                                                     |
| `pnpm db:backup`             | pass — logical dump written under `backups/`                                             |
| restore drill                | pass — temporary database created, dump restored, integrity checks run, database dropped |
| `pnpm demo:sandbox`          | pass — `demo_sandbox` schema migrated and seeded; sandbox URL and demo users printed     |

`pilot-hardening.e2e-spec.ts` adds five tests: property-scoped feedback and permissions, concurrent folio opening, competing payments without overpayment, concurrent cash session opening, and metrics without guest data.

## Incident found and fixed during verification

The first E2E run failed three tests. The concurrent cash-session opening produced `500` instead of `409`: Prisma's `P2002` for the partial unique index did not expose the index name in the message, so the handler did not recognize it. The service now resolves `P2002` explicitly by re-reading the idempotency key (replay) or returning `409 cash_session_already_open`. The rerun passed all suites. The two downstream failures (pre-existing cash session still open, missing `cash_session.closed` audit event) disappeared once the test could close its session.

## Backend details

- `prisma/migrations/20261109120000_phase6_pilot_feedback/migration.sql`: `PilotFeedback`, enums, single and composite tenant FKs, message/rating/context/review checks and indexes.
- `apps/api/src/pilot/`: submit/list/get/review service, controller with `pilot.feedback.*` permissions, DTO validation and audit events.
- `apps/api/src/access/permissions.ts` + `prisma/seed.ts`: submit for all operational roles; read for manager and auditor; manage for manager; admin keeps all permissions.
- `apps/api/src/folio/cash.service.ts`: `P2002` race resolution without leaking a server error.

## Web details

- `apps/web/src/app/(app)/pilot/page.tsx`: onboarding checklist persisted in `localStorage`, progress indicator, feedback form and recent feedback with review action.
- `apps/web/src/components/app-shell.tsx`: skip link, `<main id="main-content">` landmark and `Piloto` navigation entry.
- `apps/web/src/lib/pilot-types.ts` and `apps/web/src/components/icons.tsx`: pilot response types and icon.

## Product/architecture decisions

- ADR-034: pilot feedback is property-scoped operational input, immutable from the API and audited.
- ADR-035: the demo sandbox isolates by PostgreSQL schema, local-only and confirmation-gated.

## Known limitations / open questions

- Onboarding is a checklist, not a guided overlay tour.
- The sandbox shares the PostgreSQL instance; it is schema isolation, not cluster isolation.
- No external load-testing tool was added; concurrency is covered by isolated E2E tests.
- Monitoring thresholds are documented in the runbook, without automated paging.
- Pilot sign-off and remote CI execution remain pending.
- The `/pilot` UI was built, compiled and covered indirectly by API tests, but not visually reviewed in a browser in this run.
- Feedback editing, deletion and retention policy need pilot/LGPD validation (`OPEN QUESTION`).
- No commit or push was made; the working tree contains the Phase 6 changes.
