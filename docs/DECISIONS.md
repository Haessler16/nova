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

## ADR template

### ADR-NNN — Title

- Status: proposed / accepted / superseded
- Date:
- Context:
- Options:
- Decision:
- Consequences:
- Validation required:
