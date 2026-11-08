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

## Multi-tenant security tests

For every resource type:
- user from Organization A cannot read Organization B resource;
- user from Property A cannot access Property B if membership absent;
- forged organizationId/propertyId in body/query is ignored or rejected;
- IDs guessed from another tenant do not leak existence;
- background jobs carry and validate tenant context.

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
