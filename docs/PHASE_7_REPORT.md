# NOVA PMS — Phase 7 Implementation Report (first slice, 2026-11-09)

## Scope implemented

- **Guest CSV import** at `/imports`: server-side preview with per-row errors, explicit confirmation and all-or-nothing commit.
- **Idempotency**: `GuestImport` header with unique `(propertyId, idempotencyKey)`; replays return the original result, reuse with other content returns `409 idempotency_key_reused`.
- **CSV safety**: 500-row / 512 KB caps, comma or semicolon delimiter, quoted fields and quoted newlines, duplicate-document detection inside the file.
- **Tenant authorization**: preview and commit require `guests.manage` and the property context resolved by the backend.
- **Offline shell**: service worker caches `/offline` and `_next/static` assets only; API responses and authenticated navigation HTML are never cached, so one session cannot serve another user's page offline.
- **Offline write blocking**: the shared API client rejects non-GET requests while `navigator.onLine === false`, so nothing is optimistically marked as committed.
- **Offline page** and production-only service-worker registration.
- Security/retention review: CSV content is not persisted; audit stores counts only; no PII in `GuestImport`.

## Verified commands/results (executed in this workspace)

| Command                      | Result                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| `pnpm prisma migrate deploy` | pass — applied `20261109150000_phase7_guest_import`                                 |
| `pnpm db:seed`               | pass (no new permissions; import reuses `guests.manage`)                            |
| `pnpm db:verify`             | pass — **162 constraints, 8 triggers, 4 functions, 16 indexes and btree_gist**      |
| `pnpm lint`                  | pass — API + web                                                                    |
| `pnpm typecheck`             | pass — API + web                                                                    |
| `pnpm test`                  | pass — **12 suites / 53 unit tests** (7 new CSV parser tests)                       |
| `pnpm build`                 | pass — `/imports` and `/offline` routes generated                                   |
| `pnpm test:e2e:all:isolated` | pass — **9 suites / 78 tests** (6 new import tests) and **1 suite / 12 auth tests** |
| `pnpm format:check`          | pass                                                                                |

The import E2E covers preview without persistence, atomic commit with audit, replay without duplicates, invalid-row rejection, `guests.manage` enforcement, concurrent commits with the same key, and property-scoped idempotency across tenants.

## Incident found and fixed during verification

The first isolated E2E run failed the cross-tenant idempotency test. The test built an email from the label `Tenant B`, which contained a space; the parser correctly rejected the row with `400`. The test fixture now normalizes the email prefix. The rerun passed all suites. Prettier also reformatted `public/sw.js`; `format:check` now passes.

## Backend details

- `prisma/migrations/20261109150000_phase7_guest_import/migration.sql`: `GuestImport`, unique indexes, tenant and creator FKs, row/count/idempotency checks.
- `apps/api/src/guests/guest-import.ts`: dependency-free CSV parser and row validation shared by preview and commit.
- `apps/api/src/guests/guest-import.service.ts`: all-or-nothing transaction, idempotency reservation, replay/conflict handling and audit.
- `apps/api/src/guests/guests.controller.ts`: `POST /api/v1/guests/import/preview` and `POST /api/v1/guests/import`.
- `apps/api/src/guests/dto/guest.dto.ts`: CSV and idempotency DTOs with whitelist validation.

## Web details

- `apps/web/src/app/(app)/imports/page.tsx`: file/text input, template, preview table with errors, confirm button and replay feedback.
- `apps/web/src/lib/api.ts`: offline guard for mutations.
- `apps/web/public/sw.js`, `apps/web/src/app/offline/page.tsx`, `apps/web/src/components/service-worker.tsx`: shell cache, offline page and production registration.
- `apps/web/src/components/app-shell.tsx` / `icons.tsx`: `Importaciones` navigation entry.

## Product/architecture decisions

- ADR-036: preview then all-or-nothing commit with property-scoped idempotency; no CSV persistence.
- ADR-037: offline mode blocks writes; no outbox in this slice, so no false offline commits.

## Known limitations / open questions

- The service worker is registered only in production builds; offline behavior was not exercised in a browser in this run.
- No offline outbox, local read cache or offline notes; RES-002/RES-003 remain future work.
- No XLSX, OCR, PDF or image import; CSV only by design.
- Imports are capped at 500 rows and 512 KB and read the whole file in one request.
- Duplicate guests across different files are allowed and remain a human dedupe decision (`OPEN QUESTION` for assisted dedupe).
- The `/imports` UI compiled and is covered by API/E2E tests, but was not visually reviewed in a browser.
- No commit or push was made.
