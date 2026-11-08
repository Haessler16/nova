# NOVA PMS — API Conventions v0.1

## General

- Base path versionado: `/api/v1`.
- JSON request/response.
- OpenAPI/Swagger habilitado en desarrollo.
- DTO validation con whitelist y rechazo de campos desconocidos.
- Errores con `code`, `message`, `correlationId` y `details` seguros.
- Paginación cursor-based cuando aplique; límites máximos.
- Fechas ISO-8601 con offset en entrada cuando se represente un instante. Fechas hoteleras locales deben declararse como `LocalDate`/fecha calendario y resolverse con timezone de propiedad.

## Auth / tenancy

- El usuario autenticado no puede seleccionar libremente un tenant sin validar membership.
- Contexto tenant/property derivado en backend.
- No aceptar `organizationId` como prueba de autorización.
- Códigos sugeridos: `401 unauthenticated`, `403 forbidden`, `404 not_found`, `409 conflict`, `422 business_rule_violation`.

## Idempotencia

Para endpoints que crean efectos no repetibles, aceptar `Idempotency-Key`.
- Persistir key, scope tenant, actor, request hash, estado y resultado.
- Misma key + mismo request: devolver resultado previo.
- Misma key + request distinto: `409 idempotency_key_reused`.
- La creación de la operación y su idempotency record deben ser atómicas.

## Endpoints previstos (no implementar todos en Foundation)

### Foundation
- `GET /health/live`
- `GET /health/ready`
- `GET /api/v1/me`
- `GET /api/v1/organizations`
- `GET /api/v1/properties`
- `POST /api/v1/organizations` (solo flujo de provisionamiento autorizado)
- `POST /api/v1/properties`
- `GET /api/v1/audit-events` (permiso requerido)

### Inventory
- `GET /api/v1/room-types`
- `POST /api/v1/room-types`
- `GET /api/v1/rooms`
- `POST /api/v1/rooms`

### Guests
- `GET /api/v1/guests`
- `POST /api/v1/guests`
- `GET /api/v1/guests/:id`
- `PATCH /api/v1/guests/:id`

### Reservations
- `GET /api/v1/availability`
- `GET /api/v1/reservations`
- `POST /api/v1/reservations`
- `GET /api/v1/reservations/:id`
- `PATCH /api/v1/reservations/:id`
- `POST /api/v1/reservations/:id/cancel`
- `POST /api/v1/reservations/:id/assign-room`

### Front Office
- `GET /api/v1/front-office/room-rack`
- `POST /api/v1/stays/:id/check-in`
- `POST /api/v1/stays/:id/check-out`

### Folio / Cash / Night audit
- `GET /api/v1/folios/:id`
- `POST /api/v1/folios/:id/charges`
- `POST /api/v1/folios/:id/payments`
- `POST /api/v1/cash-sessions`
- `POST /api/v1/cash-sessions/:id/close`
- `POST /api/v1/operational-days/:id/close`

## API acceptance principles

- Tenant scoping enforced on every endpoint.
- No mass assignment.
- No raw Prisma error leaked to client.
- Conflict responses are deterministic and actionable.
- All write operations have authorization, validation and audit coverage.
