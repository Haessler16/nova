# NOVA PMS — Decision Log

Use this file as an ADR index. Every material change should record context, options, decision, consequences, owner and date.

## Confirmed product direction

- NOVA PMS starts with Front Office.
- SaaS hierarchy: Organization → Property.
- Modular monolith before microservices.
- PostgreSQL is the source of truth.
- Redis is auxiliary, not final integrity authority.
- Multi-tenancy, authorization, audit and concurrency are foundational.
- Offline is incremental and capability-limited.
- NOVA Edge is future scope, not MVP.
- Academy starts as a guided tour + isolated sandbox.
- Import workflow requires human review before commit.
- No card PAN/CVV storage.

## Provisional technical choices

- Web: Next.js + React + TypeScript + Chakra UI.
- API: NestJS + TypeScript.
- ORM: Prisma.
- Database: PostgreSQL.
- Cache/coordination: Redis.
- Monorepo: pnpm workspaces.

These choices should be confirmed against the existing repository and current stable versions before installation.

## Open questions — product / hotel operations

1. What is the typical room count and property type for the first pilot?
2. What is the hotel's actual operational day start time?
3. How are day-use, early check-in, late checkout and overnight stays represented?
4. What reservation statuses and no-show policies are required?
5. Are room assignments made at booking time or mostly at arrival?
6. Is overbooking ever allowed? By whom and under what controls?
7. What are the exact cash drawer and payment reconciliation workflows?
8. Which reports are legally/operationally mandatory for the target hotels?
9. What is the minimum acceptable offline capability?
10. How many terminals must continue operating during WAN loss?
11. Which network devices and terminals have UPS, and what autonomy is required?
12. What happens during a full building power outage?
13. Which guest documents are required, for what purpose, and how long retained?
14. Which PMS is currently used and what data export/import is possible?
15. Which integrations (PIX, fiscal, OTA, accounting, locks) are required for pilot?

## Open questions — engineering

- Authentication provider vs local credentials.
- RBAC granularity and custom roles.
- PostgreSQL exclusion constraint vs row-lock strategy for room overlaps.
- Event transport and WebSocket authorization.
- Object storage provider and file scanning.
- Deployment platform, region, backups and RPO/RTO.
- Observability stack.
- Offline data classification and encryption model.
- Edge hardware/software distribution model.

## Phase 1 decisions — implemented 2026-11-08

### ADR-001 — Development header authentication is isolated and non-production

- Status: superseded for staging/production by ADR-008; retained only for development and E2E tests.
- Context: no identity provider has been selected, but tenant isolation and authorization must be implemented and testable now.
- Options: fake JWT; public trusted header; server-validated dev header restricted by environment.
- Decision: `AuthenticationGuard` resolves `X-Dev-User-Id` only when `NODE_ENV != production` and `AUTH_MODE=dev-header`, then loads an ACTIVE user from PostgreSQL. Production refuses this mode at config validation and at the guard.
- Consequences: integration/E2E tests exercise real membership authorization without inventing an incomplete login flow. Real auth, sessions, CSRF and rate limiting remain open.
- Validation required: select identity provider/session strategy before any non-local deployment.

### ADR-002 — Tenant selectors are validated, never trusted

- Status: accepted.
- Context: clients need to choose organization/property, but arbitrary ids must not authorize access.
- Decision: `X-Organization-Id` and optional `X-Property-Id` are selectors. The server validates active `Membership` and `PropertyMembership` (including property ownership by the organization) and builds an immutable `TenantContext`. DTOs use whitelist + `forbidNonWhitelisted`, so body ids are rejected.
- Consequences: cross-tenant access and mass assignment are covered by E2E tests.
- Validation required: revisit headers vs route-scoped tenant context when the web app has real navigation.

### ADR-003 — Property-scoped RBAC baseline

- Status: accepted for Phase 1; extended by ADR-009 (organization roles are additive).
- Context: the schema assigns roles through `PropertyMembership`; organization-level roles do not exist yet.
- Decision: permissions are resolved only when a property context is selected. Organization-only routes (`/organizations`, `/properties`) require an active membership but expose no permissions. `PropertyMembership` must reference a role and membership from the same organization (composite FKs).
- Consequences: there is no org-wide permission such as “manage all properties” yet. Audit queries require property context.
- Validation required: decide org-level roles and permission inheritance before multi-property administration.

### ADR-004 — AuditEvent is append-only at application and database layers

- Status: accepted.
- Context: audit integrity must not depend on endpoint discipline.
- Decision: `AuditService` has no update/delete methods and no mutating HTTP routes exist. The initial migration adds a trigger rejecting `UPDATE`, `DELETE` and `TRUNCATE` on `AuditEvent`. Audit metadata is capped at 8 KiB in API and DB.
- Consequences: users/properties referenced by audit events cannot be hard-deleted without violating the audit trail; use status/deactivation. Prisma `SetNull` on actor deletion is blocked by the trigger, which is intentional and requires soft-deactivation.
- Validation required: define retention/archival for audit events before long-term production use.

### ADR-005 — Composite tenant constraints in manual SQL

- Status: accepted.
- Context: Prisma cannot express all composite foreign keys cleanly, and single-column FKs allow cross-tenant references.
- Decision: keep Prisma models readable and add manual SQL constraints in the initial migration:
  - `PropertyMembership (organizationId, propertyId) → Property (organizationId, id)`;
  - `PropertyMembership (organizationId, roleId) → Role (organizationId, id)`;
  - `PropertyMembership (organizationId, userId) → Membership (organizationId, userId)`;
  - `AuditEvent (organizationId, propertyId) → Property (organizationId, id)`.
- Consequences: future migrations must preserve these constraints; `prisma migrate diff` will not generate them. Document and test them when changing the schema.
- Validation required: ~~add automated schema-drift checks~~ **closed by ADR-011** (`pnpm db:verify`).

### ADR-006 — Redis is readiness/coordination only

- Status: accepted.
- Context: Redis is useful for ephemeral coordination but cannot guarantee hotel integrity.
- Decision: Phase 1 uses Redis only for readiness. No locks or business decisions depend on it. PostgreSQL constraints/transactions remain the authority.
- Consequences: availability of Redis affects readiness but not data correctness.
- Validation required: design leases/outbox carefully in later phases.

### ADR-007 — Pinned initial versions

- Status: accepted for Phase 1.
- Context: registry latest versions in 2026 include new majors whose APIs were not validated for this repository.
- Decision: pin Node 20.11+, pnpm 8.15.1, NestJS 10.4.4, Next.js 14.2.15, React 18.3.1, Chakra UI 2.8.2, Prisma 5.22.0, PostgreSQL 17, Redis 7.
- Consequences: stable, tested baseline; major upgrades must be deliberate and documented.
- Validation required: schedule dependency/security review before pilot.

## Phase 2 decisions — implemented 2026-11-08

### ADR-008 — Local credential sessions for staging, with dev-header kept for tests

- Status: accepted for the transitional phase; not a final production identity decision.
- Date: 2026-11-08.
- Context: the pilot needs real sign-in, session invalidation and CSRF before an external identity provider is selected. Phase 1 had only `X-Dev-User-Id`.
- Options:
  1. keep the dev header until an IdP is chosen (blocks honest auth testing);
  2. local credentials with server-side sessions;
  3. embed an external IdP now (premature, vendor and integration cost).
- Decision:
  - `AUTH_MODE=local-session` authenticates email/password against `User.passwordHash`.
  - Passwords use Node built-in `scrypt` with self-describing parameters (`scrypt$N$r$p$salt$hash` in base64url).
  - Sessions are opaque 256-bit tokens; only their SHA-256 hex digest is stored in `Session`. Tokens are never logged or reconstructable from the database.
  - Session cookie is HttpOnly, `SameSite=Lax`, `Secure` when `NODE_ENV=production`.
  - CSRF is a signed double-submit token: `nonce.HMAC-SHA256(secret, nonce)`, stored in a readable cookie and echoed in `X-CSRF-Token`; validated on non-safe methods.
  - Login is rate limited with a fixed Redis window keyed by `sha256(ip|normalized_email)`; Redis failure degrades fail-open with a warning because identity authority is PostgreSQL.
  - `AUTH_MODE=dev-header` remains available only outside production for deterministic E2E tests, and is rejected by config validation and by the guard in production.
  - Logout revokes the session row and clears cookies. `Cache-Control: no-store` is set on auth responses.
- Consequences:
  - No native dependency was added for hashing (avoids cross-platform build risk).
  - Fixed-window limiting is simple but approximate; a perimeter WAF/limiter is still expected.
  - No MFA, password reset, email verification, account lockout or admin session listing yet.
  - Session tokens are not rotated periodically; TTL is the only expiry control.
- Validation required:
  - security review of scrypt cost on the deployment profile;
  - decide the final identity provider and whether to migrate local users;
  - add MFA/password recovery before production;
  - consider a distributed/multi-region rate-limit strategy.

### ADR-009 — Organization roles are additive and org-wide access requires `property.read`

- Status: accepted.
- Date: 2026-11-08.
- Context: ADR-003 only had property-scoped permissions. Organization administrators need to administer every property without a `PropertyMembership` row per property.
- Options:
  1. keep property-only roles and create a membership row per property for admins;
  2. add an optional `Membership.roleId` with permissions resolved additively;
  3. add a boolean `isOrgAdmin` flag (opaque, not permission-based).
- Decision:
  - `Membership.roleId` is optional. Regular staff keep `roleId = null`.
  - Effective permissions = union of organization-role and property-role permissions.
  - Organization-wide property access is granted only when the organization role includes `property.read`, not by a special-case flag.
  - `Membership (organizationId, roleId)` has a composite FK to `Role (organizationId, id)`.
  - `GET /me` and `GET /properties` reflect the union and list every active property for org-wide roles.
- Consequences:
  - `ORG_ADMIN` can operate across properties; `PROPERTY_MANAGER` is still scoped to its property memberships.
  - Removing `property.read` from an organization role immediately narrows access.
  - There are still no membership/invitation/role administration endpoints.
- Validation required:
  - decide whether custom roles are tenant-editable or platform-managed;
  - define permission-change audit and cache invalidation when roles are administered at runtime.

### ADR-010 — Creating a property also creates the creator's membership

- Status: accepted.
- Date: 2026-11-08.
- Context: without a `PropertyMembership`, a user who creates a property cannot then operate it, producing a dead-end workflow.
- Decision:
  - `POST /properties` requires `organization.properties.manage`.
  - In the same transaction as the property insert, create a `PropertyMembership` for the creator using `context.organizationRoleId ?? context.propertyRoleId`.
  - If no role can be resolved, reject with `403 property_role_required`.
  - Write `property.created` audit in the same transaction; `propertyId` is the authorization scope, `entityId` is the new property.
- Consequences:
  - Property creation is atomic (property + membership + audit).
  - The creator's role is explicit and validated by composite FKs.
- Validation required:
  - decide whether creators can later be removed from a property without losing org-admin access.

### ADR-011 — Manual database objects are verified in CI

- Status: accepted.
- Date: 2026-11-08.
- Context: ADR-005 constraints, append-only triggers and the Phase 2 exclusion constraint cannot be expressed in `schema.prisma`. A future `migrate diff` could drop or replace them silently.
- Decision:
  - `scripts/verify-db-integrity.ts` queries `pg_constraint`, `pg_trigger`, `pg_proc` and `pg_extension` for an explicit expected list.
  - `pnpm db:verify` fails if any expected constraint, trigger, function or `btree_gist` is missing.
  - CI runs it after `db:migrate:deploy` and `db:seed`.
- Consequences:
  - Drift in manual SQL is detected in CI, not in production.
  - The expected list must be updated deliberately when adding/removing manual objects.
- Validation required:
  - evolve into a full schema snapshot/drift comparison if migration volume grows.

### ADR-012 — Inventory separates housekeeping from operational state, with database-enforced block intervals

- Status: accepted.
- Date: 2026-11-08.
- Context: room readiness for cleaning and room availability for sale are different concepts. Double-booking a room as out-of-order would corrupt both.
- Options:
  1. one `status` column (rejected: conflates concerns);
  2. separate housekeeping and operational state (chosen);
  3. model blocks only in the future reservation module (rejected: maintenance must be representable now).
- Decision:
  - `Room.housekeepingState` follows an explicit workflow: `DIRTY → CLEANING → CLEAN → INSPECTED → DIRTY`, with controlled reprocess paths.
  - `Room.operationalState` (`AVAILABLE`, `OUT_OF_ORDER`, `OUT_OF_SERVICE`) is derived from active `RoomBlock` rows and stored for fast reads.
  - `RoomBlock` intervals are `[startsAt, endsAt)` and non-overlapping per room while `ACTIVE`, enforced by a `btree_gist` exclusion constraint.
  - Application mutations lock the `Room` row before validating overlap and then write state + history + audit in one transaction.
  - Expired blocks are reconciled lazily on room reads; there is no background scheduler yet.
  - `RoomStatusHistory` is append-only at application and DB layers.
- Consequences:
  - A failed state write rolls back the block and audit together.
  - Operational state can lag reality until the next room read (bounded by usage, acceptable for the pilot).
  - Reservation conflicts are still an open problem; blocks do not yet interact with reservations.
- Validation required:
  - decide reservation/room-block interaction and whether blocks should also block future bookings;
  - consider a scheduled expiry worker if reads are infrequent.

### ADR-013 — Operational day is computed with `Intl`, not a new date dependency

- Status: accepted.
- Date: 2026-11-08.
- Context: the hotel day does not start at midnight and must respect the property's IANA timezone and DST.
- Options:
  1. fixed UTC offsets (incorrect across DST);
  2. add a date library (extra dependency);
  3. `Intl.DateTimeFormat` with `formatToParts` (chosen).
- Decision:
  - Compute local date/time in the property timezone and subtract one calendar day when local time is before `operationalDayStart`.
  - Reject invalid timezones and malformed `HH:mm`.
- Consequences:
  - No new dependency; behavior depends on the runtime ICU/IANA database.
  - Unit tests cover the rollover boundary, month/year boundary and a non-Brazilian timezone.
- Validation required:
  - confirm the runtime ICU data is updated in deployment images;
  - revisit if sub-minute precision or historical timezone rules become necessary.

## Phase 3 decisions — implemented 2026-11-08 (auth/admin, E2E isolation, scheduler, observability)

### ADR-014 — MFA/TOTP with encrypted secrets and short-lived challenges

- Status: accepted for the transitional local-session phase.
- Date: 2026-11-08.
- Context: the pilot needs stronger authentication than password-only login, without adding a third-party dependency before the final identity provider is chosen.
- Options:
  1. defer MFA until an external IdP (leaves accounts exposed);
  2. SMS MFA (operational cost, SIM-swap risk);
  3. TOTP with an authenticator app (chosen).
- Decision:
  - TOTP uses Node `crypto` HMAC-SHA1 (RFC 6238 defaults: 6 digits, 30s, ±1 step). No new dependency.
  - Shared secrets are encrypted at rest with AES-256-GCM derived from `MFA_ENCRYPTION_KEY`; enrollment/enablement fail with `503 mfa_not_configured` when the key is absent.
  - Login with MFA enabled returns an `mfa_challenge` (signed, short-lived, `MFA_CHALLENGE_TTL_SECONDS`) after password verification; the client completes login with `POST /auth/login/mfa`.
  - Each accepted TOTP step is recorded in `User.mfaLastUsedStep` to reject replay within the accepted window.
  - Disabling MFA requires the current password and a valid TOTP code.
- Consequences:
  - Secrets are not stored in plaintext, but key rotation is manual and not yet implemented.
  - Recovery codes and administrative MFA reset are not implemented.
- Validation required:
  - decide recovery-code workflow and IdP migration path;
  - rotate/backup `MFA_ENCRYPTION_KEY` as a production secret.

### ADR-015 — Password reset and email verification use hashed one-time tokens

- Status: accepted, transitional delivery.
- Date: 2026-11-08.
- Context: accounts need password recovery and verified contact without storing reusable secrets.
- Decision:
  - Reset and verification tokens are 256-bit random values; only SHA-256 digests are stored.
  - Tokens are single-use (`usedAt`), time-limited, and at most one active token per user/type is kept (partial unique indexes + delete-on-issue).
  - `POST /auth/password/forgot` returns the same response shape regardless of whether the email exists to reduce account enumeration.
  - Successful reset sets a new password hash, clears lockout counters, revokes sessions, and marks invited/unverified accounts appropriately.
  - Token delivery is controlled by `AUTH_TOKEN_DELIVERY`: `log`/`response` only outside production; production validation forces `none` until an email provider is integrated.
- Consequences:
  - No email provider is wired yet; production cannot deliver reset/verification links until that integration exists.
  - Admin-created memberships can trigger invitation/reset flows through the same mechanism.
- Validation required:
  - integrate a transactional email provider with signed links, templates, rate limits and bounce handling.

### ADR-016 — Account lockout is authoritative in PostgreSQL

- Status: accepted.
- Date: 2026-11-08.
- Context: repeated credential failures must be throttled beyond best-effort rate limiting.
- Decision:
  - `User.failedLoginAttempts` and `User.lockedUntil` are stored in PostgreSQL.
  - Failed password or MFA attempts increment the counter; reaching `ACCOUNT_LOCKOUT_THRESHOLD` sets a temporary lock for `ACCOUNT_LOCKOUT_MINUTES`.
  - Successful login, password change, or password reset clears the counter and lock.
  - Lockout returns `423 account_locked` with a retry hint; rate limiting still applies per IP+email.
- Consequences:
  - Lockout state survives process restarts and is visible to administrators through security events/future UI.
  - There is no permanent lockout or admin unlock endpoint yet.
- Validation required:
  - add admin unlock/audit workflow and tune thresholds per deployment.

### ADR-017 — Session administration is self-service plus scoped admin revocation

- Status: accepted.
- Date: 2026-11-08.
- Context: users need to see and revoke their own sessions; administrators need to respond to compromised accounts without broad database access.
- Decision:
  - `GET /auth/sessions` lists active sessions for the authenticated user (id, user agent, created/last seen/expires, current flag).
  - `DELETE /auth/sessions/:id` revokes only the caller's own session.
  - `GET/DELETE /admin/memberships/:id/sessions[/:sessionId]` allow organization administrators with `organization.members.manage` to inspect/revoke sessions for users who have a membership in that organization.
  - Session metadata stores a truncated user agent and hashed IP; raw IP is not stored in session rows.
- Consequences:
  - Cross-organization session administration is not possible.
  - Session tokens remain opaque and are never listed.
- Validation required:
  - add device labeling and suspicious-session heuristics when telemetry matures.

### ADR-018 — Membership/role administration prevents privilege escalation

- Status: accepted.
- Date: 2026-11-08.
- Context: organization administrators need to manage memberships and custom roles, but must not grant permissions they do not hold or lock the organization out.
- Decision:
  - New permissions: `organization.members.read/manage`, `organization.roles.read/manage`, `security.events.read`.
  - Administration endpoints require organization context (`X-Organization-Id`) and do not accept property-scoped admin operations through the same path.
  - Creating/updating memberships or roles validates that every granted permission is held by the actor's organization permissions (subset rule).
  - System roles are immutable; custom roles are tenant-scoped.
  - Membership/role updates that would remove the last active administrator capable of `organization.members.manage` are rejected.
  - Security-relevant admin actions write `AuditEvent` and/or append-only `SecurityEvent`.
- Consequences:
  - `ORG_ADMIN` remains the bootstrap administrator; fine-grained delegation is possible but constrained.
  - Role administration is API-only; no UI yet.
- Validation required:
  - add approval workflows for sensitive permission changes in larger organizations.

### ADR-019 — Room-block expiry uses an in-process scheduler with PostgreSQL advisory lock

- Status: accepted.
- Date: 2026-11-08.
- Context: expired `RoomBlock` rows should not remain `ACTIVE` until the next room read, but correctness must not depend on Redis or a best-effort timer.
- Decision:
  - `RoomBlockExpiryScheduler` discovers properties with expired active blocks and calls `RoomStateService.reconcileProperty`, which already performs transactional, row-locked reconciliation and writes audit/history.
  - A PostgreSQL advisory lock (`pg_try_advisory_lock`) prevents concurrent scheduler instances from duplicating work.
  - The scheduler is disabled automatically in Jest; tests call `runOnce()` deterministically.
  - Lazy reconciliation on reads remains in place as a fallback.
- Consequences:
  - Expiry latency is bounded by `ROOM_BLOCK_EXPIRY_INTERVAL_SECONDS` when the scheduler runs.
  - Multi-process deployments coordinate through PostgreSQL, not Redis.
- Validation required:
  - add operational metrics/alerts for scheduler lag and repeated failures.

### ADR-020 — Isolated E2E runs use per-run PostgreSQL schemas

- Status: accepted.
- Date: 2026-11-08.
- Context: E2E suites shared the local seeded `public` schema, making failures order-dependent and unsafe for parallel/local experimentation.
- Decision:
  - `scripts/run-e2e-isolated.ts` creates a unique schema, sets `DATABASE_URL?...schema=<run>`, runs `prisma migrate deploy` and `prisma db seed`, executes the requested Jest command, then drops the schema in `finally`.
  - Setup env files preserve a pre-set `DATABASE_URL`, so the orchestrator controls isolation.
  - Root scripts expose `test:e2e:isolated`, `test:e2e:auth:isolated`, and `test:e2e:all:isolated`; CI uses the isolated aggregate.
- Consequences:
  - E2E runs are slower because they migrate/seed per schema, but results are reproducible.
  - The orchestrator requires PostgreSQL privileges to create/drop schemas.
- Validation required:
  - observe remote GitHub Actions runtime and cache behavior.

### ADR-021 — Backups and observability are local/operator-focused baselines

- Status: accepted as a baseline; not production operations completeness.
- Date: 2026-11-08.
- Context: the codebase had no backup drill, structured request logs, or metrics surface.
- Decision:
  - `scripts/backup-db.sh` creates logical `pg_dump -Fc` backups through Docker with local-target safeguards.
  - `scripts/restore-drill.sh` requires explicit confirmation, restores into a temporary database, runs integrity checks, and drops the temp database.
  - Request logging is structured JSON with low-cardinality fields (method, path without query, status, duration, correlation/user/tenant ids). Bodies, query strings, cookies and tokens are excluded.
  - `/metrics` exposes Prometheus-compatible text with bounded in-process counters/histograms; it can be protected by `METRICS_TOKEN`.
  - `/health/live` and `/health/ready` remain; readiness still treats PostgreSQL+Redis as dependencies.
- Consequences:
  - Metrics are per-process and not aggregated across replicas.
  - WAF/perimeter controls, external security review, and hosted backup/restore automation remain out of scope.
- Validation required:
  - run restore drills against approved staging snapshots and integrate logs/metrics with the chosen platform.

## Phase 3 decisions — guests and reservations (implemented 2026-11-08)

### ADR-022 — Reservations use hotel calendar dates and a PostgreSQL exclusion constraint

- Status: accepted for the transitional phase.
- Date: 2026-11-08.
- Context: confirmed reservations must never allow two stays to occupy the same room on the same night, including under concurrent requests. Check-in/out hour handling does not exist yet.
- Options:
  1. instants for stays now (implies check-in/out times and timezone conversion before Front Office);
  2. hotel calendar dates (`date`) with a `daterange` exclusion constraint (chosen);
  3. application-only validation (rejected: not a guarantee).
- Decision:
  - `checkInDate`/`checkOutDate` are PostgreSQL `date` values in the property timezone; the stay occupies `[checkInDate, checkOutDate)`.
  - Active inventory statuses are `CONFIRMED` and `CHECKED_IN`; cancelled/checked-out/no-show stays free the interval.
  - `Reservation_room_date_no_overlap` (`EXCLUDE USING gist` on `roomId` + `daterange`) is the final authority. The application additionally locks the `Room` row and validates before writing, returning `409 room_not_available` deterministically.
  - `RoomBlock` remains instant-based; reservation↔block comparison uses the UTC ends of the reservation dates, so a block covering a night is detected at date granularity.
  - One room assignment per reservation in this phase; unassigned reservations are allowed.
- Consequences:
  - Room type changes require unassigning the room first (`409 room_type_change_requires_unassigned_room`).
  - Overbooking is not representable.
  - A reservation can start today or later, never in the past.
  - Instant-precision block conflicts near midnight need refinement when check-in/out times arrive.
- Validation required:
  - confirm with the pilot whether day-use/early check-in/late checkout need sub-day intervals;
  - decide overbooking policy and whether it must be modeled explicitly;
  - extend the exclusion predicate deliberately if new occupying statuses are added.

### ADR-023 — Reservation creation is idempotent per property

- Status: accepted.
- Date: 2026-11-08.
- Context: reception clients may retry creation after a timeout; duplicates must not become two stays.
- Options:
  1. no idempotency, rely on unique codes (rejected: client-generated retries duplicate real stays);
  2. generic idempotency record table for every endpoint (over-engineering now);
  3. optional `idempotencyKey` column unique per property (chosen).
- Decision:
  - `POST /reservations` accepts an optional `idempotencyKey` (8–64 chars), unique per `propertyId`.
  - Repeating the same key with the same stay payload returns the original reservation; a different payload returns `409 idempotency_key_reuse`.
  - The unique constraint, reservation row, history row and audit row are written in one transaction.
- Consequences:
  - Only reservation creation is idempotent; other writes still rely on constraints/state checks.
  - Keys are scoped per property, never global.
- Validation required:
  - extend to imports, payments and night audit with a normalized idempotency record when those exist.

### ADR-024 — Guest data is minimized, property-scoped and never hard-deleted

- Status: accepted.
- Date: 2026-11-08.
- Context: guest PII is the most sensitive data introduced so far, and Phase 3 does not yet need addresses, birth dates or document images.
- Decision:
  - Only `fullName`, optional `email`, `phone`, `documentType`/`documentNumber` and `notes` are stored.
  - Document type and number must be provided together; documents are optional.
  - Guests are property-scoped with composite tenant foreign keys.
  - No physical delete; lifecycle is `status = ACTIVE | DISABLED`.
  - Guest audit events never copy contact/document data; search never merges profiles automatically.
- Consequences:
  - Operational deduplication is manual and duplicates are possible by design.
  - Email is not unique; the same person may exist in multiple properties.
- Validation required:
  - define retention/anonymization and purpose of identity documents with the pilot and legal review; then implement erasure/anonymization and access auditing for sensitive fields.

### ADR-025 — The Phase 1–3 web UI is client-side with server-validated tenant selectors

- Status: accepted for the transitional web app.
- Date: 2026-11-08.
- Context: phases 1–3 had a complete API but only a health landing page; operators need a usable interface without changing the backend contracts or duplicating authorization rules.
- Options:
  1. server-rendered pages with a second backend-for-frontend (adds a session/tenant layer and deployment surface before Phase 4);
  2. client-side Next.js App Router pages calling the API directly with the session cookie/dev header and explicit tenant headers (chosen);
  3. keep an API-only product until Front Office (rejected: inventory and reservations are already operable).
- Decision:
  - `apps/web` owns presentation, navigation and tenant selection only; every list, mutation and permission decision stays in the API.
  - The session cookie is sent with `credentials: include`; local-session writes fetch a CSRF token once and send `X-CSRF-Token`.
  - `X-Organization-Id`/`X-Property-Id` are selectors, never authority; the UI revalidates them through `/organizations` and `/properties` after login/reload.
  - A public `GET /auth/mode` tells the login screen which flow to render, avoiding credential probing.
  - Shared response types mirror API contracts without sharing Prisma types; no business rule (capacity, overlap, transitions, permissions) is reimplemented in the UI.
  - Failed API calls surface the backend message; a `401` drops the UI session and redirects to `/login`.
  - Admin screens intentionally omit `X-Property-Id` because admin endpoints require organization context.
- Consequences:
  - The UI is a static export-friendly SPA shell; it must be deployed alongside the API and is subject to CORS/session-cookie configuration.
  - No offline mode or optimistic mutations yet; the calendar and room rack were added in Phase 4 inside this same client-side model.
- Validation required:
  - validate keyboard/screen-reader flows and mobile breakpoints with the pilot;
  - revisit server components/BFF if SEO or server-side authorization rendering becomes a requirement.

## Phase 4 decisions — Front Office (implemented 2026-11-08)

### ADR-026 — Occupancy is a single Stay per reservation, derived from IN_HOUSE status

- Status: accepted for the pilot phase.
- Date: 2026-11-08.
- Context: reservations are calendar-date based and Phase 4 needs operational check-in/out without mixing occupancy with housekeeping. A reservation may have at most one active stay.
- Options:
  1. store occupancy directly on `Room` (rejected: couples operational state and creates a second source of truth);
  2. derive occupancy from `Stay.status = IN_HOUSE` with one stay per reservation (chosen);
  3. reuse `ReservationStatus` as the only occupancy source (rejected: loses check-in/out instants, actor and room-move history).
- Decision:
  - `Stay` is unique per `reservationId`, carries guest/room snapshot references, check-in/out instants and actors, checkout notes and `moveCount`.
  - `IN_HOUSE` means the room is occupied; `CHECKED_OUT` frees it. Housekeeping remains a separate dimension.
  - Check-in requires the reservation room to be assigned, active, operationally available, unblocked and without another in-house stay.
  - Check-out updates the stay and reservation atomically; no housekeeping transition is implied.
- Consequences:
  - One room and one stay per reservation; multi-room stays need a future reservation model change.
  - Occupancy and housekeeping can disagree operationally (e.g. occupied but dirty), which is intentional.
- Validation required:
  - confirm with the pilot whether early check-in, late checkout or day-use need sub-day stay intervals;
  - define the housekeeping trigger after checkout (manual vs automatic) before automating it.

### ADR-027 — Check-in/out are idempotent state transitions keyed by local calendar date

- Status: accepted.
- Date: 2026-11-08.
- Context: reception clients retry after timeouts, and an early-morning arrival still belongs to its arrival calendar date even when the operational day has not rolled over.
- Options:
  1. use the operational day for the check-in window (rejected: before the cut-off, a valid arrival appears “too early”);
  2. use the property local calendar date for the window and persisted reservation dates for eligibility (chosen);
  3. allow check-in at any time (rejected: permits checking in past/future stays).
- Decision:
  - Check-in is allowed when `localDate >= checkInDate` and `localDate < checkOutDate`; the operational day still drives lists and the room rack.
  - Repeating check-in for a `CHECKED_IN` reservation returns the existing stay; repeating check-out for a `CHECKED_OUT` stay returns it unchanged.
  - No-show is allowed only when `localDate > checkInDate` and no stay exists.
  - All transitions run in a transaction with row locks; `Stay.reservationId` uniqueness is the final guard against double check-in.
- Consequences:
  - Check-in/out have no time-of-day policy yet; the pilot must define earliest/latest times.
  - A no-show cannot be recorded on the arrival date itself.
- Validation required:
  - pilot policy for no-show timing and late arrivals;
  - whether a reservation may be checked in after its checkout date with an exception flow.

### ADR-028 — Incidents are scoped operational records, not reservation edits

- Status: accepted.
- Date: 2026-11-08.
- Context: reception and housekeeping need to record notes, maintenance, complaints and safety issues without mutating the reservation or overloading free-text notes.
- Options:
  1. store everything in `Reservation.notes` (rejected: no lifecycle, severity or resolution);
  2. add a generic task/comment table shared by all modules (premature);
  3. dedicated `Incident` with optional room/reservation/stay scope (chosen).
- Decision:
  - `Incident` has type, severity, status, title, description, optional scope and resolution metadata.
  - Linking a stay derives its room and reservation; contradictory scope returns `409 incident_scope_mismatch`.
  - Permissions are split: `incidents.read` and `incidents.manage`.
  - Creation and resolution append `AuditEvent`; resolution is idempotent.
  - No physical delete; open/resolved is the lifecycle in this phase.
- Consequences:
  - Incidents are operational records, not a full ticketing system (no assignment, SLA, attachments or comments).
  - Any incident scope is property-scoped; cross-property references are rejected by composite FKs.
- Validation required:
  - pilot workflow for assignment/escalation and whether incidents should block room availability;
  - retention policy for operational notes.

### ADR-029 — Front Office UI keeps authorization in the API

- Status: accepted for the transitional web app.
- Date: 2026-11-08.
- Context: the Phase 4 UI needs check-in/out, room moves and incident actions, but the session payload does not expose atomic permissions.
- Options:
  1. duplicate the role/permission matrix in the browser (rejected: drift and false authority);
  2. expose permissions in `/me` and hide actions (deferred until the session contract is extended);
  3. render the actions and let the API authorize each mutation (chosen for this phase).
- Decision:
  - The UI renders operational actions for all users with property access; the API enforces `front_office.manage`/`incidents.manage` and returns `403 permission_denied`.
  - Failed actions surface the backend message; no optimistic state is persisted.
  - Reloading the overview keeps the current tab mounted once data exists; initial load still shows a spinner.
- Consequences:
  - Read-only roles see buttons that fail with a permission error instead of being hidden.
  - A future `/me` capabilities contract can hide actions without moving authorization to the client.
- Validation required:
  - usability test with housekeeping/auditor roles;
  - decide whether to add capability flags to the session response.

### ADR-030 — Sky & Mint design system is implemented as a centralized Chakra theme

- Status: accepted for the transitional web app.
- Date: 2026-11-08.
- Context: the Phase 1–4 UI used ad-hoc purple/gray styling. `docs/DESIGN_SYSTEM.md` defines Sky & Mint as the visual source of truth, with navy navigation, sky primary actions and mint status accents.
- Options:
  1. restyle screens individually (rejected: token drift and inconsistent states);
  2. keep the prototype palette (rejected: contradicts the approved design direction);
  3. centralize tokens and component defaults in a Chakra theme, then apply them to the shell and screens (chosen).
- Decision:
  - `apps/web/src/theme` owns colors, typography, radii, shadows, focus rings and Chakra component defaults. Components do not use raw hex values.
  - The application shell uses the navy sidebar (`sidebar`/`sidebarHover`), sky active indicators, property/organization selectors and a responsive drawer.
  - Status colors map to `mint` (positive), `warning` (attention), `danger` (error/critical) and `sky` (informational), always paired with text labels.
  - The Dashboard uses real `/front-office/overview` data for occupancy, arrivals, departures, ready rooms, arrivals list and operational alerts. It does not invent KPIs or trends; unavailable data renders loading, empty or error states.
  - Quick actions only link to implemented flows. Cashier remains omitted until its module exists.
  - Connectivity shows real browser online/offline state. Syncing/degraded states are deferred until the API exposes a global synchronization channel.
- Consequences:
  - Existing screens inherit the palette through shared components and token replacements; future screens must reuse the same theme.
  - Deep links `?tab=arrivals|rack|incidents` and `?new=1` open the relevant Front Office/Reservations flows.
  - Occupancy trends and Cashier remain documented gaps, not mock UI.

### ADR-031 — Money is stored as DECIMAL(10,2) with an explicit currency and exchanged as decimal strings

- Status: accepted for Phase 5.
- Date: 2026-11-09.
- Context: `AGENTS.md` forbids binary floating point for persisted amounts and requires an explicit currency. Phase 5 introduces charges, payments, cash movements and cash reconciliation, where rounding errors become financial discrepancies.
- Options:
  1. store integer minor units (rejected: every adapter and report would convert, and the pilot may need currencies with different exponents);
  2. store `float`/`number` (rejected: violates the financial invariant);
  3. store PostgreSQL `DECIMAL(10,2)` through `Prisma.Decimal` and transport amounts as validated decimal strings (chosen).
- Decision:
  - `FolioLine.amount`, `Payment.amount`, `CashMovement.amount` and the cash session amounts are `DECIMAL(10,2)`; every financial row carries `currencyCode` constrained to `^[A-Z]{3}$`.
  - Input accepts only `MONEY_PATTERN` strings (up to two decimals) parsed by `parseMoney`; over-precision or out-of-range input is a validation error, never silent rounding.
  - Arithmetic uses `Prisma.Decimal` inside the API; responses format with exactly two decimals. Amounts are compared with `equals`/`greaterThan`, never `===`.
  - Charges and payments inherit the folio currency; cash movements inherit the cash session currency. A conflicting payload currency returns `400 currency_mismatch`; Phase 5 does not convert currencies.
- Consequences:
  - Billing integrations must send decimal strings plus a currency; multi-currency settlement and FX are out of scope.
  - Changing precision later requires a migration and a documented rounding policy.

### ADR-032 — Folio is a header with posted lines; settlement is transactional and history preserving

- Status: accepted for Phase 5.
- Date: 2026-11-09.
- Context: a folio must accumulate charges while a guest is in house, accept partial payments, keep voids auditable and prevent double billing.
- Decision:
  - `Folio` is the header (`OPEN`, `SETTLED`, `CANCELLED`); `FolioLine` holds posted charges and is never deleted. A void sets `status = VOID`, `voidedAt` and `voidReason` (`FolioLine_void_check`), keeping the original amount visible.
  - A folio must link to a stay or a reservation (`Folio_link_check`) in the same organization and property; composite tenant FKs reject cross-tenant links.
  - Partial unique indexes allow at most one non-cancelled folio per reservation and per stay, so a cancelled folio remains history.
  - Mutations lock the `Folio` row with `SELECT ... FOR UPDATE`, recompute charges and completed payments inside the transaction and reject overpayment (`409 payment_exceeds_balance`) and voids that would leave payments above charges (`409 void_would_underfund_payments`).
  - Reaching a zero balance records the final payment, sets `SETTLED` and `closedAt` in the same transaction; cancellation is refused while payments exist.
  - Every mutation writes an `AuditEvent` in the same transaction and accepts an `idempotencyKey` unique per property; replaying a key with a different payload returns `409 idempotency_key_reuse`.
- Consequences:
  - Corrections are void + new charge, never edits; reporting must sum `POSTED` lines and `COMPLETED` payments.
  - Folios are not invoices and carry no fiscal numbering (`OPEN QUESTION` with the pilot).

### ADR-033 — Cash sessions and the operational close are property-scoped, idempotent and explicit about variance

- Status: accepted for Phase 5.
- Date: 2026-11-09.
- Context: reception needs one cash drawer per property and a night audit that cannot silently duplicate or skip financial state.
- Decision:
  - A property has at most one `OPEN` cash session (`CashSession_one_open_per_property_key` partial unique index); the service checks first and maps the unique violation to `409 cash_session_already_open`.
  - A session captures the property currency and the operational date at open. Opening for a future operational day is rejected (`409 cash_session_future_date`).
  - Movement types map to signed deltas (`CASH_IN`/`ADJUSTMENT` positive, `CASH_OUT`/`REFUND` negative); expected cash is `openingAmount + movements` and is stored at close.
  - Closing requires the counted amount; a non-zero difference requires a variance reason (`400 cash_variance_reason_required`) and is audited. Replaying the same closing amount returns the session; a different amount returns `409 cash_session_already_closed`.
  - The operational close stores a JSON snapshot per operational date, is unique per property and date, replays by idempotency key and refuses to close while blockers exist unless `force` plus a reason is provided. Reopen requires a reason, records the actor and allows a later re-close.
  - Operational dates come from property `timezone` + `operationalDayStart`, never from server midnight.
- Consequences:
  - Night audit is triggered by an authorized user, not by a scheduler yet; a missed close is visible as an open operational day.
  - Adjusting a closed day means reopen + re-close; separate adjusting entries are future scope.

### ADR-034 — Pilot feedback is property-scoped operational input, not an operational record

- Status: accepted for Phase 6.
- Date: 2026-11-09.
- Context: the pilot needs a traceable feedback channel that is tenant-safe and cannot become an editable note attached to folios, stays or reservations.
- Decision:
  - `PilotFeedback` stores category, message, optional rating and optional JSON context for one organization/property and one author.
  - Messages are immutable through the API; review only sets `status = REVIEWED`, `reviewedAt` and `reviewedByUserId`.
  - Submission and review each write an `AuditEvent`; context is capped at 4 KB and the UI sends only the route and app version.
  - Permissions are separate: `pilot.feedback.submit`, `pilot.feedback.read` and `pilot.feedback.manage`.
- Consequences:
  - Feedback cannot mutate operational or financial state by design.
  - Editing, deletion and retention must be defined with the pilot (LGPD).

### ADR-035 — The demo sandbox isolates by PostgreSQL schema

- Status: accepted for Phase 6 (first version).
- Date: 2026-11-09.
- Context: pilots need a resettable demo with synthetic data and zero risk to the working dataset, without adding infrastructure.
- Options:
  1. reuse the development schema (rejected: demos would mutate working data);
  2. provision a second database or cluster (deferred: more operational cost than needed for the first version);
  3. create a dedicated `demo_sandbox` schema with the same migrations and seed (chosen).
- Decision:
  - `pnpm demo:sandbox` requires `CONFIRM_DEMO_SANDBOX=1` and a local `DATABASE_URL`, creates the schema if missing, runs `prisma migrate deploy` and the synthetic seed against it, and prints the sandbox URL and demo users.
  - Re-running is idempotent; the working `public` schema is never touched.
  - The sandbox is explicitly a local/demo facility, not a production hosting strategy.
- Consequences:
  - The sandbox shares the PostgreSQL instance and its resource limits.
  - A dedicated database or cluster remains future work if pilots need stronger isolation.

### ADR-036 — Guest CSV imports are previewed, then committed all-or-nothing with an idempotency key

- Status: accepted for Phase 7.
- Date: 2026-11-09.
- Context: onboarding needs bulk guest loading without partial imports, duplicate retries or new PII retention surfaces.
- Options:
  1. create valid rows and report failures (rejected: partial state is hard to reconcile);
  2. import each row independently (rejected: no clear confirmation boundary);
  3. preview the whole file, reject it if any row is invalid, then commit atomically with an idempotency key (chosen).
- Decision:
  - Parsing and validation happen server-side on preview and again on commit; the preview is never trusted.
  - CSV limits: 512 KB, 500 data rows, comma or semicolon delimiter, quoted fields supported.
  - `GuestImport` stores only the property, idempotency key, row/created counts and actor; CSV content and guest PII are never stored in it or in audit metadata.
  - `(propertyId, idempotencyKey)` is unique; a replay with the same row count returns the original result, and reuse with different content returns `409 idempotency_key_reused`.
- Consequences:
  - Retries are safe and no partial import is possible.
  - Larger files need chunking or XLSX support in a later slice.
  - Duplicate guests across different files remain a human dedupe decision.

### ADR-037 — Offline mode blocks writes instead of queueing them

- Status: accepted for Phase 7 (first slice).
- Date: 2026-11-09.
- Context: a buggy or optimistic offline flow could show financial or stay operations as committed when the server never received them.
- Options:
  1. optimistic UI plus an outbox with per-domain reconciliation (deferred: requires conflict rules for folios, cash, stays and reservations);
  2. queue only non-financial notes (deferred: still needs conflict handling);
  3. cache the shell, show connection state and reject mutations while offline (chosen).
- Decision:
  - The service worker caches only the offline page and static assets; it never caches `/api` responses.
  - The shared API client throws `offline` for non-GET requests when `navigator.onLine` is false, before any request is sent.
  - Idempotency keys remain the mechanism for safe retries once connectivity returns.
- Consequences:
  - Reception cannot operate offline; the UI states this explicitly.
  - A future outbox must define per-operation conflict and reconciliation rules before it is introduced.
  - Local read caching and offline notes remain future work.

### ADR-038 — CSV exports are read-only, capped and audited

- Status: accepted as Phase 8 groundwork.
- Date: 2026-11-09.
- Context: the pilot and future integrations need portable operational data without exposing another tenant or unbounded dumps.
- Decision:
  - Exports are GET endpoints scoped by the authenticated organization/property, reusing list filters and read permissions.
  - Maximum 5000 rows; larger requests fail with `export_too_large` instead of truncating silently.
  - CSV is UTF-8 with BOM, RFC 4180 quoting and formula-injection neutralization for text cells.
  - Every export writes an `AuditEvent` with row counts only; no guest PII is copied to audit.
  - Responses set `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`.
- Consequences:
  - Exports are not a bulk data pipeline; scheduled/streaming exports remain future work.
  - Instant-based date filters use the property's IANA timezone (folio `date`, audit `fromDate`/`toDate`); reservation exports keep calendar-date overlap semantics. The upper day is inclusive where documented.

### ADR-039 — Version diagnostics are groundwork, not an Edge commitment

- Status: accepted as Phase 8 groundwork.
- Date: 2026-11-09.
- Context: support and any future local installation need to identify build and schema versions before Edge topology or provider contracts are validated.
- Decision:
  - `GET /health/version` exposes app version, optional commit, environment, Node version, uptime, server timezone and latest applied migration.
  - It never exposes connection strings, secrets, row data or raw database errors; if the database is down it still answers with `database.reachable = false`.
  - This does not introduce a coordinator, sync protocol, agent or provider adapter.
- Consequences:
  - The endpoint is public like the other health routes; it must stay non-sensitive as it evolves.
  - Edge architecture, update and reconciliation decisions remain pending hotel/hardware/provider discovery.

### ADR-040 — Day.js for instants and Zustand for client workflow state

- Status: accepted.
- Date: 2026-11-09.
- Context: upcoming reports by range, operational closures, calendar views and date-aware imports justify a date library; the audit feed and import wizard also need state that survives route navigation without turning server data into a second source of truth.
- Decision:
  - Use Day.js 1.11 with `utc` and `timezone` plugins in the API for instant/day-boundary calculations, centralized in `common/time/property-day.ts`. Calendar dates that are date-only values remain date-only.
  - Use Zustand 5 for client workflow state only. The first stores are the audit feed and the import draft; both are tenant-keyed and in-memory.
  - Stores never hold tokens, permissions or authorization decisions. Tenant selection is passed to actions and the backend remains the authority.
  - UI hides or clears stored data when `tenantKey` does not match the selected property; async loads use request ids to discard stale responses.
  - Server data remains API-driven. If caching/invalidation needs grow, adopt a server-state library rather than expanding Zustand into a cache.
- Consequences:
  - Two new runtime dependencies: `dayjs` in the API and `zustand` in the web app.
  - Day.js timezone behavior still depends on the platform IANA database; the existing DST and timezone tests stay mandatory.
  - Reservation drafts, report ranges and calendar views can add stores later using the same tenant-key pattern.
  - Reloading the browser clears all stores; no offline or cross-session persistence is promised yet.

### ADR-041 — Availability reads accept past calendar windows

- Status: accepted.
- Date: 2026-11-11.
- Context: reservation dates are property calendar dates, but the reservation-creation guard compares them against the server's UTC date. A reservation that starts on "today" in the property timezone can therefore be one day in the past for that guard. The reservation drawer needs availability for the reservation's original window to assign a room, and it failed with `reservation_in_past` for those arrivals.
- Decision:
  - `GET /reservations/availability` is read-only and accepts windows that start before today; `POST /reservations` and `PATCH /reservations/:id` keep rejecting them.
  - No integrity rule is relaxed: assignment still relies on PostgreSQL exclusion constraints, and check-in still validates the property's local date, room state and in-house occupancy.
  - The underlying UTC-vs-property-timezone comparison for creation remains an open technical debt item, not a reason to weaken mutation guards.
- Consequences:
  - Past windows can be queried for availability, which is harmless and useful for late/overdue arrivals.
  - A property-timezone-aware creation guard is still required before relying on this behavior in production; tracked as follow-up.

### ADR-042 — Front Office distinguishes current work from historical days

- Status: accepted.
- Date: 2026-11-12.
- Context: `GET /front-office/overview?date=` accepted a calendar date, but always returned current pending work: confirmed arrivals up to the date, in-house stays and in-house departures due by the date. That is useful for today, but wrong for a past day: completed stays and check-outs disappeared, so a historical consultation could not answer who arrived, stayed or left that day.
- Decision:
  - The current operational day keeps its pending-work semantics: arrivals still waiting for check-in, current in-house stays and departures due.
  - A date earlier than the operational day returns event semantics: arrivals whose `checkInDate` is that day (all non-cancelled final states), stays active at any point during that day, check-outs whose `checkedOutAt` falls inside the property-local day, and no-shows whose `checkInDate` is that day.
  - Instant-based historical bounds use the property IANA timezone through `propertyDayStart`, never UTC midnight; calendar-date fields remain date-only.
  - `selectedDate` and `isHistorical` are additive response fields. The API contract, tenant scoping and mutations are unchanged.
  - The web view hides Room rack and Incidencias for historical dates because both expose current state, and hides operational actions (check-in, check-out, room move, no-show and incidents). Historical consultation is read-only.
- Consequences:
  - Historical in-house records show the stay's last assigned room; reconstructing the room occupied on that specific day would require consuming the room-move history and remains future work.
  - A historical day is not an occupancy report: it is an operational reconstruction with the same permissions and row caps as the current overview.

### ADR-043 — Documents v1 uses a fixed renderer, PDFKit and private database bytes

- Status: accepted for Documents v1.
- Date: 2026-11-13.
- Context: the v2 specification requires server-side A4 PDFs, immutable snapshots and private access. The repository has no object-storage service, no PDF engine and no trusted HTML sanitizer. Adding a browser/Chromium renderer would add an operationally heavy dependency and a larger attack surface.
- Decision:
  - Add `pdfkit` as the server-side PDF renderer. It uses built-in Helvetica fonts, needs no browser, external font file or network service, and runs inside the existing NestJS process.
  - Templates are versioned, property-scoped rows with a title and plain-text body. A fixed renderer owns the layout and supports only `GUEST_REGISTRATION`, `LODGING_TERMS` and `CHECKIN_SUMMARY`; no template can inject arbitrary HTML or scripts.
  - Every generated document stores an immutable JSON snapshot, template version, SHA-256, page count and PDF bytes. The bytes are stored in PostgreSQL (`GeneratedDocument.content`) for v1 because no object-storage provider exists.
  - Generated documents, templates and print events use composite organization/property foreign keys in PostgreSQL, so a valid property-scoped document cannot point at a guest, reservation, stay or folio from another tenant. A trigger rejects changes to the emitted snapshot, PDF bytes, hash, template version and document number; workflow fields such as signature receipt remain updateable.
  - Downloads are authenticated, tenant-scoped and streamed with `Cache-Control: private, no-store`; there is no public or presigned URL. This is stricter than a temporary public URL but is not object storage.
  - Printing is recorded as an append-only event (`PRINT_DIALOG_OPENED`, `PRINT_CONFIRMED_BY_STAFF`, `REPRINT_REQUESTED`) and never as proof of physical printer success. A PostgreSQL trigger rejects update/delete on print events. Physical signature receipt is a separate staff action with server-derived actor identity; this is not electronic signature.
  - API routes follow the repository's existing tenant-header convention instead of duplicating `:propertyId` in every path.
- Consequences:
  - PDF bytes increase database size and backup volume; retention/archival and object storage remain future work. A migration can move `content` to object storage while keeping the hash, snapshot and metadata.
  - Only Portuguese (`pt-BR`) templates are seeded in v1. New properties need published templates before documents can be emitted from them.
  - PDFKit does not provide digital signatures, PDF/A validation or certified copies; those require a separate decision.
  - The UI hides the generation action until a server preview exists, but the backend remains the authorization and validation authority.

### ADR-044 — Reports v1 is a synchronous, fixed catalog with audit-backed execution history

- Status: accepted for Reports v1.
- Date: 2026-11-13.
- Context: the v2 package requires five operational/financial reports with filters, pagination, PDF/CSV and totals. The repository has no job queue, object storage or BI layer. Letting the client define columns, SQL or arbitrary report definitions would bypass tenant scoping and make results unauditable.
- Decision:
  - Reports are a code-defined catalog: `occupancy`, `arrivals`, `departures`, `reservations` and `cash-daily`. Each key owns a fixed Prisma query and a fixed column set. The client only sends a calendar period, page and page size; no SQL, table names or column names are accepted.
  - Execution is synchronous and bounded to 62 calendar days and 5000 source rows. The API returns `report_execution_limit_exceeded` instead of silently truncating. There is no background job or scheduled report in v1.
  - Permission is split into `reports.read` (catalog, operational reports, PDF/CSV) and `reports.financial` (cash report and its export). Property scope is resolved by the existing tenant guard and every query filters `organizationId` and `propertyId`.
  - Occupancy is measured at the end of each property-local day. Active rooms minus rooms with a vigent `OUT_OF_ORDER`/`OUT_OF_SERVICE` block are sellable. A stay counts when it has checked in before the day ends and has not checked out before the day ends; therefore a checkout during the day does not create a room-night. Current active inventory is used as the denominator, and overbooking/internal use are not modeled. This formula is an explicit pilot-validation question.
  - Arrivals/departures use reservation calendar dates and separate expected from completed. Cancelled reservations are not “expected”; no-shows remain visible. The reservations report is a creation-period report whose status column reflects the current status at generation time, not a historical status snapshot.
  - Cash daily uses the operational date and existing `CashMovement` ledger. `CASH_IN`/`ADJUSTMENT` add; `CASH_OUT`/`REFUND` subtract. `CashSession.expectedCashAmount` is preferred when present. Closing variance is shown only for closed sessions. Completed payments grouped by method are displayed separately and never treated as cash.
  - PDF is rendered server-side with PDFKit in A4 landscape and includes property, period, timezone, generation instant, filters, summary, table and page numbers. CSV includes metadata, summary and table, uses UTF-8 BOM and the existing formula-injection guard. Both exports are generated on demand and streamed with `Cache-Control: private, no-store`.
  - Each run/export gets a server `executionId` and an append-only `AuditEvent` (`report.executed`/`report.exported`) with report key, dates, format and row counts. Report contents, PII and generated files are not copied into audit metadata. The history endpoint reads those audit events; v1 does not add a separate report-execution table or retain downloadable artifacts.
- Consequences:
  - A report cannot be re-downloaded from history because artifacts are not stored; the operator must run it again. Persistent history and scheduled jobs are future work.
  - The 62-day/5000-row caps keep the request bounded but may reject broad ad-hoc analysis. XLSX, charts and multi-property consolidation remain out of scope.
  - The occupancy formula must be reconciled with the pilot hotel before it is treated as a commercial KPI; especially checkout-day treatment, overbooking, internal use and inactive-room history.
  - Financial exports remain dependent on `reports.financial`; hiding the option in the UI is not an authorization decision.

### ADR-045 — FNRH Digital remains a discovery/integration boundary, not an invented API client

- Status: accepted (official manual confirmed; integration still deferred).
- Date: 2026-11-13.
- Context: Portaria MTur 41/2025 establishes the FNRH Digital and anticipates PMS/API integration, credentials per establishment and an audit trail. On 2026-11-13 the official MTur page was consulted again: it lists API 2.4.2 and links the manual (`Versão 2.4` of 19/06/2026), the 2.4.2 changelog (03/08/2026), key-generation steps and homologation instructions. The manual confirms REST v2, Basic authentication, the main reservation/guest/person endpoints, date formats and the two base URLs, but it conflicts with its own examples on the base URL and with the Portaria on the credential format; pagination examples also disagree. No official idempotency or rate-limit contract was found in the manual, changelog or public Swagger reviewed.
- Decision:
  - Do not implement external FNRH calls, credentials, payloads, retries or fiscal assertions until the acceptance gate in `docs/v2/docs/FNRH_INTEGRATION_PLAN.md` is approved. Do not treat the internal operations in `docs/v2/src-starters/fnrh-adapter.interface.ts` as an official contract.
  - Record the official baseline, contradictions, data mapping, adapter design, homologation phases and acceptance gates in `docs/v2/docs/FNRH_INTEGRATION_PLAN.md`; keep `docs/v2/docs/FNRH_DISCOVERY.md` as the short status document.
  - Isolate the integration behind an internal provider port, use encrypted secret references (never raw tokens in the frontend, repository or logs), separate homologation from production, and use a local operation ledger with status reconciliation instead of an invented idempotency header.
  - The existing internal PDF/document package is not declared a legal FNRH contingency. That claim requires legal/operational validation and the full current regulation text.
- Consequences:
  - The product has no FNRH integration yet; the plan is the source of truth for what remains unverified.
  - No external credentials or sandbox accounts are required to build or test NOVA today.
  - Integration cannot be estimated responsibly until homologation access, the base URL/credential format and the guest/minor data model are confirmed.

### ADR-046 — FNRH integration uses an isolated adapter and a durable operation ledger

- Status: accepted for design; HTTP client blocked on homologation.
- Date: 2026-11-13.
- Context: FNRH requires per-establishment credentials, sends personal data (including documents and possibly a requester CPF) and does not publish a confirmed idempotency contract. Calling it directly from reservation, guest or Front Office code would duplicate retries, leak credentials and make ambiguous failures unreconcilable.
- Decision:
  - Put the integration in `apps/api/src/integrations/fnrh`, with a NestJS module, an internal `FnrhProvider` port, one HTTP provider, a mapper, an application service, a repository and typed errors. No controller or web component calls FNRH directly.
  - Persist `FnrhIntegrationConfig` per property/environment, `FnrhOperation` as an append-only state ledger, and external IDs for reservations and guests. The credential is a secret reference, never a database value.
  - Every operation has a stable local key and one of `PENDING`, `SENDING`, `CONFIRMED`, `FAILED_RETRYABLE`, `FAILED_TERMINAL` or `UNKNOWN`. Ambiguous POSTs become `UNKNOWN` and are reconciled by querying the reservation code or guest document; they are not retried blindly.
  - Keep the feature flag off by default and scope it per organization/property. Homologation and production use separate configuration and credentials. Rollback disables the flag and leaves the local ledger intact for reconciliation.
  - Treat the adapter as incomplete until the plan's acceptance gate is satisfied; do not ship a partial HTTP client that can send real PII.
- Consequences:
  - A schema migration and a guest/companion model are prerequisites, not follow-up work.
  - The operation ledger adds storage and reconciliation work but preserves evidence for audit and support.
  - The integration remains intentionally unable to run in production until credentials, contradictions and legal/privacy decisions are closed.

### ADR-047 — FNRH party is explicit, not inferred from reservation counts

- Status: proposed for design approval; official documentation review applied; product/legal signatures pending; not implemented.
- Date: 2026-11-13.
- Context: `Reservation` stores one `guestId` plus `adults`/`children` counts, and `Stay` stores one primary guest. FNRH generates one ficha per guest aged 18 or over; minors and legally incapable people are linked to the responsible person's ficha (Portaria 41/2025, art. 29 and 37; FAQ 2.2). Creating placeholder guests from the counts would fabricate PII; adding FNRH fields directly to `Guest` would expose sensitive data in ordinary guest reads and mix operational and regulatory purposes.
- Decision:
  - Keep `Reservation.guestId` as the canonical primary guest and `Stay` as the occupancy/check-in source of truth. Do not drop or rename either in this initiative.
  - Add `ReservationGuest` with one `PRIMARY` row matching `Reservation.guestId` and explicit `COMPANION` rows. The primary must be an adult and legally capable. Minors carry `ageGroup=MINOR`, `minorSupervision`, and a responsible adult/capable `ReservationGuest` from the same reservation; legally incapable people carry `legalIncapacity=true` and a responsible. Minors do not get an independent FNRH ficha. `adults`/`children` remain operational counts and are compared against the party for FNRH readiness.
  - Add an optional 1:1 `GuestFnrhProfile` for the additional FNRH fields (social name, birth date, nationality/residence, gender, race/ethnicity, disability and address), rather than widening the general guest profile.
  - Backfill only the primary row from existing reservations with `ageGroup=UNKNOWN`; never create companion/minor placeholders. Existing `children > 0` reservations remain incomplete until an operator supplies identities.
  - Extend `GuestDocumentType` with `CPF` and `RG` while keeping legacy values. Only `CPF` and `PASSPORT` are FNRH-ready; do not auto-convert `NATIONAL_ID` to CPF or add a unique document constraint before duplicate cleanup.
  - Treat `cpf_solicitante` as the CPF of the operator performing the registration, not the guest. Its storage/origin is an integration and legal decision, not a guest-profile field.
  - Apply the product planning decisions: age at check-in, complete party before batch check-in, no historical sync before the cutover, no `StayGuest` in v1, and operator CPF via `requesterCpfRef` in integration configuration. These remain subject to product-owner ratification in `FNRH_GUEST_MODEL_REVIEW.md`.
  - Defer per-guest stay timestamps and a `StayGuest` model; initial FNRH check-in/check-out uses the reservation-level `Stay`.
- Consequences:
  - The migration is additive and reversible without changing existing reservation/occupancy behavior, but historical reservations with companions will require manual completion before FNRH sync.
  - Readiness must be computed, not stored, and the FNRH module must not block hotel check-in on incomplete regulatory data.
  - Product/legal approval is still required for capturing birth date, document, address and minors' data, the legal basis/retention policy, and the origin of `cpf_solicitante`. `FNRH_GUEST_MODEL_REVIEW.md` records the pending signatures.

### ADR-048 — Notes & Instructions v1 separates source text, suggestions, instructions and guest notes

- Status: accepted and implemented for v1.
- Date: 2026-11-14.
- Context: reservation observations arrive as long free-text blocks that mix descriptive notes, operational instructions, payment claims, billing requests and confidential information. Converting them automatically into payments, charges, tariffs or room assignments would create irreversible financial and occupancy errors. Existing `Reservation.notes` and `Guest.notes` are single editable fields and cannot express visibility, status, assignment, provenance or audit history.
- Decision:
  - Add additive models `ReservationInstruction`, `ReservationSourceNote`, `InstructionEvent` and `GuestNote`. Keep `Reservation.notes`/`Guest.notes` unchanged for compatibility.
  - Treat `ReservationSourceNote` as immutable: store the redacted original text, a SHA-256 digest of the exact received text (`sourceTextHash`), a normalized content hash for retry de-duplication, the parser version and the stored suggestions. Database triggers reject UPDATE/DELETE and TRUNCATE.
  - Treat `InstructionEvent` as append-only, protected by database triggers for UPDATE/DELETE/TRUNCATE. Status changes and edits write both the event timeline and the general audit log.
  - Model free-form `tags` on `ReservationInstruction` (the PRD lists tags as Must although the first conceptual model omitted them). Normalize server-side, deduplicate case-insensitively and cap at 10 tags of 32 characters. Validate that `validUntil > validFrom`.
  - Audit confidential list reads (`instruction.confidential_listed`) in addition to individual confidential reads.
  - Use a deterministic pt-BR parser (`pt-br-notes-v1`) that only proposes suggestions with `requiresHumanConfirmation: true`. Confirmation is a separate endpoint and only creates instruction rows. The parser and confirmation paths never create payments, charges, pre-authorizations, folio lines, tariff changes or room assignments.
  - Map `PGTO DIRETO NO HOTEL` to a pending `PAYMENT_PREAUTHORIZATION` instruction at `CHECK_IN` with `CREDIT_CARD`. It is neither a completed payment nor an approved authorization. Starting a real pre-authorization remains in the payment module with an explicitly confirmed amount, permission and tokenized provider.
  - Redact labelled and bare PAN/CVV-like values, and labelled NSU, authorization-code and provider-reference values, before persistence. Reference values are redacted only when labelled and shaped like a code, so ordinary prose that mentions NSU or authorization is preserved. Card data is never stored, logged or copied into instruction metadata; a later real provider token is the only payment credential.
  - Scope every query and mutation by server-resolved `organizationId` and `propertyId`, with composite tenant foreign keys and explicit reservation/guest lookups. Visibility is derived from permissions: `FRONT_DESK`, `RESERVATIONS`, `FINANCE` (`reports.financial`) and `MANAGEMENT`; `CONFIDENTIAL` additionally requires management-level access.
  - Keep guest notes separate. Creating or reading a reservation instruction never copies data into `GuestNote`, and guest notes are not injected into future reservations.
  - Expose REST endpoints under the existing header-based tenant context instead of `/properties/:propertyId/...`, matching current API conventions.
- Consequences:
  - The migration is additive and keeps legacy notes; no destructive backfill is performed.
  - Retries are idempotent by source-note content hash and per-source suggestion dedupe key, but confirmation is intentionally advisory: operators can edit suggestions before confirming.
  - Ambiguous dates and monetary mentions produce warnings instead of hard failures; the source text remains available for human review.
  - Real pre-authorization, fiscal document issuance and folio routing are still out of scope and must be implemented in their own modules with their own permissions and providers. Until a pre-authorization module exists, the UI cannot offer a real deep-link; it only displays the pending instruction and warning.
  - E2E coverage requires an isolated schema because source notes and instruction events reject updates/deletes and seed data must be created idempotently.

### ADR-049 — Hotel calendar dates come from the property timezone, never from the UTC date

- Status: accepted and implemented.
- Date: 2026-11-15.
- Context: reservations and operational days store calendar dates (`YYYY-MM-DD`) as PostgreSQL `date`, interpreted at UTC midnight by Prisma. That representation is correct for date-only values, but instants (`new Date()`, `createdAt`, `generatedAt`, `receivedAt`) must be projected to the property timezone before becoming a calendar date. Several E2E helpers derived "today" with `new Date().toISOString().slice(0, 10)`. In São Paulo (UTC-3), from 21:00 to 23:59 local time UTC is already the next day, so tests created arrivals for tomorrow: the arrival list came back empty and check-in failed with `check_in_too_early`. The same UTC shortcut appeared in the folio list date filter, folio/document numbers, CSV download names and web defaults.
- Decision:
  - Keep `Reservation.checkInDate`, `Reservation.checkOutDate` and `OperationalDay.operationalDate` as timezone-independent calendar dates. Never run them through a timezone conversion.
  - Add `calendarDateInTimezone(instant, timezone)` in `apps/api/src/common/time/property-day.ts` as the single helper to project instants to a property calendar date. `reservation-dates.ts` re-exports it for compatibility.
  - Use property-day bounds (`propertyDayStart` / `propertyDayBounds`) for instant filters such as the folio list `date` query, matching audit, reports and exports.
  - Use the property-local date for business identifiers and file names: `F-YYYYMMDD-...` folios, `DOC-YYYYMMDD-...` documents and `nova-<export>-YYYY-MM-DD.csv` downloads.
  - In the web app, `todayISO(offsetDays, timezone?)` uses the provided property timezone and falls back to the browser-local date, not UTC. Pages pass `property.timezone` from the session for reservation defaults, calendar start, front-office fallback, report range and CSV names.
  - E2E suites share `apps/api/test/support/property-date.ts`, which computes dates in the property timezone. A fixed-instant unit test (`2026-11-16T00:42:00Z` → `2026-11-15` in São Paulo) prevents regressions without depending on the hour CI runs.
- Consequences:
  - Date-sensitive tests are deterministic at any UTC hour, including the 21:00–00:00 São Paulo window.
  - Business numbers and downloaded file names can legitimately differ across local midnight; that is the intended hotel-day behavior.
  - No migration or data backfill is required: stored date-only values were already correct.
  - Editing wall-clock values (room blocks, instruction validity) still interprets `datetime-local` input in the browser timezone. Aligning those forms with the property timezone is a separate UI task because it requires converting a property-local wall time back to an instant.

### ADR-050 — Front Desk search reuses the reservations list and check-in eligibility is advisory until confirmation

- Status: accepted and implemented for Fase 1.
- Date: 2026-11-16.
- Context: Fase 1 needs a reception search by guest, reservation code, UH, date range and status, plus a guided check-in that shows why a room cannot be used. Creating `/front-office/search` would duplicate `GET /reservations`, which already owns tenant scoping, pagination, status and overlap filters. PostgreSQL `contains` does not fold accents, so typing `jose` did not find `José`. The existing check-in modal assigned a room and confirmed in one step, surfacing backend conflicts only as a generic error.
- Options:
  1. add a second Front Desk search endpoint with its own projection (rejected: duplicated filters, pagination and tenant rules);
  2. extend `GET /reservations` with accent-insensitive matching (chosen);
  3. denormalize a lowercase/unaccented search column (rejected for now: another write path and backfill for a small dataset).
- Decision:
  - Reuse `GET /reservations` for the Front Desk search with `search`, `status`, `fromDate`/`toDate`, `cursor` and `limit`. The free-text search already covers reservation code, guest name and room number, so no separate room-number filter is added.
  - Resolve accents only for guest names with the `unaccent` extension in a bounded raw query that returns IDs, scoped by `organizationId` and `propertyId`, with the LIKE pattern escaped and `LIMIT 200`. Reservation codes and room numbers stay in the Prisma `contains` OR; every other filter still applies. Prisma runs tenant connections with `search_path` limited to their schema, so the migration pins the extension to `public` and the query calls `public.unaccent(...)` explicitly; this also keeps isolated E2E schemas working.
  - Add read-only `GET /front-office/reservations/:id/check-in-readiness` (`front_office.read`) that mirrors the check-in rules: active room of the reservation's type, operational `AVAILABLE`, no active overlapping block, no in-house stay, no overlapping active reservation and housekeeping ready. Each room exposes `eligible` and machine-readable `reasons`.
  - Expose `checkInWindow` (`localDate`, `checkInDate`, `checkOutDate`, `allowed`, `code`) from the same helper used by `checkIn`; the wizard blocks its advance when the property-local date is outside `[checkInDate, checkOutDate)` and the backend still revalidates inside the transaction.
  - `checkIn` remains the only authority and revalidates inside its transaction. It now rejects `DIRTY`/`CLEANING` with `409 room_housekeeping_not_ready`; `CLEAN` and `INSPECTED` are accepted, and `INSPECTION_PENDING` is accepted by default until the pilot sets a policy. Readiness expresses this through each room's `reasons`; the UI does not duplicate the housekeeping state list.
  - Extract the guided flow into `check-in-wizard.tsx` with four steps (reservation, room, party, confirmation). It assigns the chosen room through the existing room-assignment endpoint and only shows success after the check-in response.
  - Keep filters in the query string (`q`, `fromDate`, `toDate`, `status`) with `history.replaceState`, so refresh and deep links preserve the search without adding history entries.
- Consequences:
  - Search results are reservations, not guests or folios; the guest profile is reachable by link and folio actions remain outside the list to avoid exposing balances without the folio contract.
  - Accent-insensitive matching is capped at 200 IDs. A very broad accented search can omit matches beyond that cap, while exact/case-insensitive `contains` still runs in the same `OR`.
  - Deployments must allow `CREATE EXTENSION unaccent` (or have a DBA create it in `public`); the migration fails otherwise.
  - Readiness can go stale between opening the wizard and confirming. The wizard refreshes on failure and the transactional check-in decides; the endpoint never reserves the room.
  - `checkInWindow` is computed when readiness is requested and can go stale until confirmation; the transactional check remains the authority and still returns `check_in_too_early`/`check_in_window_elapsed`.
  - UI copy stays in Spanish to match the existing app even though the ficha prioritizes pt-BR; domain enums and API values are unchanged.
- Validation required:
  - pilot policy for `INSPECTION_PENDING` and for balance/pre-authorization blocks at check-in;
  - whether readiness should include check-in window and occupancy pricing before room selection;
  - whether folio balance should be exposed in results with a dedicated permission-aware projection.

### ADR-051 — Room Rack derives occupancy and coordinates selection with an ephemeral Redis lease

- Status: accepted and implemented for Fase 2; pilot policy for lease override pending.
- Date: 2026-11-16.
- Context: the room list only exposed inventory fields, so Front Desk could not distinguish free/occupied rooms, see the in-house guest, anticipate the next arrival or filter by floor/capacity. Housekeeping and operational state were already separate from occupancy, but the UI had no projection that combined them. Two reception sessions could also open the same room and only discover the conflict at assignment. Reading/writing a lease in PostgreSQL would add a write path, TTL cleanup and contention to a purely ephemeral UX concern.
- Options:
  1. persist leases in PostgreSQL (rejected: extra writes, cleanup jobs and lock contention for non-authoritative state);
  2. use Redis `SET NX PX` with Lua compare-and-delete/renew (chosen);
  3. rely only on the final assignment conflict (rejected for UX: late, generic failure after all steps).
- Decision:
  - Keep `Room.housekeepingState` and `Room.operationalState` independent. Derive `occupancy` from an `IN_HOUSE` stay, `currentStay` from that stay, `nextArrival` from the next confirmed reservation and `activeBlock` from the active block. No occupancy flag is persisted or synchronized.
  - Apply `roomTypeId`, `status`, `housekeepingState`, `operationalState`, `occupancy`, `floor`, `building`, `minCapacity` and `search` server-side before pagination. Return `summary` and `facets` from the same property-scoped query so counters do not drift from the visible filter universe.
  - Add `Room.updatedByUserId` (additive migration, composite FK, index) and expose the last modifier. Update it on room create/update, housekeeping transitions and operational reconciliation.
  - Store leases only in Redis (`nova:room-lease:v1:<propertyId>:<roomId>`) with a configurable TTL (default 120 s, bounds 1–600 s). Acquisition uses `SET NX PX`; renew/release use a Lua script that compares `leaseId`, so a stale session cannot renew or delete a newer lease.
  - `POST /reservations/:id/room-assignment` checks the lease before assigning and rejects another owner with `409 room_lease_held`. This is advisory: the lease may expire between the check and the commit, and the PostgreSQL exclusion constraint remains the final authority. Same-owner assignment is allowed.
  - The check-in wizard acquires a lease when a room is selected, renews it every 45 s and releases it on room change, close, assignment or confirmation. The room rack polls every 15 s without a loading spinner, so another session sees the lease and cannot select that room.
  - The contextual drawer shows stay, next arrival, block, lease owner and history with actor names. It offers housekeeping transitions, block release and incident registration. Incident creation uses the existing Front Office endpoint with `roomId`, so it inherits tenant, permission and audit rules.
- Consequences:
  - Redis is not a source of truth and holds no hotel data beyond the display name needed to explain the lock. If Redis is unavailable, list/readiness degrade to `lease: null`; acquiring a lease returns `503 room_lease_unavailable`, and the operator can still assign through the authoritative path.
  - A lost browser or closed tab leaves a lease until TTL expiry (at most 120 s by default). There is no manual override UI; a same-owner retry or waiting for expiry resolves it. A forced override would need an explicit permission and audit decision.
  - The list uses polling, not WebSocket/SSE; two sessions can be up to 15 s stale. The assignment-time lease check and PostgreSQL constraints close the correctness gap.
  - The drawer does not yet offer room move or a direct reservation/stay link; those remain Front Office actions. Room moves do not acquire a lease in this phase.
  - `updatedBy` is null for seeded or system-reconciled rows created before the migration until the next explicit mutation.
- Validation required:
  - pilot TTL and whether an authorized supervisor may force-release a lease;
  - whether room move should require the same lease and whether incidents need a lease at all;
  - whether the room rack should move from 15 s polling to realtime events.

### ADR-052 — Lease override and lease transfer are explicit, audited coordination actions

- Status: accepted and implemented for Fase 3 Sprint 1–2; pilot policy for who may force-release pending.
- Date: 2026-11-16.
- Context: ADR-051 left two gaps. A lost browser or closed tab kept a room blocked until TTL expiry with no operator remedy, and two reception sessions could not hand a selected room over without dropping the selection and racing for the destination. Both are purely ephemeral UX concerns, so both had to stay outside PostgreSQL while still leaving an audit trail.
- Options:
  1. let any session delete any lease silently (rejected: no traceability, trivially abusable);
  2. force-release with an explicit endpoint, mandatory permission and audit (chosen);
  3. make leases durable in PostgreSQL so they become queryable/auditable state (rejected: writes and cleanup for non-authoritative data).
- Decision:
  - `POST /inventory/rooms/:id/lease-release` accepts `{ leaseId, reason? }`, requires `front_office.manage` and never checks ownership. It reads the current lease for the audit, deletes the Redis key and always appends `room_lease_released_forced` with the requested `leaseId`, the previous owner and the reason. A missing lease is not an error: it returns `200` with `released: false` so the UI is idempotent.
  - Audit failures never block the release; a Redis failure leaves the TTL as the cleanup path, and the audit still records the attempt.
  - `POST /inventory/rooms/:id/assignment-leases/transfer` acquires the destination lease first and releases the origin only when the actor owns it. The order guarantees a failed transfer keeps the current claim. A destination held by another session returns `409 room_lease_held` unchanged.
  - Room move itself remains `POST /reservations/:id/room-assignment`: it revalidates room type, overlap and blocks in PostgreSQL inside a transaction and writes `reservationHistory` plus audit. Inventory does not duplicate those rules, and the transfer endpoint is named for what it does (lease transfer), not for a move it does not perform.
- Consequences:
  - Any user with `front_office.manage` can unblock a room; the audit names the actor, the previous owner and the reason. Narrowing this to a supervisor role is a pilot decision.
  - The forced release cannot distinguish "stale lease" from "active selection", so the UI must ask for a reason before calling it.
  - A transfer that fails after acquiring the destination keeps the destination lease: the operator can retry the transfer or release it explicitly. Nothing in PostgreSQL changed, so no data is inconsistent.
- Validation required:
  - which role may force-release a lease (reception, supervisor, admin) and whether a reason is mandatory;
  - whether room move should transfer the lease automatically from Front Office instead of requiring two calls.

### ADR-053 — Room rack updates use an in-process SSE stream with polling as the fallback

- Status: accepted and implemented for Fase 3 Sprint 3; multi-instance broker pending.
- Date: 2026-11-16.
- Context: the rack refreshed every 15 s, so two sessions could disagree for up to 15 s about housekeeping, blocks or who is selecting a room. Realtime was desirable but PostgreSQL must remain the only authority, and the current deployment is a single API instance.
- Options:
  1. keep polling only (rejected: visible staleness on a shared front desk);
  2. add a shared broker (Redis pub/sub or Durable Objects) now (rejected: new infrastructure before a pilot needs it);
  3. in-process SSE fan-out per organization/property, with the existing 15 s poll as fallback (chosen).
- Decision:
  - `RoomEventsService` keeps a set of RxJS `Subject`s per `organizationId:propertyId` and a monotonic per-instance counter, so every open tab of a tenant receives each event: a new subscriber is added to the set instead of replacing the previous one. The entry is removed when its last subscriber unsubscribes. Publishing happens after the PostgreSQL transaction commits, for room updates, housekeeping transitions, block create/release and lease acquire/release/force/transfer.
  - `GET /inventory/rooms/updates` is an SSE route declared before `rooms/:id` so the literal path is not parsed as a UUID. It requires `inventory.read` and a resolved property context from the authenticated tenant, never from a query parameter.
  - Frames carry notification only: `{ type, roomId, at }`. Clients refetch the rack, debounced at 250 ms, so a missed or duplicated event costs one request and never loses state.
  - `ready` carries the instance cursor. Past events are not replayed; a reconnecting client refetches instead of replaying a partial history.
  - The web client consumes the stream with `fetch` and a frame parser because `EventSource` cannot send the identity and tenant headers the API requires. On any failure it polls every 15 s and retries the stream with exponential backoff capped at 30 s.
- Consequences:
  - With more than one API instance, a subscriber only receives events published by its own instance; the poll still converges within 15 s. A shared broker is required before horizontal scaling.
  - Lease TTL expiry produces no event, so the rack converges through polling; this is why the fallback interval stays.
  - Proxies that buffer responses break SSE; the client detects the stalled stream and falls back without user action.
- Validation required:
  - whether the pilot runs a single API instance or requires a broker on day one;
  - whether the rack should keep the 15 s poll while the stream is healthy as a cheap safety net.

### ADR-054 — El catálogo de consumos es dato maestro por propiedad y el cargo guarda el precio aplicado

- Status: accepted and implemented in Fase 4; catalog contents and tax treatment pending pilot validation.
- Date: 2026-11-17.
- Context: Caixa podía registrar cargos manuales con texto libre, pero no había catálogo de productos. Sin él, cada consumición de minibar se escribía a mano —con descripciones y precios inconsistentes— y no se podía auditar qué se vendió. La ficha pide un catálogo mínimo y prohíbe inventar reglas fiscales, stock o integraciones.
- Options:
  1. seguir sólo con cargos manuales (rechazado: no hay catálogo administrable ni precios controlados);
  2. catálogo global por organización (rechazado: precios y surtido son por propiedad; Meals/unidades difieren);
  3. catálogo por propiedad con snapshot de precio en cada línea de folio (elegido).
- Decision:
  - Nuevo modelo `FolioProduct` (`sku` único por propiedad, nombre, descripción, categoría, unidad, `unitAmount` DECIMAL(10,2), moneda, `isActive`) con FK compuestas a organización y propiedad y auditoría de creación/edición (`catalog.product_created`, `catalog.product_updated`).
  - `FolioLine` gana `productId?`, `quantity` DECIMAL(10,2) default 1, `unitAmount?`, `unit?` y `source` (`MANUAL`, `MINIBAR`, `FRONT_DESK`, `PARKING`, `SERVICE`, `INTEGRATION`). Todos los campos son aditivos y con default, por lo que la migración es segura sobre datos existentes.
  - `POST /folios/:id/charges` acepta `productId` + `quantity` o `description` + `amount`. Con `productId` el backend resuelve el precio desde PostgreSQL, calcula `unitAmount × quantity` con redondeo HALF_UP a dos decimales y descarta cualquier `amount` del cliente. La moneda del producto debe coincidir con la del folio.
  - `sku` es inmutable: identifica el producto ante el hotel y cambiar el código de un artículo ya vendido complica la conciliación. El nombre, precio, categoría y estado sí se editan.
  - Los permisos del catálogo reutilizan `folio.read` / `folio.manage`: el catálogo sólo existe para cargar cuentas y los roles de recepción y gerencia ya tienen exactamente ese par. No se introduce un permiso nuevo sin necesidad operativa.
- Consequences:
  - No hay control de stock, ni recetas, ni impuestos: crear cualquiera de ellos exige un módulo separado con requisitos confirmados.
  - Un producto inactivo no puede cargarse, pero sus líneas históricas y sus precios quedan intactos.
  - Editar un precio nunca reescribe cargos emitidos; el total del folio depende del snapshot, no del catálogo actual.
  - No se admiten precios en cero (cortesías): hoy requieren un cargo manual con importe mínimo. Si el piloto necesita cortesías, se resuelve con una decisión de producto y no con un `amount` cliente.
- Validation required:
  - qué surtido inicial (minibar, estacionamiento, lavandería y servicios) y quién mantiene precios;
  - si hacen falta cortesías/descuentos por línea y con qué aprobación;
  - si el hotel requiere control de stock o consumo por habitación recurrente (fuera de esta fase).

### ADR-055 — El checkout cierra cuenta y estancia en una transacción y el saldo pendiente es política explícita

- Status: accepted and implemented in Fase 4; the pilot policy for departing with a balance is an OPEN QUESTION with a reversible default.
- Date: 2026-11-17.
- Context: el check-out anterior marcaba la estancia y la reserva como `CHECKED_OUT` y liberaba la habitación, pero no tocaba la cuenta ni housekeeping. Eso permitía liberar una habitación con cargos abiertos y dejaba el estado de limpieza sin actualizar. La ficha exige separar cierre de cuenta, checkout de estancia y limpieza, sin liberar la habitación si el cierre falla, y prohíbe inventar una regla universal sobre saldos.
- Options:
  1. un endpoint nuevo de checkout que duplique la lógica de estancia (rechazado: dos caminos con las mismas reglas);
  2. encadenar llamadas desde el frontend (rechazado: una falla intermedia deja estados incoherentes y la habitación liberada);
  3. extender `POST /front-office/stays/:id/check-out` para cerrar cuentas dentro de la misma transacción (elegido).
- Decision:
  - La transacción bloquea la estancia, lee sus cuentas (`stayId` o `reservationId`, sin `CANCELLED`), calcula saldo con `computeFolioTotals` (cargos `POSTED` − pagos `COMPLETED`) y, si `closeFolios` es `true`, actualiza cada cuenta `OPEN` a `SETTLED` con `closedAt`, marca la estancia y la reserva como `CHECKED_OUT`, escribe `ReservationHistory`, pasa la habitación a `DIRTY` con `RoomStatusHistory` y audita cada paso. Cualquier error revierte todo: la habitación no se libera y no queda sucia.
  - Cerrar cuentas en el checkout exige `folio.manage` además de `front_office.manage`; sin ese permiso la operación responde `403 permission_denied` en lugar de cerrar cuentas ajenas al rol.
  - Un saldo distinto de cero no se bloquea por defecto sin política: responde `409 folio_balance_outstanding` salvo que el operador envíe `allowOutstandingBalance` con `balanceReason` (≥ 3 caracteres). La razón queda en el `AuditEvent` `folio.closed_at_checkout`. Es una decisión por operación auditada, no una configuración de propiedad todavía.
  - `GET /stays/:id/checkout-readiness` expone el resumen previo (cuentas, totales, housekeeping objetivo, advertencias) para que la UI muestre la consecuencia antes de confirmar.
  - Housekeeping sólo se toca si no está ya `DIRTY`: repetir el checkout es idempotente y no genera transiciones espurias.
- Consequences:
  - Una cuenta con saldo puede cerrarse con autorización; el hotel conserva la deuda fuera del sistema. Si el piloto exige bloquear siempre, se cambia el default o se agrega configuración por propiedad.
  - El checkout sigue sin integración de pagos: registrar el pago es una operación previa (`payment.manage`) y no se simula autorización.
  - La habitación queda `DIRTY` de forma incondicional tras la salida; una política de “salida sin limpieza” (por ejemplo, salida el mismo día con reingreso) requiere decisión y se implementará con un flag explícito.
  - El cierre de caja del día operativo sigue siendo independiente: el checkout no cierra la sesión de caja.
- Validation required:
  - ¿el hotel permite el checkout con saldo pendiente y quién lo autoriza?
  - ¿la habitación de salida debe pasar siempre a `DIRTY` o el hotel usa otro estado de limpieza?
  - ¿el checkout debe exigir un pago registrado o una preautorización cuando la política lo requiera?

### ADR-056 — El cambio de habitación guiado comparte predicados con la transacción y housekeeping advierte sin bloquear

- Status: accepted and implemented in Fase 5; pilot policy on housekeeping and who may move a stay pending.
- Date: 2026-11-17.
- Context: `POST /front-office/stays/:id/room-move` ya revalidaba tipo, bloqueo, ocupación y solapamiento dentro de una transacción, pero la UI sólo ofrecía un selector de habitación construido con el room rack. El operador no veía por qué una habitación no era válida hasta enviar el formulario, ni el housekeeping del destino, y un rechazo no refrescaba las alternativas. Duplicar las reglas en el cliente habría permitido que la lista de candidatas y la transacción divergieran.
- Options:
  1. filtrar candidatas en el frontend con el room rack (rechazado: dos fuentes de verdad y conflicto tardío);
  2. exponer un endpoint nuevo de movimiento (rechazado: duplica la transacción existente y su auditoría);
  3. read model `GET /stays/:id/room-move-candidates` alimentado por los mismos predicados que la transacción (elegido).
- Decision:
  - `apps/api/src/front-office/room-move.ts` concentra los predicados (`staticRoomMoveBlockers`, `activeRoomBlockWhere`, `occupyingStayWhere`, `overlappingReservationWhere`) y los códigos de bloqueo. Tanto `moveRoom` como `roomMoveCandidates` los usan, de modo que la lista no puede divergir de lo que la transacción acepta; el orden de los bloqueos también coincide con el primer error que devolvería la confirmación.
  - `GET /front-office/stays/:id/room-move-candidates` exige sólo `front_office.read` y devuelve todas las habitaciones de la propiedad excepto la actual, cada una con tipo/capacidad, housekeeping, estado operativo, ocupación, bloqueo vigente, `eligible`, `blockers` y `warnings`. Es de solo lectura: no adquiere lease, no reserva y no sustituye la validación transaccional.
  - El housekeeping del destino no bloquea el movimiento (la regla histórica lo permite), pero se expone como advertencia `housekeeping_not_ready` cuando el estado no es `CLEAN` ni `INSPECTED`, para que recepción confirme con gobernanta antes de mover al huésped.
  - La UI (`/front-office`, acción «Mover» sobre la estancia) muestra la habitación actual, filtra por tipo, piso, ala, housekeeping y UH, oculta las no elegibles por defecto (con opción de mostrarlas y ver el motivo), compara origen y destino y exige un motivo de 3–500 caracteres. Tras un conflicto, refresca las alternativas y explica el código devuelto.
  - El movimiento sigue siendo la misma transacción: bloquea estancia y habitación, revalida, actualiza `Stay.roomId` y `Reservation.roomId`, incrementa `moveCount`, escribe `ReservationHistory` y `AuditEvent reservation.room_moved` con motivo y números de habitación de origen y destino.
- Consequences:
  - El endpoint de candidatas devuelve el inventario completo de la propiedad en una sola respuesta; es aceptable mientras el inventario sea acotado (cientos de habitaciones). Si crece, se pagina sin cambiar la transacción.
  - La lista puede quedar obsoleta entre la carga y la confirmación; el conflicto se resuelve en la transacción y la UI refresca, nunca al revés.
  - No se usa el lease de asignación: el cambio de habitación es una operación de recepción sobre una estancia ya alojada y el destino no se reserva antes de confirmar.
- Validation required:
  - si el piloto exige que el destino esté limpio (bloqueo, no advertencia) o que inspección pendiente bloquee;
  - qué roles pueden mover una estancia y si el motivo debe ser obligatorio siempre;
  - si el cambio debe notificar a gobernanza o registrar consumos/llaves asociados al traslado.

### ADR-057 — Un único `ActionDialog` con tonos concentra la jerarquía y el comportamiento de las decisiones operativas

- Status: accepted and implemented in Fase 6 for Front Office; adoption in the remaining screens pending.
- Date: 2026-11-17.
- Context: cada pantalla de Front Office escribía su propio `Modal` con cabecera, pie y botones, el error de una mutación sólo aparecía como toast efímero y el foco inicial caía en el primer campo del formulario. La ficha pide un sistema consistente (información, advertencia, confirmación y acción crítica) con foco inicial, cierre controlado, anti doble submit y errores en contexto, sin convertir cada aviso en un modal.
- Options:
  1. seguir con modales ad hoc y normalizar sólo el texto (rechazado: el comportamiento —foco, Escape, doble submit, errores— seguiría divergiendo por pantalla);
  2. cuatro componentes `InfoDialog`/`WarningDialog`/`ConfirmDialog`/`CriticalActionDialog` (rechazado: cuatro copias de la misma estructura y del mismo comportamiento, con riesgo de deriva);
  3. un `ActionDialog` con el tono como dato, comportamiento único y props para el contenido (elegido).
- Decision:
  - `apps/web/src/components/action-dialog.tsx` expone `tone` (`info`, `warning`, `critical`), `title`, `summary`, `children`, `confirmLabel`, `onConfirm`, `hideCancel`, `isLoading`, `confirmDisabled`, `error` (mensaje ya localizado) y `size`. Todo lo demás es comportamiento fijo, no configuración.
  - El foco inicial siempre cae en la acción segura (cancelar o cerrar); el foco atrapado y su retorno al disparador quedan en manos de Chakra.
  - `critical` y cualquier diálogo con una petición en vuelo bloquean `Escape`, el clic en el overlay y el botón de cierre: una operación significativa exige una decisión explícita.
  - Confirmar es un `submit` deshabilitado mientras carga, con una guarda adicional en el handler; un doble clic no puede enviar dos mutaciones.
  - Los errores del servidor se renderizan dentro del diálogo (`ErrorAlert` o texto de dominio mapeado) en lugar de un toast; el modal permanece abierto y editable.
  - El toast sigue existiendo para el éxito de una operación y para avisos simples; un modal no es un canal de notificación.
  - No se crean wrappers por variante: un tono nuevo es un valor del enum, no un componente nuevo.
