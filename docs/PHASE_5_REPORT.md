# NOVA PMS — Phase 5 Implementation Report (2026-11-09)

## Scope implemented

- Folio API: open (idempotent), list/get, post charge, void charge, record payment and cancel.
- Money model: `Folio` header + `FolioLine` posted charges, `Payment`, `CashSession`, `CashMovement` and `OperationalClose`.
- Cash API: session list/get, open, movements and close with counted amount, expected cash and variance reason.
- Night audit API: operational-day close with blockers, forced close with reason, idempotent replay and controlled reopen.
- Web UI: `/folios`, `/folios/[id]` and `/cashier` (open/close session, movements and folio search).
- Migrations, permissions, seed grants, audit coverage, E2E tests and documentation.

## Verified commands/results (executed in this workspace)

| Command                         | Result                                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `pnpm prisma migrate deploy`    | pass — 9 migrations found, database schema up to date                                                        |
| `pnpm db:verify`                | pass — **143 constraints, 8 triggers, 4 functions, 13 indexes and btree_gist**                               |
| `pnpm lint`                     | pass — API + web                                                                                             |
| `pnpm typecheck`                | pass — API + web                                                                                             |
| `pnpm test`                     | pass — **11 suites / 46 unit tests**                                                                         |
| `pnpm --filter @nova/api build` | pass                                                                                                         |
| `pnpm build`                    | pass — API + web production build                                                                            |
| `pnpm test:e2e:all:isolated`    | pass — **7 suites / 67 tests** (default) and **1 suite / 12 tests** (auth), isolated schemas created/dropped |

## Backend details

- `prisma/migrations/20261109030000_phase5_folio_hardening/migration.sql`: restores the composite tenant FKs dropped by the draft Phase 5 migration, replaces the draft tables with the final folio/line/payment/cash/operational-close model and adds money, status and idempotency checks.
- `prisma/migrations/20261109032000_cash_session_currency/migration.sql`: cash sessions keep their own currency.
- `prisma/migrations/20261109033000_folio_active_unique/migration.sql`: at most one non-cancelled folio per reservation and per stay.
- `apps/api/src/folio/folio.service.ts`: transactional folio mutations with `SELECT ... FOR UPDATE` on the folio row, posted/void lines, payment settlement, overpayment and underfunded-void protection, idempotent replay and audit.
- `apps/api/src/folio/cash.service.ts`: open/movement/close flows, expected cash derived from opening amount plus signed movements, operational-date validation, variance reason and idempotent replay/close.
- `apps/api/src/night-audit/`: operational-day close with blockers, forced close with reason, snapshot, replay and reopen.
- `apps/api/src/access/permissions.ts` + `prisma/seed.ts`: `folio.read/manage`, `payment.read/manage`, `cash.read/manage`, `night_audit.read/manage` with role grants.
- `apps/api/test/folio.e2e-spec.ts`: folio idempotency, tenant/property isolation, charge/payment invariants, overpayment rejection, cash session reconciliation, variance requirement, night audit blockers/reopen and audit trail.

## Web details

- `apps/web/src/app/(app)/folios/page.tsx`: folio list with search/status filters and open-folio flow.
- `apps/web/src/app/(app)/folios/[id]/page.tsx`: folio detail with lines, payments, totals, charge/payment/void/cancel actions.
- `apps/web/src/app/(app)/cashier/page.tsx`: cash session list, open/close, movement entry and folio lookup.
- The UI does not decide authorization; the API enforces every action.

## Product/architecture decisions

- ADR-031: money is `DECIMAL(10,2)` with an explicit currency and decimal-string transport, never binary floats.
- ADR-032: folio is a header with posted lines; settlement is transactional and history preserving.
- ADR-033: cash sessions and the operational close are property-scoped, idempotent and explicit about variance.

## Known limitations / open questions

- Settlement and cancellation policy, payment methods and cash closing procedure need pilot validation.
- Payment methods are free-form uppercase codes; no bank reconciliation, card/PSP tokenization or fiscal document.
- One currency per folio and per cash session; no FX or multi-currency cash.
- Night audit is user-triggered; no scheduler closes the operational day automatically.
- Corrections to a closed day use reopen + re-close; no separate adjusting entries.
- The UI shows actions to roles without permission and surfaces the API `403`; a capabilities contract could hide them.
- The three Phase 5 screens were not visually reviewed in a browser in this run; only build, typecheck, lint and E2E coverage were verified.
- Remote CI was not observed from this environment.
- No commit or push was made; the working tree contains the Phase 5 changes.
