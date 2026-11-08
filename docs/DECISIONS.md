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

### ADR-NNN — Title

- Status: proposed / accepted / superseded
- Date:
- Context:
- Options:
- Decision:
- Consequences:
- Validation required:
