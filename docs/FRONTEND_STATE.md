# NOVA PMS — Frontend state (Zustand)

## Principles

- **The API remains the source of truth.** Stores hold client workflow state and short-lived view state, not authoritative hotel data.
- **Tenant scope is explicit.** Each store records `tenantKey` (`organizationId:propertyId`) and clears or reloads when it changes. UI must not render stored data until the key matches the current selection.
- **No authorization in the client.** Stores may hold selected IDs, filters and drafts, but never permissions, tokens or server-derived access decisions.
- **One store per workflow.** Avoid a global god store. Add a new store only when state must survive route navigation or be shared by several components.
- **No PII persistence on disk.** Drafts live in memory only; they are not written to `localStorage`, `sessionStorage` or IndexedDB.

## Current stores

### `useAuditFeedStore` (`apps/web/src/stores/audit-feed.ts`)

- Holds filters, accumulated events, `nextCursor`, loading/error state and the active `tenantKey`.
- `load()` replaces the feed for a new filter/tenant; `loadMore()` appends the next cursor page.
- A monotonically increasing `requestId` discards stale responses after a filter or tenant change.
- The Audit screen hides items until `tenantKey` matches the selected property, so a tenant switch cannot briefly show the previous feed.

### `useImportDraftStore` (`apps/web/src/stores/import-draft.ts`)

- Holds CSV text, parsed preview, idempotency key and final import result.
- `setCsv()` clears any previous preview/result because the content changed.
- `ensureTenant()` clears the draft when the property changes.
- The Import screen hides the previous draft until the tenant key matches.
- CSV content stays in memory only; it is never persisted to browser storage.

## Adding a new store

1. Define a typed state interface with `tenantKey`, data, status and explicit actions.
2. Accept `TenantSelection` as an action argument instead of storing a tenant object or authorization result.
3. Add a request id or abort mechanism for async loads; ignore stale responses.
4. Hide or reset data on tenant change; do not rely solely on an effect that runs after render.
5. Keep business rules in the backend. The store may format or filter view data for UX, never decide availability, money or permissions.
6. Verify with `pnpm typecheck`, `pnpm lint` and `pnpm build`; add focused tests if the store grows complex.

## Future candidates

- `reservation-draft`: multi-step reservation form that survives navigation.
- `report-date-range`: shared range picker for reports and exports.
- `calendar-view`: selected date window, zoom and filters.
- `import-mapping`: XLSX/CSV column mapping for future imports.

If server-data caching becomes a real problem (deduplication, background refetch, invalidation), evaluate a server-state library such as TanStack Query instead of growing these stores into a cache.

## Date stack

- Instant-based hotel dates use Day.js with `utc` + `timezone` plugins in `apps/api/src/common/time/property-day.ts`.
- Calendar-date values (reservation check-in/check-out) remain date-only and must not be converted through a timezone.
- Do not mix fixed-offset arithmetic with Day.js or `Intl`; use the shared helper.
