# NOVA PMS — Phase 8 groundwork (2026-11-09)

Phase 8 in `docs/IMPLEMENTATION_PLAN.md` is a discovery phase: hotel LAN/hardware, local coordinator, security/update/sync/support and provider integrations must be validated before any commitment. This document records the reversible groundwork implemented in code, not an Edge architecture.

## 1. Version and schema diagnostics

`GET /health/version` (public, like the other health routes) returns:

- app version (`APP_VERSION` or `npm_package_version`, else `unknown`);
- optional build commit (`GIT_COMMIT` or `GITHUB_SHA`);
- environment, Node version, uptime and server timezone;
- `database.reachable` and the latest applied Prisma migration.

It never exposes connection strings, secrets, row data or raw database errors. If PostgreSQL is down, the endpoint still answers and reports `reachable: false`.

## 2. Read-only CSV exports

Endpoints: `/api/v1/exports/guests`, `/exports/reservations`, `/exports/folios`.

- Tenant/property scoped with `guests.read`, `reservations.read` and `folio.read`.
- Reuse the visible list filters (`search`, `status`, dates).
- Cap of 5000 rows; exceeding it returns `400 export_too_large` instead of truncating.
- UTF-8 BOM, RFC 4180 quoting and formula-injection neutralization.
- `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`.
- Each run writes `export.guests|reservations|folios` with `{ rowCount }` only; no guest PII in audit.
- UI: `Exportar CSV` buttons in Guests, Reservations and Folios, respecting the filters on screen.

## 3. Audit feed for support and reconciliation

`GET /api/v1/audit-events` now accepts `actorUserId`, `fromDate` and `toDate` in addition to `action`, `entityType`, `entityId`, `cursor` and `limit`. The range is interpreted in the property's IANA timezone and includes both days; invalid ranges return `invalid_date_filter`. The Audit screen exposes the new filters and a `Cargar más` cursor action while preserving loading, empty and error states.

Folio exports apply the same property-timezone conversion to their single `date` filter. Reservation exports remain calendar-date overlap filters because reservation dates are date-only values, not instants.

## 3.1 Client state and date stack

- Instant-based date logic migrated from the custom `Intl` offset helper to **Day.js 1.11** with `utc` + `timezone` plugins, centralized in `apps/api/src/common/time/property-day.ts`. The existing timezone/DST tests remain and an invalid-timezone test was added.
- **Zustand 5** now owns two client workflows:
  - `useAuditFeedStore`: filters, accumulated events, cursor and loading/error state; survives route navigation and discards stale responses by request id.
  - `useImportDraftStore`: CSV, preview, idempotency key and result; in-memory only.
- Both stores are keyed by `organizationId:propertyId`, clear or reload on tenant change, and the UI hides the previous tenant's data until the key matches. They do not store tokens, permissions or authorization decisions.
- The pattern and future candidates (reservation draft, report ranges, calendar view, import mapping) are documented in `docs/FRONTEND_STATE.md`.

## 4. Design system verification (`docs/DESIGN_SYSTEM.md`)

- Shared `PageHeader`, `SectionCard`, `QueryFeedback`, `ErrorAlert` and token colors (`surface`, `line`, `textSecondary`, `brand`, `mint`, `danger`); no raw hex in the new UI.
- Export controls use the `PageHeader` action slot, small `outline` buttons, the local `DownloadIcon`, visible labels and loading state; filters are the same ones visible on the page.
- Audit inputs are labeled (`aria-label`), the filter bar wraps on narrow widths, destructive/financial actions were not changed, and there are no new dead controls.
- Modal detail, status badges with text, empty/loading/error states and keyboard-focus styles are preserved.
- The `/offline` page is a standalone semantic document; the service worker caches only the offline page and static assets.
- Limitación: no se hizo revisión visual en navegador en esta corrida; la verificación fue typecheck, lint, build, unit/E2E e inspección de tokens/componentes.

## 5. Verification results

| Command                      | Result                                                                                    |
| ---------------------------- | ----------------------------------------------------------------------------------------- | --- | ----------- | --------------------------------------------------------------------- |
| `pnpm lint`                  | pass — API + web                                                                          |
| `pnpm typecheck`             | pass — API + web                                                                          |     | `pnpm test` | pass — **14 suites / 67 unit tests** (CSV, health and timezone tests) |
| `pnpm build`                 | pass — `/audit`, `/guests`, `/reservations`, `/folios` regenerated                        |
| `pnpm test:e2e:all:isolated` | pass — **11 suites / 84 tests** (exports and timezone boundaries) + **1 suite / 12 auth** |
| `pnpm format:check`          | pass                                                                                      |
| `pnpm db:verify`             | unchanged — **162 constraints, 8 triggers, 4 functions, 16 indexes**                      |

No migration was needed for these features.

## 6. Limitations and open questions

- This is not the Edge coordinator, LAN sync, update agent or outbox; those remain blocked on hotel/provider discovery (ADR-039).
- Exports are synchronous and capped at 5000 rows; scheduled/streaming/XLSX exports remain future work.
- Export and audit instant filters resolve through the property's IANA timezone; a malformed property timezone fails the request instead of silently falling back to UTC.
- DST-at-midnight edge cases rely on the IANA database via `Intl`; no fixed-offset conversion is used.
- `/health/version` is public and must stay non-sensitive as it evolves.
- The UI was not visually reviewed in a browser in this run.
- Zustand stores are in-memory only: a reload clears the audit feed and any import draft. The reservation draft is not migrated to a store yet.
- Day.js still relies on the platform IANA database; DST-at-midnight edge cases remain covered only by the generic helper tests.
- No commit or push was made.
