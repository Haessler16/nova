# NOVA PMS — Security & LGPD Baseline

## Security baseline

- TLS in all non-local environments.
- Password hashing with a modern adaptive password hash if local credentials are used; prefer established identity provider where feasible.
- Secure, HttpOnly, SameSite cookies for browser sessions where appropriate.
- CSRF protection for cookie-authenticated state-changing requests.
- Rate limiting for authentication, imports and sensitive endpoints.
- Strong session invalidation and account lifecycle.
- Secrets managed outside source control.
- Principle of least privilege for users, services and database roles.
- Validate uploads by extension, MIME sniffing, size, content and malware scanning before processing.
- Protect against IDOR, SQL injection, XSS, CSRF, SSRF, mass assignment and insecure direct object references.
- Structured logs must redact tokens, passwords, personal documents and payment payloads.
- Dependency scanning and security updates in CI.

## Implemented controls (Phase 1 + Phase 2)

### Authentication

- `AUTH_MODE=local-session`: email + password against `User.passwordHash`.
- Passwords hashed with Node `scrypt` (`N=16384`, `r=8`, `p=1`, 64-byte key, 16-byte salt). Hash format is versioned so parameters can be raised later.
- Unknown emails still run a dummy `scrypt` verification to reduce timing/user-enumeration signal.
- Login failures return a generic `invalid_credentials` message.
- `AUTH_MODE=dev-header` is rejected when `NODE_ENV=production`, both at config validation and at the guard. It is intended only for local development and deterministic E2E tests.
- `AUTH_MODE=disabled` rejects every protected route.

### Sessions

- Sessions are opaque 256-bit random tokens. Only `sha256(token)` is stored in `Session.tokenHash`.
- Session row tracks `expiresAt`, `revokedAt`, `revokedReason`, `lastSeenAt`.
- Resolution requires: known hash, not revoked, not expired, and an ACTIVE user.
- `lastSeenAt` updates are throttled to 5 minutes to bound write amplification.
- Logout revokes the session row and clears both cookies.
- Session TTL is configured by `SESSION_TTL_HOURS` (default 8h).
- Expired/revoked rows for the same user are opportunistically deleted on new session creation.

### Cookies and CSRF

- `nova_session`: HttpOnly, `SameSite=Lax`, `Path=/`, `Secure` in production, `Max-Age` = session TTL.
- `nova_csrf`: readable by the browser (double-submit), `SameSite=Lax`, `Secure` in production.
- CSRF token format `nonce.signature`, signature = HMAC-SHA256(`CSRF_SECRET`, nonce). Comparison uses `timingSafeEqual`.
- `CsrfGuard` runs globally and requires matching cookie + `X-CSRF-Token` header with a valid signature on all non-safe methods when `AUTH_MODE=local-session`.
- `CSRF_SECRET` is mandatory for `local-session` and validated to be at least 32 characters.
- Auth responses set `Cache-Control: no-store`.

### Rate limiting

- Login attempts are counted in Redis in a fixed window keyed by `sha256(client_ip|normalized_email)` — raw IP/email are not stored in Redis.
- Configurable with `LOGIN_RATE_LIMIT_MAX` and `LOGIN_RATE_LIMIT_WINDOW_SECONDS`.
- When Redis is unavailable the limiter fails open and logs a warning. PostgreSQL remains the authentication authority; a perimeter limiter/WAF is still required.
- There is no per-user account lockout yet.

### Authorization

- Tenant context is resolved server-side from authenticated identity and active memberships.
- `X-Organization-Id` / `X-Property-Id` are selectors only; arbitrary ids cannot authorize access.
- Denials do not reveal whether a tenant exists.
- Permission keys are atomic and checked by `PermissionsGuard`; the frontend may hide UI but never resolves access.
- Organization-role permissions are additive; organization-wide property access requires `property.read`.
- Every tenant-scoped query includes `organizationId` (and `propertyId` where applicable).
- Cross-tenant references are blocked by composite foreign keys at the database layer.

### Input and output

- Global `ValidationPipe` with `whitelist` and `forbidNonWhitelisted`: unknown body/query fields are rejected.
- Error envelope only exposes `code`, `message`, safe `details` and `correlationId`; Prisma/database internals are never returned.
- Correlation ids accept only `^[A-Za-z0-9._:-]{8,128}$` or are regenerated.
- Request logging does not include credentials, session tokens or CSRF tokens.

### Audit and history

- `AuditEvent`, `RoomStatusHistory`, `SecurityEvent` and `ReservationHistory` are append-only; PostgreSQL triggers reject `UPDATE`, `DELETE` and `TRUNCATE`.
- All Phase 2/Phase 3/Phase 4 write endpoints write audit in the same transaction as the mutation.
- Operational and housekeeping transitions also write `RoomStatusHistory`; reservation changes write `ReservationHistory`.
- Audit metadata is capped at 8 KiB in API and DB.

### Guests and reservations (Phase 3)

- Guest profiles are property-scoped and minimized: no birth date, address, financial data or document images. Identity document type/number are optional and must be sent together.
- Guest audit events (`guest.created`, `guest.updated`) record only status and changed field names; contact and document values are never copied to `AuditEvent` or logs.
- Guest search does not auto-merge profiles; deduplication stays a human decision.
- Reservation writes are authorized by `reservations.manage` and scoped by `organizationId` + `propertyId`; cross-property guests and rooms are rejected (`guest_not_found`, `room_not_found`).
- Room assignment locks the `Room` row (`SELECT ... FOR UPDATE`) and validates blocks and overlapping reservations; PostgreSQL's `Reservation_room_date_no_overlap` exclusion constraint is the final authority against double booking.
- Reservation creation supports an idempotency key unique per property; reusing it with a different payload returns `409 idempotency_key_reuse`.
- Cancellation is soft (status + timestamps) and preserves the historical room assignment and append-only history.
- Reservation dates are hotel calendar dates (`date`), not instants; check-in/out times and instant-level availability remain Front Office scope.

