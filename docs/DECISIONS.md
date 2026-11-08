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

- Status: accepted for Phase 1; must be superseded before production.
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

- Status: accepted for Phase 1.
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
- Validation required: add automated schema-drift checks or migration review checklist.

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

## ADR template

### ADR-NNN — Title

- Status: proposed / accepted / superseded
- Date:
- Context:
- Options:
- Decision:
- Consequences:
- Validation required:
