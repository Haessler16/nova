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