### Front Office (Phase 4)

- Check-in/out, room move and no-show require `front_office.manage`; reading the room rack requires `front_office.read`. Incidents use separate `incidents.read`/`incidents.manage` permissions.
- Every transition is property-scoped and runs in a transaction with row locks on the reservation/stay/room; the API never trusts a client-supplied property or stay owner.
- Check-in validates the assigned room belongs to the reservation room type, is active/available, has no active block and has no other in-house stay. `Stay.reservationId` uniqueness is the final guard against double check-in.
- Check-out and no-show are idempotent and preserve append-only `ReservationHistory` plus `AuditEvent`.
- Incidents linked to a stay derive room/reservation from it; contradictory scope, cross-property rooms/reservations and missing rows are rejected. Incident descriptions are free text: operators must not paste card data, credentials or unnecessary guest PII.
- Incidents and stays are never hard-deleted through the API; there is no route to modify audit or reservation history.

### Database integrity

- `pnpm db:verify` asserts that manual constraints, triggers, functions and `btree_gist` are present after migrations.
- Composite tenant FKs and CHECK constraints are documented in `docs/DATABASE.md`.
- Reservation non-overlap is enforced by an exclusion constraint (Phase 3); payment idempotency and financial records are still out of scope.

## Multi-tenant security tests

For every resource type:

- user from Organization A cannot read Organization B resource;
- user from Property A cannot access Property B if membership absent;
- forged organizationId/propertyId in body/query is ignored or rejected;
- IDs guessed from another tenant do not leak existence;
- background jobs carry and validate tenant context.

Current automated coverage:

- `apps/api/test/tenant-isolation.e2e-spec.ts` (identity, properties, audit, cross-org denial);
- `apps/api/test/inventory.e2e-spec.ts` (room types, rooms, housekeeping history immutability, blocks/overlap, property settings, cross-tenant denial);
- `apps/api/test/auth-session.e2e-spec.ts` (CSRF, invalid credentials, session cookie flags, logout revocation, rate limiting, lockout, password reset/verification, MFA, session revocation);
- `apps/api/test/admin.e2e-spec.ts` and `apps/api/test/resilience.e2e-spec.ts` (membership/role administration, security events, scheduler, metrics);
- `apps/api/test/guests-reservations.e2e-spec.ts` (guest CRUD/audit minimization, availability, overlapping and concurrent reservations, block conflicts, idempotency, cancellation history, cross-tenant denial);
- `apps/api/test/front-office.e2e-spec.ts` (room rack, check-in/out idempotency, room move and room-type mismatch, no-show timing, incidents/resolution, permission split, tenant/property isolation).

Registered E2E suites run on per-run isolated PostgreSQL schemas (`pnpm test:e2e:all:isolated`); they never share the seeded development schema.

## Known security limitations

- Local credentials are a transitional mechanism: TOTP MFA, password reset/email verification (hashed one-time tokens), lockout and session administration exist, but there is no email delivery provider, no MFA recovery codes and no final identity provider.
- Login rate limiting is fixed-window, Redis-dependent and fail-open on Redis outage; account lockout in PostgreSQL is the authoritative throttle.
- Sessions are not rotated periodically; self-service and admin revocation exist, but no device labeling or suspicious-session heuristics.
- Membership and role administration are API-only (no UI) and rely on subset/last-admin guards.
- Swagger is enabled whenever `NODE_ENV != production`; do not expose development instances publicly.
- E2E suites require a local/CI PostgreSQL with schema creation privileges and must never target real environments.
- No external penetration test, dependency scanning job or WAF has been observed yet.
- Payment tokenization, financial data, LGPD data-subject workflows and guest-document retention automation are not implemented.

## LGPD design checklist

This document is an engineering baseline, not legal advice.

- Define purpose and lawful basis with the controller/customer.
- Collect only data needed for hotel operations and applicable obligations.
- Define retention and deletion/anonymization policy.
- Provide controlled data export/correction workflows where required.
- Restrict access to identity/document data.
- Encrypt sensitive fields/storage where appropriate; manage keys securely.
- Record access to sensitive records where justified.
- Define processor/subprocessor responsibilities and incident response.
- Keep demo/sandbox data synthetic and isolated.
- Never use production guest data to train or test AI features by default.

Phase 3 stores synthetic guest profiles and reservations in development. Production guest retention, anonymization and data-subject workflows still require product/legal validation; guest documents are minimized and optional.

## Payment safety

- Do not store PAN, CVV or magnetic stripe data.
- Use a payment service provider and tokenization when payment integration is approved.
- Store only provider reference, amount, currency, method metadata and status required for reconciliation.
- Verify webhooks cryptographically and make processing idempotent.
- Refunds, reversals and chargebacks require explicit domain workflows and audit.

## Import safety

- Restrict file types and size.
- Store uploads in private object storage with short-lived access.
- Quarantine and scan before parsing.
- Prevent archive bombs and parser exploits.
- Avoid logging extracted personal data.
- Human review before committing extracted records.
- Delete source files according to retention policy.
