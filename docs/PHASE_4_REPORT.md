# NOVA PMS — Phase 4 Implementation Report (2026-11-08)

## Scope implemented

- Calendar UI for reservations (`/calendar`) as the remaining Phase 3 web deliverable.
- Front Office API: room rack/overview, arrivals/departures/in-house, check-in, check-out, room move, no-show and incidents.
- Front Office web UI (`/front-office`) with operational counters, tabs, room rack, action modals and incident lifecycle.
- Migration, permissions, seed grants, audit/history integration, E2E coverage and documentation.

## Verified commands/results (executed in this workspace)

| Command                              | Result                                                                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | --- | ----------- | ------------------------------------ |
| `pnpm db:migrate:deploy`             | pass — applied `20261108230000_phase4_front_office`                                                                           |
| `pnpm db:seed`                       | pass — synthetic data; new `front_office.*`/`incidents.*` permissions and role grants applied                                 |
| `pnpm db:verify`                     | pass — **77 constraints, 8 triggers, 4 functions, 2 indexes and btree_gist**                                                  |
| `pnpm typecheck`                     | pass — API + web                                                                                                              |
| `pnpm lint`                          | pass — API + web                                                                                                              |
| `pnpm format:check`                  | pass                                                                                                                          |     | `pnpm test` | pass — **11 suites / 46 unit tests** |
| `pnpm --filter @nova/api build`      | pass                                                                                                                          |
| `pnpm --filter @nova/web build`      | pass — 14 routes, including `/front-office` and `/calendar`                                                                   |
| `pnpm test:e2e:isolated`             | pass — **6 suites / 60 tests**, including 9 new Front Office tests                                                            |
| `pnpm test:e2e:auth:isolated`        | pass — **1 suite / 12 tests**                                                                                                 |
| `pnpm test:e2e:all:isolated`         | pass — exit code 0 (default + auth isolated schemas created, migrated, seeded and dropped)                                    |
| Browser smoke test (`/front-office`) | pass — loaded real Centro data; check-in, check-out and incident create/resolve completed against the API; room rack rendered |

## Backend details

- `prisma/migrations/20261108230000_phase4_front_office/migration.sql`: `Stay`, `Incident`, enums, `Reservation.noShowAt`, composite tenant FKs, unique stay per reservation, checkout/no-show consistency checks and incident length/status checks.
- `apps/api/src/front-office/front-office.service.ts`: property-scoped overview and transactional transitions with `SELECT ... FOR UPDATE` locks on reservation/stay/room; room availability, block and overlap validation; append-only reservation history and audit.
- `apps/api/src/front-office/front-office.controller.ts`: guarded routes for overview, check-in, check-out, room move, no-show, incident list/create/resolve.
- `apps/api/src/front-office/dto/front-office.dto.ts`: whitelisted DTOs with enum, UUID, length and calendar-date validation.
- `apps/api/src/access/permissions.ts` + `prisma/seed.ts`: `front_office.read`, `front_office.manage`, `incidents.read`, `incidents.manage`; admin/reception have manage, auditor/housekeeper have read.
- `apps/api/test/front-office.e2e-spec.ts`: room rack, check-in idempotency, room move and room-type mismatch, checkout idempotency, no-show timing, incidents, permission split and tenant/property isolation.

## Web details

- `apps/web/src/app/(app)/front-office/page.tsx`: operational counters, arrivals, in-house, departures, room rack, incidents, check-in/out/move/no-show and create/resolve incident modals.
- `apps/web/src/app/(app)/calendar/page.tsx`: room × night calendar with 7/14/21-day windows, navigation, status colours, unassigned reservations and detail modal.
- `apps/web/src/lib/types.ts`, `format.ts`, `components/app-shell.tsx`: Front Office response types, labels and navigation entry.
- The UI does not decide authorization; the API enforces every action. Reloading the overview preserves the selected tab once data exists.

## Product/architecture decisions

- ADR-026: occupancy is derived from a single `Stay` per reservation, separate from housekeeping.
- ADR-027: check-in/out are idempotent transitions keyed by the property local calendar date; the operational day drives lists.
- ADR-028: incidents are scoped operational records with their own permissions and audit, not reservation edits.
- ADR-029: the Front Office UI keeps authorization in the API; action buttons are not permission-hidden yet.

## Known limitations / open questions

- One room and one stay per reservation; multi-room and shared stays need a future model.
- Check-in/out times, early check-in, late checkout, day-use and no-show timing need pilot validation (`OPEN QUESTION`).
- Incidents are not a ticketing system: no assignment, SLA, attachments or comments.
- The UI shows actions to read-only roles and surfaces the API `403`; a future `/me` capabilities contract could hide them.
- No folio, charges, payments or night audit are created by check-in/out.
- Remote CI was not observed from this environment; local isolated E2E and builds passed.
- No commit or push was made; the working tree contains the Phase 1–4 changes.
