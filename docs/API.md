# NOVA PMS — API Conventions v0.2

## General

- Base path versionado: `/api/v1` (excepto health: `/health/live`, `/health/ready`).
- JSON request/response.
- OpenAPI/Swagger habilitado en desarrollo.
- DTO validation con whitelist y rechazo de campos desconocidos (`forbidNonWhitelisted`).
- Errores con `code`, `message`, `correlationId` y `details` seguros. Nunca se exponen errores crudos de Prisma/PostgreSQL.
- Paginación cursor-based cuando aplique; límites máximos (`limit` ≤ 100).
- Fechas ISO-8601 con offset en entrada cuando se represente un instante. Fechas hoteleras locales deben declararse como `LocalDate`/fecha calendario y resolverse con timezone de propiedad.
- CORS restringido por `CORS_ORIGINS`; `credentials: true` para cookies de sesión.

## Auth / tenancy

- El usuario autenticado no puede seleccionar libremente un tenant sin validar membership.
- Contexto tenant/property derivado en backend.
- No aceptar `organizationId` como prueba de autorización.
- `X-Organization-Id` (obligatorio en rutas tenant) y `X-Property-Id` (obligatorio en rutas property-scoped) son selectores validados, no claims.
- Denegaciones no revelan si un tenant existe.

### Modos de autenticación (`AUTH_MODE`)

| Modo            | Uso                                | Mecanismo                                                |
| --------------- | ---------------------------------- | -------------------------------------------------------- |
| `local-session` | Transición controlada / staging    | Cookie `nova_session` HttpOnly validada contra `Session` |
| `dev-header`    | Solo desarrollo y tests            | Header `X-Dev-User-Id` validado contra PostgreSQL        |
| `disabled`      | Apagar autenticación en un entorno | Toda ruta protegida responde `401 unauthenticated`       |

`dev-header` es rechazado al arrancar y por el guard cuando `NODE_ENV=production`.

### Sesiones locales y CSRF

Flujo:

1. `GET /api/v1/auth/csrf` devuelve `{ csrfToken }` y setea la cookie `nova_csrf` (legible por JS, no HttpOnly).
2. El cliente envía el token en el header `X-CSRF-Token` y la cookie viaja automáticamente.
3. `POST /api/v1/auth/login` valida credenciales, rate limit y CSRF; responde con la cookie `nova_session` (HttpOnly, `SameSite=Lax`, `Secure` en producción) y un nuevo `csrfToken`.
4. Las mutaciones (`POST`, `PATCH`, `PUT`, `DELETE`) requieren cookie y header CSRF coincidentes y firmados con HMAC-SHA256.

Detalles:

- Contraseñas con `scrypt` (parámetros embebidos en el hash versionado).
- Solo se persiste el SHA-256 del token de sesión.
- `POST /api/v1/auth/logout` revoca la `Session` y limpia cookies.
- El login está limitado por ventana fija por IP + email normalizado (Redis). Si Redis falla, el limitador degrada y registra un warning.
- `Cache-Control: no-store` en respuestas de auth.

### Cabeceras por modo

| Cabecera               | `local-session`       | `dev-header` (no prod) |
| ---------------------- | --------------------- | ---------------------- |
| `Cookie: nova_session` | Obligatoria           | Ignorada               |
| `X-CSRF-Token`         | Obligatoria en writes | Ignorada               |
| `X-Dev-User-Id`        | Ignorada              | Obligatoria (UUID)     |
| `X-Organization-Id`    | Obligatoria en tenant | Obligatoria en tenant  |
| `X-Property-Id`        | Según endpoint        | Según endpoint         |

### Permisos