- Consequences:
  - Los flujos convertidos ganan consistencia y pruebas Playwright de foco, cierre, error y envío único; los no convertidos (Reservas, Caja, Catálogo, alta de incidencias) siguen con su composición previa hasta su propia pasada.
  - El color de la acción principal se deriva del tono (`critical` → `danger`); no hay prop de color. La severidad la comunican además el icono, el eyebrow y la consecuencia, de modo que el color nunca es el único indicador.
  - Con texto escrito, cualquier intento de cierre abre «¿Descartar lo escrito?» («Seguir editando» / «Descartar»). El aviso no interviene en el cierre exitoso que hace la pantalla y no cambia el reset del formulario al abrir, que sigue evitando arrastrar datos entre huéspedes.
- Validation required:
  - si el hotel quiere que `Escape` también descarte una acción crítica (hoy no lo hace);
  - si el aviso de descarte debe cubrir también selecciones (hoy solo texto escrito);
  - qué mensajes de dominio deben traducirse antes de la Fase 7.

### ADR-058 — i18n propia con diccionarios tipados y `pt-BR` prioritario, activada por cookie durante la migración

- Status: accepted; implemented for the shared layer and entry routes in Fase 7 (part 1). Screens pending.
- Date: 2026-11-18.
- Context: la ficha prioriza `pt-BR` para la interfaz de recepción, pero ADR-050 dejó la copia en español «para acompañar la app existente» y no había ninguna capa de i18n: ~292 cadenas visibles estaban escritas a mano dentro de 31 archivos. Traducir todo de una vez, sin capa, garantiza pantallas mezcladas y un glosario inconsistente (`Habitación`/`UH`, `Folio`/`Conta`). El requisito de la ficha es explícito: no mezclar portugués y español en la misma pantalla, y no cambiar los valores persistidos por una traducción.
- Options:
  1. reemplazar la copia en el lugar por portugués y abandonar el español (rechazado: pierde el idioma actual del piloto, no deja glosario central y obliga a tocar todo el producto en un único cambio irreversible);
  2. incorporar `next-intl`/`react-intl` (rechazado por ahora: dependencia nueva para necesidades que hoy son diccionarios estáticos, un locale activo por sesión e `Intl`; sin plurales ICU ni carga diferida);
  3. diccionarios tipados propios, resolución de locale en el servidor y `t()` sin dependencias (elegido).
- Decision:
  - `apps/web/src/lib/i18n/` contiene `es` (fuente de verdad de las claves y del texto actual), `pt-BR` (tipado como `Record<TranslationKey, string>`, de modo que una clave sin traducir es un error de `tsc`) y un `translate(locale, key, vars)` con interpolación `{placeholder}`.
  - El locale activo se resuelve en el layout raíz a partir de la cookie `nova_locale`; un valor desconocido cae en `DEFAULT_LOCALE`. El layout escribe `lang` en `<html>` y pasa el locale al `I18nProvider`, así el primer render de servidor y el de cliente coinciden y no hay desajuste de hidratación. La cookie es una preferencia, nunca autorización.
  - `DEFAULT_LOCALE` se mantiene en `es` mientras la migración avance: nada cambia para el piloto y las suites e2e siguen afirmando el mismo texto. Al terminar la migración, pasar el idioma por defecto a `pt-BR` es un cambio de una línea; no se expone un selector de idioma en la UI hasta entonces.
  - Cada pantalla se migra de forma atómica: una pantalla queda entera en el diccionario o entera en español, nunca a medias, para cumplir «no mezclar idiomas en la misma pantalla».
  - No se traducen identificadores de enums ni valores de API (`CHECKED_IN`, `CASH_IN`, `OUT_OF_ORDER`): sólo sus etiquetas. El parser `pt-br-notes-v1` y su diccionario quedan fuera de esta capa.
  - Glosario de recepción adoptado en `pt-BR`: `UH` (unidad habitacional), `Hóspede`, `Governança`, `Caixa`, `Conta` (folio), `Reserva`, `Check-in`, `Checkout`, `Propriedade`.
  - `format.ts` expone `INTL_LOCALE` (`es-AR`, `pt-BR`) para que fechas e importes sigan el locale cuando las pantallas migren.
- Consequences:
  - La copia compartida (chrome, navegación, `ActionDialog`, estados de carga/error/vacío, login y página offline) ya se resuelve por diccionario y responde a `nova_locale=pt-BR`; el resto de las pantallas sigue en español y se migra en las partes 2–4 del informe de fase.
  - Mientras `DEFAULT_LOCALE` sea `es`, activar `pt-BR` muestra portugués sólo en las superficies migradas: es una vista previa de QA, no el estado de entrega. La fase cierra cuando todas las pantallas estén migradas y el valor por defecto cambie.
  - ADR-050 queda superado en su punto «UI copy stays in Spanish»: el español deja de ser el único idioma y pasa a ser un locale más.
  - No hay dependencias nuevas ni cambios de contrato HTTP; los valores persistidos y los códigos de error no cambian.
- Validation required:
  - confirmar el glosario con el hotel piloto (`UH` vs `Apartamento`, `Conta` vs `Folio`, `Caixa e fechamento` vs `Caixa`);
  - decidir si `pt-BR` pasa a ser el idioma por defecto de las propiedades existentes o sólo de las nuevas;
  - definir si se necesita un selector de idioma por usuario y si debe persistirse en el servidor.

## ADR-059 — Validaciones y etiquetas localizables sin duplicar reglas

- Context: la pantalla `/reservations` valida con `lib/validation` y muestra etiquetas de `lib/format`, ambas compartidas con pantallas todavía en español. Traducir las reglas por pantalla duplicaría límites y mensajes, y traducir los mapas globales rompería el texto de las pantallas no migradas.
- Decision:
  - `ValidationCopy` suma plantillas **opcionales** (`minLength`, `date`, `dateOrder`, `nights`, `code`, `emailRequired`, `emailInvalid`, `phoneInvalid`). Cada validador acepta un `copy` opcional y devuelve el texto histórico en español cuando no se lo pasa: los llamadores existentes no cambian y la pantalla migrada arma el objeto desde el diccionario.
  - `validateGuest` acepta además `labels` (nombre, documento, notas) con el mismo criterio.
  - Para las etiquetas de enums, `format.ts` gana `*_LABEL_KEYS` + helper `xxxLabel(locale, value)` (`reservationStatusLabel`, `documentTypeLabel`, `documentStatusLabel`, `reservationDocumentLabel`, `instructionCategoryLabel`, `instructionPriorityLabel`, `instructionStatusLabel`, `instructionActionLabel`, `instructionMomentLabel`, `instructionVisibilityLabel`). Los mapas `*_LABELS` en español se derivan de `translate('es', …)` y quedan sólo para pantallas no migradas.
  - Los paneles del detalle de la reserva (`reservation-party`, `instructions-panel`, `documents-panel`) se localizan en su lugar con `useI18n()`; al ser compartidos, en `pt-BR` aparecen en portugués también dentro de pantallas aún no migradas.
- Consequences:
  - No hay reglas de negocio nuevas ni relajadas: sólo cambia la fuente del texto.
  - Las reglas de validación siguen viviendo una sola vez, en `lib/validation`, con límites espejo de los DTO.
  - Mientras `DEFAULT_LOCALE` sea `es`, el piloto no ve ningún cambio de texto ni de comportamiento.
- Validation required:
  - revisar el glosario de los paneles compartidos (`Comitiva` vs `Fiesta`, `Hospedado` vs `En casa`) con el hotel piloto.

## ADR-060 — RLS como defensa en profundidad del tenant (propuesta, no implementada)

- Status: proposed; requires approval before any implementation.
- Date: 2026-11-19.
- Context: hoy el aislamiento multifinca depende de que cada consulta filtre por
  `organizationId`/`propertyId`. Está resuelto en servidor y cubierto por 19 casos
  e2e de aislamiento, pero sigue siendo una convención: un `findMany` sin filtro
  devolvería datos de otro hotel. El aislamiento es la prioridad nº 1 de AGENTS.md.
- Options:
  1. mantener sólo la convención de aplicación (rechazado a medio plazo: un error
     de código es una fuga silenciosa);
  2. RLS con `set_config` por transacción y roles separados (propuesto);
  3. RLS con conexiones por tenant (rechazado: multiplica pools y complica PgBouncer).
- Decision (a validar): roles `nova_migrator` (owner, migraciones) y `nova_app`
  (API, `NOSUPERUSER NOBYPASSRLS`); cada request ejecuta sus consultas en una
  transacción que fija `app.organization_id` con `set_config(..., true)`;
  fail-closed (sin variable, 0 filas). Piloto en una tabla (`Incident`) y
  extensión tabla por tabla.
- Consequences: cambia el modelo de conexión y el `PrismaService`; los tests de
  RLS deben usar un rol no superusuario (el usuario `nova` del CI es superusuario
  e ignora RLS). Rollback = `ALTER TABLE ... DISABLE ROW LEVEL SECURITY`.
- Validation required: aprobación explícita, medición de `EXPLAIN` antes/después y
  plan de migración de los roles en cada entorno.

## ADR-061 — LGPD operativa: retención, anonimización y auditoría de lectura (propuesta)

- Status: proposed; no production code until approved with the pilot hotel and legal review.
- Date: 2026-11-19.
- Context: `Guest` guarda `fullName`, `email`, `phone`, `documentType`,
  `documentNumber`, `notes` y existe `GuestFnrhProfile`. No hay retención,
  anonimización, derechos del titular ni registro de lecturas sensibles (hallazgo
  F-06 de la auditoría).
- Decision (a validar):
  - retención diferenciada por tipo de dato (huésped sin estadía, con estadía,
    datos fiscales/FNRH), definida con el hotel y asesoría legal;
  - anonimización transaccional (nunca hard delete) que conserva folios y
    documentos fiscales por obligación legal, bloqueada si hay estadía activa;
  - permiso RBAC nuevo para exportar/anonimizar y auditoría de cada ejecución;
  - registro de lectura de documento/teléfono/email completo con interceptor.
- Consequences: agrega estados de archivo, permisos y jobs de retención por lotes
  idempotentes; no cambia el contrato HTTP existente.
- Validation required: plazos legales, qué se conserva, quién ejecuta y con qué
  aprobación. Mientras no se apruebe, no se implementa.

## ADR-062 — Pagos: interfaz `PaymentProvider` antes de elegir proveedor (propuesta)

- Status: proposed; no implementation.
- Date: 2026-11-19.
- Context: no se almacenan PAN/CVV y no hay integración de pagos. Elegir proveedor
  antes de definir la interfaz acopla el dominio a un vendor.
- Decision (a validar): definir `PaymentProvider` (tokenización, preautorización,
  captura, reverso, webhooks idempotentes) y una máquina de estados de pago
  explícita; la conciliación se apoya en PostgreSQL como fuente de verdad.
- Validation required: proveedor, requisitos fiscales y de adquirencia del piloto.

## ADR-063 — Offline real: outbox idempotente en cliente (propuesta)

- Status: proposed; el modo offline actual sólo bloquea escrituras (ADR-037).
- Date: 2026-11-19.
- Decision (a validar): `Idempotency-Key` por mutación, outbox local con
  reintentos, resolución de conflictos explícita y una lista cerrada de
  operaciones permitidas sin red. Redis/PostgreSQL siguen siendo la autoridad.
- Validation required: requisitos de continuidad del piloto y autonomía eléctrica/WAN.

## ADR-064 — Perfil de huésped con historial (bloqueado por ADR-061)

- Status: proposed; depende de la decisión de retención y anonimización.
- Date: 2026-11-19.
- Decision (a validar): detalle de huésped con reservas/estancias vinculadas,
  permisos por recurso y minimización por defecto (documento enmascarado salvo
  lectura autorizada y auditada).

## ADR-065 — Autenticación de producción: IdP externo vs. auth local

- Status: proposed.
- Date: 2026-11-19.
- Context: la auth local con sesiones, MFA y CSRF es una transición controlada y
  no está declarada producción-ready.
- Decision (a validar): revisión de seguridad de la auth local (rotación de
  secretos, recuperación de cuenta, bloqueo, auditoría) frente a un IdP externo
  con OIDC/SAML y aprovisionamiento por organización.
- Validation required: proveedor, coste, requisitos de SSO del piloto.

## ADR-066 — FNRH, OCR/PDF y Academy fuera de alcance hasta el piloto

- Status: proposed.
- Date: 2026-11-19.
- Context: AGENTS.md prohíbe inventar requisitos fiscales ni comportamiento de
  proveedores, y exige no introducir IA/OCR cuando reglas y CSV alcanzan.
- Decision: mantener FNRH/PIX/NFS-e/OCR/Academy como discovery; no implementar
  contratos ni campos obligatorios sin documentación oficial y validación del
  hotel piloto.