| Permiso                          | Alcance         | Uso                                                                                                |
| -------------------------------- | --------------- | -------------------------------------------------------------------------------------------------- |
| `property.read`                  | Org o propiedad | Acceder a propiedades; si lo otorga el rol de organización, habilita todas las propiedades activas |
| `property.manage`                | Org o propiedad | Actualizar settings de la propiedad                                                                |
| `organization.properties.manage` | Organización    | Crear propiedades y administrarlas                                                                 |
| `audit.read`                     | Org o propiedad | Leer `AuditEvent` con contexto de propiedad                                                        |
| `inventory.read`                 | Org o propiedad | Leer room types, rooms, blocks e historial                                                         |
| `inventory.manage`               | Org o propiedad | Crear/actualizar room types, rooms y blocks                                                        |
| `housekeeping.manage`            | Org o propiedad | Transicionar el estado de housekeeping                                                             |
| `guests.read`                    | Org o propiedad | Leer huéspedes y sus datos de contacto mínimos                                                     |
| `guests.manage`                  | Org o propiedad | Crear/actualizar huéspedes                                                                         |
| `reservations.read`              | Org o propiedad | Leer reservas, disponibilidad e historial                                                          |
| `reservations.manage`            | Org o propiedad | Crear, modificar, asignar habitación y cancelar reservas                                           |

Los permisos de organización son aditivos respecto de los de propiedad. Un rol de organización con `property.read` da acceso organization-wide (caso `ORG_ADMIN`); el staff regular mantiene `Membership.roleId = null` y usa `PropertyMembership`.

## Endpoints implementados

### Health

| Método | Ruta            | Guard | Notas                     |
| ------ | --------------- | ----- | ------------------------- |
| GET    | `/health/live`  | —     | Liveness sin dependencias |
| GET    | `/health/ready` | —     | PostgreSQL + Redis        |

### Auth

| Método | Ruta                   | Guard       | Notas                              |
| ------ | ---------------------- | ----------- | ---------------------------------- |
| GET    | `/api/v1/auth/csrf`    | —           | Emite CSRF token + cookie          |
| POST   | `/api/v1/auth/login`   | CSRF        | `200`; setea cookies; rate limited |
| POST   | `/api/v1/auth/logout`  | auth + CSRF | `204`; revoca sesión               |
| GET    | `/api/v1/auth/session` | auth        | `{ user, authentication }`         |

### Identity

| Método | Ruta                    | Guard | Notas                                                |
| ------ | ----------------------- | ----- | ---------------------------------------------------- |
| GET    | `/api/v1/me`            | auth  | Usuario, memberships, roles y propiedades accesibles |
| GET    | `/api/v1/organizations` | auth  | Organizaciones activas del actor                     |

### Properties

| Método | Ruta                                         | Guard         | Permiso                          | Status |
| ------ | -------------------------------------------- | ------------- | -------------------------------- | ------ |
| GET    | `/api/v1/properties`                         | auth + tenant | — (memberships / rol org)        | 200    |
| GET    | `/api/v1/properties/current`                 | auth + tenant | —                                | 200    |
| GET    | `/api/v1/properties/current/operational-day` | auth + tenant | —                                | 200    |
| PATCH  | `/api/v1/properties/current`                 | auth + tenant | `property.manage`                | 200    |
| POST   | `/api/v1/properties`                         | auth + tenant | `organization.properties.manage` | 201    |

`POST /api/v1/properties` crea la propiedad y la `PropertyMembership` del creador en la misma transacción, usando su rol de organización o de propiedad.

`PATCH /api/v1/properties/current` acepta `name`, `timezone` (IANA), `currencyCode` (`[A-Z]{3}`) y `operationalDayStart` (`HH:mm`). Escribe auditoría `property.settings_updated` con before/after.

`GET /api/v1/properties/current/operational-day` responde:

```json
{
  "operationalDate": "2026-11-07",
  "localDate": "2026-11-07",
  "localTime": "23:30",
  "timezone": "America/Sao_Paulo",
  "operationalDayStart": "06:00"
}
```

### Audit

| Método | Ruta                   | Guard         | Permiso      |
| ------ | ---------------------- | ------------- | ------------ |
| GET    | `/api/v1/audit-events` | auth + tenant | `audit.read` |

Filtros: `action`, `entityType`, `entityId`, `cursor`, `limit`. Requiere `X-Property-Id`.

### Inventory

| Método | Ruta                                                   | Guard         | Permiso               | Status |
| ------ | ------------------------------------------------------ | ------------- | --------------------- | ------ |
| GET    | `/api/v1/inventory/room-types`                         | auth + tenant | `inventory.read`      | 200    |
| POST   | `/api/v1/inventory/room-types`                         | auth + tenant | `inventory.manage`    | 201    |
| GET    | `/api/v1/inventory/room-types/:id`                     | auth + tenant | `inventory.read`      | 200    |
| PATCH  | `/api/v1/inventory/room-types/:id`                     | auth + tenant | `inventory.manage`    | 200    |
| GET    | `/api/v1/inventory/rooms`                              | auth + tenant | `inventory.read`      | 200    |
| POST   | `/api/v1/inventory/rooms`                              | auth + tenant | `inventory.manage`    | 201    |
| GET    | `/api/v1/inventory/rooms/:id`                          | auth + tenant | `inventory.read`      | 200    |
| PATCH  | `/api/v1/inventory/rooms/:id`                          | auth + tenant | `inventory.manage`    | 200    |
| POST   | `/api/v1/inventory/rooms/:id/housekeeping-transitions` | auth + tenant | `housekeeping.manage` | 201    |
| GET    | `/api/v1/inventory/rooms/:id/blocks`                   | auth + tenant | `inventory.read`      | 200    |
| POST   | `/api/v1/inventory/rooms/:id/blocks`                   | auth + tenant | `inventory.manage`    | 201    |
| POST   | `/api/v1/inventory/rooms/:id/blocks/:blockId/release`  | auth + tenant | `inventory.manage`    | 200    |
| GET    | `/api/v1/inventory/rooms/:id/history`                  | auth + tenant | `inventory.read`      | 200    |

Notas:

- `GET /inventory/rooms` acepta `roomTypeId`, `status`, `housekeepingState`, `operationalState`, `search`, `cursor`, `limit`.
- Crear/actualizar room type o room y crear/liberar blocks escribe `AuditEvent` en la misma transacción.
- Los cambios de estado de habitación (operativo y housekeeping) escriben `RoomStatusHistory` (append-only) y auditoría.
- Los bloqueos activos de una misma habitación no pueden solaparse: `409 room_block_overlap`; la garantía final es una exclusion constraint PostgreSQL.
- `POST /rooms/:id/blocks/:blockId/release` responde `200` y exige que el bloque esté `ACTIVE`.

### Guests

| Método | Ruta                 | Guard         | Permiso         | Status |
| ------ | -------------------- | ------------- | --------------- | ------ |
| GET    | `/api/v1/guests`     | auth + tenant | `guests.read`   | 200    |
| POST   | `/api/v1/guests`     | auth + tenant | `guests.manage` | 201    |
| GET    | `/api/v1/guests/:id` | auth + tenant | `guests.read`   | 200    |
| PATCH  | `/api/v1/guests/:id` | auth + tenant | `guests.manage` | 200    |

- Campos: `fullName` (2–160), `email` (normalizado a minúsculas), `phone`, `documentType` + `documentNumber` (solo juntos) y `notes` (≤ 2000).
- `GET /guests` acepta `search` (nombre/email/teléfono/documento), `status`, `cursor`, `limit`. La búsqueda es asistida: no fusiona perfiles automáticamente.
- No hay borrado físico; el ciclo de vida usa `status = DISABLED`.
- Cada alta/edición escribe `AuditEvent` sin copiar contacto ni documento al trail.

### Reservations

| Método | Ruta                                       | Guard         | Permiso               | Status |
| ------ | ------------------------------------------ | ------------- | --------------------- | ------ |
| GET    | `/api/v1/reservations/availability`        | auth + tenant | `reservations.read`   | 200    |
| GET    | `/api/v1/reservations`                     | auth + tenant | `reservations.read`   | 200    |
| POST   | `/api/v1/reservations`                     | auth + tenant | `reservations.manage` | 201    |
| GET    | `/api/v1/reservations/:id`                 | auth + tenant | `reservations.read`   | 200    |
| PATCH  | `/api/v1/reservations/:id`                 | auth + tenant | `reservations.manage` | 200    |
| POST   | `/api/v1/reservations/:id/room-assignment` | auth + tenant | `reservations.manage` | 201    |
| POST   | `/api/v1/reservations/:id/cancel`          | auth + tenant | `reservations.manage` | 201    |
| GET    | `/api/v1/reservations/:id/history`         | auth + tenant | `reservations.read`   | 200    |

Fechas y ocupación:

- `checkInDate`/`checkOutDate` son fechas calendario `YYYY-MM-DD` de la propiedad. La estancia ocupa `[checkInDate, checkOutDate)`; `checkOutDate > checkInDate`; máximo 366 noches; no se crea una reserva que empiece en el pasado.
- `adults` 1–20, `children` 0–20 y la suma no puede exceder la capacidad del room type (`409 occupancy_exceeds_room_type`).
- `roomId` es opcional al crear. Una reserva confirmada puede modificarse (`PATCH`) o recibir habitación (`room-assignment`) solo mientras esté `CONFIRMED`. `CHECKED_IN`/`CHECKED_OUT` pertenecen a Front Office.
- `POST /reservations` acepta `idempotencyKey` (8–64). Repetir la misma key con el mismo payload devuelve la reserva original; con payload distinto responde `409 idempotency_key_reuse`.
- `GET /reservations/availability?checkInDate&checkOutDate&roomTypeId?` excluye habitaciones inactivas, no `AVAILABLE`, con bloqueo activo solapado o con reserva activa solapada.
- Asignar habitación valida room type (`409 room_type_mismatch`), bloqueos (`409 room_block_overlap`) y solapamiento de reservas (`409 room_not_available`) dentro de una transacción con `SELECT ... FOR UPDATE` sobre la habitación.
- Cancelar es idempotente y preserva la habitación en la reserva; el estado `CANCELLED` libera el intervalo para la exclusion constraint.
- `ReservationHistory` es append-only (`reservation.created`, `reservation.updated`, `reservation.room_assigned`, `reservation.cancelled`).

Errores específicos: `guest_not_found`, `invalid_guest_document`, `invalid_calendar_date`, `invalid_stay_window`, `reservation_in_past`, `reservation_too_long`, `invalid_date_filter`, `reservation_not_found`, `room_not_available`, `room_type_mismatch`, `room_inactive`, `occupancy_exceeds_room_type`, `reservation_not_editable`, `reservation_not_assignable`, `reservation_not_cancellable`, `reservation_conflict`, `idempotency_key_reuse`.

### Housekeeping workflow

`DIRTY → CLEANING → CLEAN → INSPECTED → DIRTY`.

- `CLEANING → DIRTY`, `CLEAN → DIRTY` permitidos para reprocesos.
- Cualquier otro salto responde `422 invalid_housekeeping_transition` con `details.allowed`.
- El estado de ocupación no se mezcla con housekeeping.

### Room blocks

- `type`: `OUT_OF_ORDER` o `OUT_OF_SERVICE`.
- `startsAt`/`endsAt`: instantes ISO-8601; `endsAt > startsAt`; máximo 366 días; el bloqueo debe terminar en el futuro al crearse.
- El estado operativo de la habitación se deriva de los bloqueos activos y se reconcilia de forma perezosa al leer habitaciones.

## Códigos de error

| HTTP | `code`                                      | Contexto                                                  |
| ---- | ------------------------------------------- | --------------------------------------------------------- |
| 400  | `validation_failed`                         | DTO inválido; `details` lista los mensajes                |
| 400  | `invalid_tenant_context`                    | Falta/ilegal `X-Organization-Id`                          |
| 400  | `invalid_property_context`                  | Falta/ilegal `X-Property-Id`                              |
| 400  | `property_context_required`                 | Endpoint exige contexto de propiedad                      |
| 400  | `empty_update`                              | PATCH sin campos                                          |
| 400  | `invalid_room_block_interval`               | Intervalo inválido o invertido                            |
| 400  | `room_block_too_long`                       | Bloqueo > 366 días                                        |
| 400  | `room_block_interval_in_past`               | Bloqueo termina en el pasado                              |
| 401  | `unauthenticated`                           | Sin sesión/actor válido                                   |
| 401  | `invalid_credentials`                       | Email/contraseña incorrectos (mensaje genérico)           |
| 403  | `csrf_token_invalid`                        | Cookie/header CSRF ausente, distintos o no firmados       |
| 403  | `organization_access_denied`                | Sin membership activa en la organización                  |
| 403  | `property_access_denied`                    | Sin acceso a la propiedad                                 |
| 403  | `permission_denied`                         | Falta el permiso requerido                                |
| 403  | `tenant_context_required`                   | Ruta tenant sin contexto resuelto                         |
| 403  | `property_role_required`                    | Crear propiedad sin rol asignable                         |
| 404  | `property_not_found`                        | Propiedad inexistente en la organización                  |
| 404  | `room_type_not_found`                       | Room type inexistente en la propiedad                     |
| 404  | `room_not_found`                            | Habitación inexistente en la propiedad                    |
| 404  | `room_block_not_found`                      | Bloqueo inexistente en la habitación                      |
| 409  | `property_code_conflict`                    | Código de propiedad duplicado                             |
| 409  | `room_type_code_conflict`                   | Código de room type duplicado                             |
| 409  | `room_number_conflict`                      | Número de habitación duplicado                            |
| 409  | `room_block_overlap`                        | Solapamiento con bloqueo activo                           |
| 409  | `room_block_not_active`                     | Liberar un bloqueo no activo                              |
| 400  | `invalid_calendar_date`                     | Fecha de reserva mal formada o imposible                  |
| 400  | `invalid_stay_window`                       | `checkOutDate` no posterior a `checkInDate`               |
| 400  | `reservation_in_past`                       | La reserva empieza antes de hoy                           |
| 400  | `invalid_date_filter`                       | Rango `fromDate`/`toDate` inválido                        |
| 400  | `invalid_guest_document`                    | Tipo y número de documento no enviados juntos             |
| 404  | `guest_not_found`                           | Huésped inexistente o inactivo en la propiedad            |
| 404  | `reservation_not_found`                     | Reserva inexistente en la propiedad                       |
| 409  | `room_not_available`                        | Habitación ya reservada para esas fechas                  |
| 409  | `room_type_mismatch`                        | La habitación no corresponde al room type                 |
| 409  | `room_inactive`                             | Habitación no activa                                      |
| 409  | `occupancy_exceeds_room_type`               | Ocupación superior a la capacidad del room type           |
| 400  | `reservation_too_long`                      | Estancia > 366 noches                                     |
| 409  | `reservation_not_editable`                  | Modificar una reserva no confirmada                       |
| 409  | `reservation_not_assignable`                | Asignar habitación a una reserva no confirmada            |
| 409  | `room_type_change_requires_unassigned_room` | Cambiar room type con habitación asignada                 |
| 409  | `reservation_not_cancellable`               | Cancelar una reserva no confirmada                        |
| 409  | `reservation_conflict`                      | Código de reserva duplicado                               |
| 409  | `idempotency_key_reuse`                     | Misma key con payload distinto                            |
| 422  | `invalid_housekeeping_transition`           | Transición de housekeeping no permitida                   |
| 429  | `rate_limited`                              | Demasiados intentos de login; `details.retryAfterSeconds` |
| 503  | `auth_mode_unavailable`                     | Login local deshabilitado                                 |

## Idempotencia

`POST /api/v1/reservations` acepta `idempotencyKey` por body (8–64 caracteres).

- La key es única por propiedad (`Reservation.propertyId + idempotencyKey`).
- Misma key + mismo payload (`guestId`, `roomTypeId`, fechas): devuelve la reserva original.
- Misma key + payload distinto: `409 idempotency_key_reuse`.
- La reserva y su historial se crean en la misma transacción.

El resto de endpoints de escritura todavía no acepta `Idempotency-Key`; los duplicados se cubren con constraints únicas y la exclusión de solapamientos.

## Endpoints previstos (no implementados)

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
