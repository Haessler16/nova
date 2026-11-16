# NOVA PMS — API Conventions v0.2

## General

- Base path versionado: `/api/v1` (excepto health: `/health/live`, `/health/ready`, `/health/version`).
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
| `front_office.read`              | Org o propiedad | Leer room rack, llegadas, salidas e in-house                                                       |
| `front_office.manage`            | Org o propiedad | Check-in, check-out, room move y no-show                                                           |
| `incidents.read`                 | Org o propiedad | Leer notas e incidencias operativas                                                                |
| `incidents.manage`               | Org o propiedad | Crear y resolver notas/incidencias                                                                 |
| `documents.read`                 | Org o propiedad | Leer plantillas, historial y metadata de documentos generados                                      |
| `documents.generate`             | Org o propiedad | Previsualizar y generar documentos, y descargar sus PDF                                            |
| `documents.manage`               | Org o propiedad | Registrar recepción de firma física y eventos de impresión/reimpresión                             |
| `reports.read`                   | Org o propiedad | Leer el catálogo y ejecutar reportes operativos no financieros                                     |
| `reports.financial`              | Org o propiedad | Ejecutar y exportar la caja diaria y reportes financieros                                          |

Los permisos de organización son aditivos respecto de los de propiedad. Un rol de organización con `property.read` da acceso organization-wide (caso `ORG_ADMIN`); el staff regular mantiene `Membership.roleId = null` y usa `PropertyMembership`.

## Endpoints implementados

### Health

| Método | Ruta              | Guard | Notas                                                                          |
| ------ | ----------------- | ----- | ------------------------------------------------------------------------------ |
| GET    | `/health/live`    | —     | Liveness sin dependencias                                                      |
| GET    | `/health/ready`   | —     | PostgreSQL + Redis                                                             |
| GET    | `/health/version` | —     | Versión, commit, uptime, timezone y última migración; sin secretos ni row data |

### Auth

| Método | Ruta                   | Guard       | Notas                                        |
| ------ | ---------------------- | ----------- | -------------------------------------------- |
| GET    | `/api/v1/auth/mode`    | —           | `{ authMode }` para elegir pantalla de login |
| GET    | `/api/v1/auth/csrf`    | —           | Emite CSRF token + cookie                    |
| POST   | `/api/v1/auth/login`   | CSRF        | `200`; setea cookies; rate limited           |
| POST   | `/api/v1/auth/logout`  | auth + CSRF | `204`; revoca sesión                         |
| GET    | `/api/v1/auth/session` | auth        | `{ user, authentication }`                   |

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

Filtros: `action`, `entityType`, `entityId`, `actorUserId`, `fromDate`, `toDate` (`YYYY-MM-DD`, días calendario en la timezone IANA de la propiedad; el día final es inclusivo), `cursor`, `limit` (≤ 100). Requiere `X-Property-Id`. Devuelve `nextCursor` para feed de soporte/conciliación. Una timezone inválida responde `invalid_property_timezone`.

### Exports

| Método | Ruta                           | Guard         | Permiso             | Formato          |
| ------ | ------------------------------ | ------------- | ------------------- | ---------------- |
| GET    | `/api/v1/exports/guests`       | auth + tenant | `guests.read`       | `text/csv` UTF-8 |
| GET    | `/api/v1/exports/reservations` | auth + tenant | `reservations.read` | `text/csv` UTF-8 |
| GET    | `/api/v1/exports/folios`       | auth + tenant | `folio.read`        | `text/csv` UTF-8 |

- Solo lectura, limitadas a la organización/propiedad autenticadas; `Cache-Control: no-store`.
- Máximo 5000 filas (`400 export_too_large`); acotar con los mismos filtros de lista (`search`, `status`, fechas).
- En reservas, `fromDate`/`toDate` son fechas calendario con solapamiento `[fromDate, toDate)` (el `toDate` no se incluye), igual que `GET /reservations`. En folios, `date` es un único día calendario en la timezone de la propiedad, convertido a `[inicio, inicio+1 día)`.
- Un rango invertido o una fecha imposible responde `invalid_date_filter` / `invalid_calendar_date`.
- CSV con BOM UTF-8, comillas RFC 4180 y neutralización de fórmulas de hoja de cálculo.
- El nombre descargado es `nova-<guests|reservations|folios>-YYYY-MM-DD.csv`; la fecha se calcula en la timezone de la propiedad, no en UTC.
- Cada exportación escribe un `AuditEvent` (`export.guests`, `export.reservations`, `export.folios`) con `{ rowCount }`, sin datos personales.
- La UI expone "Exportar CSV" en Huéspedes, Reservas y Folios respetando los filtros visibles.

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
| POST   | `/api/v1/inventory/rooms/:id/assignment-leases`        | auth + tenant | `front_office.manage` | 201    |
| POST   | `/api/v1/inventory/rooms/:id/assignment-leases/:leaseId/renew` | auth + tenant | `front_office.manage` | 200 |
| DELETE | `/api/v1/inventory/rooms/:id/assignment-leases/:leaseId` | auth + tenant | `front_office.manage` | 204   |

Notas:

- `GET /inventory/rooms` acepta `roomTypeId`, `status`, `housekeepingState`, `operationalState`, `occupancy` (`VACANT`/`OCCUPIED`), `floor`, `building`, `minCapacity`, `search`, `cursor` y `limit`. Los filtros se combinan con AND y se aplican en el servidor antes de paginar.
- La respuesta incluye `summary` (total, libres, ocupadas, contadores de housekeeping y fuera de orden/servicio) y `facets` (pisos y edificios presentes en la propiedad). Cada habitación agrega `occupancy` derivada de una estancia `IN_HOUSE`, `currentStay`, `nextArrival`, `activeBlock`, `updatedBy` y `lease`. La ocupación nunca se deriva de housekeeping.
- El lease es efímero y solo coordina la selección en UI: `POST` responde `201` con `{ leaseId, roomId, ownerUserId, ownerDisplayName, reservationId, createdAt, expiresAt }`; `renew` y `DELETE` exigen ser el dueño y el `leaseId` vigente. TTL por defecto 120 s (`ROOM_ASSIGNMENT_LEASE_TTL_SECONDS`, 1–600). Un lease ausente o expirado no bloquea una operación confirmada; PostgreSQL sigue siendo la autoridad de la asignación.
- `POST /reservations/:id/room-assignment` rechaza con `409 room_lease_held` si otro actor mantiene un lease vigente sobre la habitación. La misma validación es advisory: el lease puede expirar entre la lectura y el commit, y la constraint de solapamiento decide.
- `GET /front-office/reservations/:id/check-in-readiness` incluye `lease` en cada habitación para que el wizard muestre quién la está seleccionando.
- Crear/actualizar room type o room y crear/liberar blocks escribe `AuditEvent` en la misma transacción.
- Los cambios de estado de habitación (operativo y housekeeping) escriben `RoomStatusHistory` (append-only) y auditoría.
- Los bloqueos activos de una misma habitación no pueden solaparse: `409 room_block_overlap`; la garantía final es una exclusion constraint PostgreSQL.
- `POST /rooms/:id/blocks/:blockId/release` responde `200` y exige que el bloque esté `ACTIVE`.

### Guests

| Método | Ruta                               | Guard         | Permiso         | Status |
| ------ | ---------------------------------- | ------------- | --------------- | ------ |
| GET    | `/api/v1/guests`                   | auth + tenant | `guests.read`   | 200    |
| POST   | `/api/v1/guests`                   | auth + tenant | `guests.manage` | 201    |
| GET    | `/api/v1/guests/:id`               | auth + tenant | `guests.read`   | 200    |
| PATCH  | `/api/v1/guests/:id`               | auth + tenant | `guests.manage` | 200    |
| POST   | `/api/v1/guests/import/preview`    | auth + tenant | `guests.manage` | 201    |
| POST   | `/api/v1/guests/import`            | auth + tenant | `guests.manage` | 201    |
| GET    | `/api/v1/guests/:id/notes`         | auth + tenant | `guests.read`   | 200    |
| POST   | `/api/v1/guests/:id/notes`         | auth + tenant | `guests.manage` | 201    |
| PATCH  | `/api/v1/guests/:id/notes/:noteId` | auth + tenant | `guests.manage` | 200    |

- Campos: `fullName` (2–160), `email` (normalizado a minúsculas), `phone`, `documentType` + `documentNumber` (solo juntos) y `notes` (≤ 2000).
- `GET /guests` acepta `search` (nombre/email/teléfono/documento), `status`, `cursor`, `limit`. La búsqueda es asistida: no fusiona perfiles automáticamente.
- No hay borrado físico; el ciclo de vida usa `status = DISABLED`.
- Cada alta/edición escribe `AuditEvent` sin copiar contacto ni documento al trail.
- `POST /guests/import/preview` parsea y valida el CSV sin persistir nada; `POST /guests/import` revalida, exige `idempotencyKey` (8–64) y confirma todo o nada. Límite: 512 KB y 500 filas; delimita con coma o punto y coma.
- La clave es única por propiedad: repetir el mismo contenido devuelve el mismo `importId` con `replayed: true`; usarla con otro contenido responde `409 idempotency_key_reused`.
- `GuestImport` no almacena el CSV; la auditoría `guest.imported` guarda solo conteos.

Errores de importación: `guest_import_invalid_rows`, `guest_import_too_large`, `guest_import_too_many_rows`, `guest_import_empty`, `guest_import_unknown_column`, `guest_import_missing_column`, `guest_import_unterminated_quote`, `idempotency_key_reused`.

Notas persistentes del huésped:

- `GET /guests/:id/notes` acepta `includeInactive=true`; por defecto devuelve sólo notas activas y no vencidas.
- `POST` acepta `body` (2–2000), `category`, `priority`, `visibility`, `purpose` (≤ 64) y `expiresAt` ISO-8601. Son independientes de las instrucciones de reserva y no se copian automáticamente a una reserva.
- `PATCH /guests/:id/notes/:noteId` edita el contenido; desactivar se representa con `isActive=false`. La visibilidad se filtra en el servidor y las categorías confidenciales sólo son legibles por roles con `audit.read`, `property.manage` u `organization.properties.manage`.
- Errores: `guest_not_found`, `guest_note_not_found`, `instruction_visibility_forbidden`, `instruction_confidential_forbidden`, `invalid_date`.

### Reservations

| Método | Ruta                                                 | Guard         | Permiso                                 | Status |
| ------ | ---------------------------------------------------- | ------------- | --------------------------------------- | ------ |
| GET    | `/api/v1/reservations/availability`                  | auth + tenant | `reservations.read`                     | 200    |
| GET    | `/api/v1/reservations`                               | auth + tenant | `reservations.read`                     | 200    |
| POST   | `/api/v1/reservations`                               | auth + tenant | `reservations.manage`                   | 201    |
| GET    | `/api/v1/reservations/:id`                           | auth + tenant | `reservations.read`                     | 200    |
| PATCH  | `/api/v1/reservations/:id`                           | auth + tenant | `reservations.manage`                   | 200    |
| POST   | `/api/v1/reservations/:id/room-assignment`           | auth + tenant | `reservations.manage`                   | 201    |
| POST   | `/api/v1/reservations/:id/cancel`                    | auth + tenant | `reservations.manage`                   | 201    |
| GET    | `/api/v1/reservations/:id/history`                   | auth + tenant | `reservations.read`                     | 200    |
| GET    | `/api/v1/reservations/:id/party`                     | auth + tenant | `reservations.read` + `guests.read`     | 200    |
| POST   | `/api/v1/reservations/:id/party`                     | auth + tenant | `reservations.manage` + `guests.manage` | 201    |
| PATCH  | `/api/v1/reservations/:id/party/:reservationGuestId` | auth + tenant | `reservations.manage` + `guests.manage` | 200    |
| DELETE | `/api/v1/reservations/:id/party/:reservationGuestId` | auth + tenant | `reservations.manage` + `guests.manage` | 200    |

Listado y búsqueda operativa:

- `GET /reservations` devuelve `{ items, nextCursor }`. `limit` va de 1 a 100 (default 50) y `cursor` es el `id` de la última reserva de la página anterior; el orden es `checkInDate ASC, id ASC`.
- Filtros: `search` (código de reserva, nombre del huésped principal o número de UH; insensible a mayúsculas, con nombres sin acentos), `status`, `guestId`, `roomTypeId`, `roomId`, `fromDate`/`toDate` (solapamiento con `[checkInDate, checkOutDate)`).
- `search` resuelve acentos en el nombre del huésped con la extensión PostgreSQL `unaccent` (por ejemplo `jose` encuentra `José`) y combina esos IDs con el mismo `OR` y el scoping de organización/propiedad; códigos y UH se comparan por `contains` y los demás filtros se aplican en la misma consulta.

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

Fiesta de la reserva (FNRH):

- `GET /reservations/:id/party` devuelve `primary`, `companions`, `summary` (`adults`, `minors`, `unknown`, `declaredAdults`, `declaredChildren`) y `readiness` (`checkIn: ALLOWED | BLOCKED`, `fnrh: READY | INCOMPLETE | BLOCKED`, `codes`, `legalCodes`).
- La fiesta sólo se edita mientras la reserva está `CONFIRMED` (`409 reservation_party_not_editable`). Debe existir exactamente un `PRIMARY` que coincida con `Reservation.guestId`; no se puede quitar (`409 primary_guest_cannot_be_removed`) ni duplicar un huésped (`409 guest_already_in_party`).
- `POST` acepta un `guestId` existente o datos mínimos para crear el huésped (`fullName` 2–160; email, teléfono, documento y `birthDate` opcionales). `birthDate` usa `YYYY-MM-DD` y la edad se calcula a la fecha de check-in, no a la fecha actual.
- Menores y personas con incapacidad legal exigen un responsable adulto y capaz de la misma fiesta; los menores exigen además `minorSupervision`. `UNACCOMPANIED_AUTHORIZED` exige `authorizationReference`. La fiesta no puede superar la capacidad del room type (`400 party_exceeds_room_capacity`).
- `adults`/`children` se recalculan desde la fiesta; no son una fuente independiente de identidades. El check-in hotelero sólo se bloquea por códigos legales de la fiesta, no por una FNRH incompleta.

Errores específicos: `reservation_not_found`, `reservation_party_not_editable`, `guest_not_found`, `guest_name_required`, `guest_already_primary`, `guest_already_in_party`, `birth_date_required`, `primary_must_be_adult`, `primary_guest_cannot_be_removed`, `guest_has_dependents`, `minor_cannot_be_legal_incapacity`, `responsible_required`, `responsible_not_in_party`, `responsible_must_be_adult`, `minor_supervision_required`, `authorization_reference_required`, `invalid_guest_document`, `party_exceeds_room_capacity`.

### Notas e instrucciones de reserva

| Método | Ruta                                                                                  | Guard         | Permiso               | Status |
| ------ | ------------------------------------------------------------------------------------- | ------------- | --------------------- | ------ |
| GET    | `/api/v1/reservations/:reservationId/instructions`                                    | auth + tenant | `reservations.read`   | 200    |
| POST   | `/api/v1/reservations/:reservationId/instructions`                                    | auth + tenant | `reservations.manage` | 201    |
| GET    | `/api/v1/reservations/:reservationId/instructions/:instructionId`                     | auth + tenant | `reservations.read`   | 200    |
| PATCH  | `/api/v1/reservations/:reservationId/instructions/:instructionId`                     | auth + tenant | `reservations.manage` | 200    |
| GET    | `/api/v1/reservations/:reservationId/instructions/:instructionId/events`              | auth + tenant | `reservations.read`   | 200    |
| POST   | `/api/v1/reservations/:reservationId/instructions/:instructionId/acknowledge`         | auth + tenant | `reservations.manage` | 201    |
| POST   | `/api/v1/reservations/:reservationId/instructions/:instructionId/start`               | auth + tenant | `reservations.manage` | 201    |
| POST   | `/api/v1/reservations/:reservationId/instructions/:instructionId/complete`            | auth + tenant | `reservations.manage` | 201    |
| POST   | `/api/v1/reservations/:reservationId/instructions/:instructionId/dismiss`             | auth + tenant | `reservations.manage` | 201    |
| POST   | `/api/v1/reservations/:reservationId/instructions/:instructionId/needs-clarification` | auth + tenant | `reservations.manage` | 201    |
| POST   | `/api/v1/reservations/:reservationId/source-notes/parse`                              | auth + tenant | `reservations.manage` | 201    |
| GET    | `/api/v1/reservations/:reservationId/source-notes`                                    | auth + tenant | `reservations.manage` | 200    |
| POST   | `/api/v1/reservations/:reservationId/source-notes/:sourceNoteId/confirm`              | auth + tenant | `reservations.manage` | 201    |

- Categorías: `PAYMENT`, `MEAL`, `BILLING`, `ROOM`, `ARRIVAL`, `IMPORTANT`, `EXTRA`, `CONFIDENTIAL`, `GENERAL`. Prioridad: `LOW`, `NORMAL`, `HIGH`, `CRITICAL`. Estados: `NEW`, `ACKNOWLEDGED`, `IN_PROGRESS`, `COMPLETED`, `DISMISSED`, `NEEDS_CLARIFICATION`.
- `POST` acepta `title` (2–160), `body` (2–4000), hasta 10 `tags` (≤ 32 cada uno), categoría, prioridad, visibilidad, departamento, usuario asignado, `actionType`, `executionMoment`, `paymentMethod`, `actionDueAt`, `validFrom` y `validUntil` ISO-8601. `validFrom` debe ser anterior a `validUntil` (`400 instruction_invalid_validity`).
- Las transiciones siguen una máquina de estados; una transición no permitida responde `409 instruction_invalid_transition`. Cada cambio escribe un `InstructionEvent` append-only y un `AuditEvent`. Repetir la transición al mismo estado es idempotente.
- `GET` filtra por `status`, `priority`, `category`, `actionType`, `executionMoment`, `includeCompleted`, `cursor` y `limit` (≤ 100). Por defecto excluye `COMPLETED`/`DISMISSED`. La visibilidad se aplica en el servidor: `FRONT_DESK` requiere `front_office.read|manage`, `RESERVATIONS` requiere `reservations.manage`, `FINANCE` requiere `reports.financial` y `MANAGEMENT` requiere `property.manage`, `audit.read` u `organization.properties.manage`. Las instrucciones `CONFIDENTIAL` sólo son legibles por esos últimos roles y su lectura se audita.
- `POST /source-notes/parse` acepta texto de 1–8000 caracteres y sólo genera sugerencias (`requiresHumanConfirmation: true`). El parser pt-BR `pt-br-notes-v1` redacta PAN/CVV, NSU, códigos de autorización y referencias de proveedor antes de persistir, conserva `sourceTextHash` y `contentHash`, y nunca crea pagos, cargos, tarifas ni asignaciones. Es idempotente por `contentHash` + versión del parser.
- `POST /source-notes/:sourceNoteId/confirm` acepta hasta 50 sugerencias y crea instrucciones sólo tras confirmación humana; deduplica por sugerencia y devuelve `created`/`skipped`. No ejecuta la acción descrita: una preautorización queda como instrucción pendiente, nunca como pago realizado.
- Errores: `reservation_not_found`, `instruction_not_found`, `instruction_invalid_transition`, `instruction_invalid_validity`, `instruction_visibility_forbidden`, `instruction_confidential_forbidden`, `source_note_not_found`, `source_note_empty`, `invalid_date`.

### Front Office

| Método | Ruta                                             | Guard         | Permiso               | Status |
| ------ | ------------------------------------------------ | ------------- | --------------------- | ------ |
| GET    | `/api/v1/front-office/overview`                             | auth + tenant | `front_office.read`   | 200    |
| GET    | `/api/v1/front-office/reservations/:id/check-in-readiness`  | auth + tenant | `front_office.read`   | 200    |
| POST   | `/api/v1/front-office/reservations/:id/check-in`            | auth + tenant | `front_office.manage` | 201    |
| POST   | `/api/v1/front-office/reservations/:id/no-show`  | auth + tenant | `front_office.manage` | 201    |
| POST   | `/api/v1/front-office/stays/:id/check-out`       | auth + tenant | `front_office.manage` | 201    |
| POST   | `/api/v1/front-office/stays/:id/room-move`       | auth + tenant | `front_office.manage` | 201    |
| GET    | `/api/v1/front-office/incidents`                 | auth + tenant | `incidents.read`      | 200    |
| POST   | `/api/v1/front-office/incidents`                 | auth + tenant | `incidents.manage`    | 201    |
| POST   | `/api/v1/front-office/incidents/:id/resolve`     | auth + tenant | `incidents.manage`    | 201    |

- `GET /overview?date=YYYY-MM-DD` usa el día operativo de la propiedad (timezone + `operationalDayStart`) por default y devuelve `operationalDate`, `selectedDate`, `isHistorical`, `localDate`, `localTime`, conteos, llegadas, salidas, in-house, no-shows y `roomRack`. La ocupación del room rack se deriva de estancias `IN_HOUSE`; housekeeping y estado operativo son campos independientes.
- Para el día operativo actual, las listas mantienen semántica de trabajo pendiente: llegadas `CONFIRMED`, estancias `IN_HOUSE` y salidas cuya fecha de check-out ya llegó.
- Para una fecha anterior al día operativo, `isHistorical` es `true` y las listas reconstruyen lo ocurrido: llegadas con `checkInDate` ese día (todos los estados salvo `CANCELLED`), estancias activas en algún momento del día (según `checkedInAt`/`checkedOutAt` en la timezone de la propiedad) y check-outs registrados ese día. `roomRack` e incidencias siguen reflejando el estado actual; la UI histórica los oculta y no permite mutaciones.
- La vista histórica no reconstruye la habitación ocupada en ese día si hubo cambios de habitación: muestra la última asignada.
- `GET /reservations/:id/check-in-readiness` es de solo lectura y alimenta el flujo guiado. Devuelve `reservation`, `checkInWindow`, `currentRoomId`, `currentRoomEligible` y `rooms`: unidades `ACTIVE` del room type de la reserva con `housekeepingState`, `operationalState`, `occupancy`, `activeBlock`, `eligible` y `reasons`. Razones posibles: `ROOM_OUT_OF_SERVICE`, `ROOM_BLOCKED`, `ROOM_OCCUPIED`, `ROOM_NOT_AVAILABLE`, `HOUSEKEEPING_NOT_READY`. No reserva, no bloquea la habitación y no sustituye la validación transaccional del check-in.
- `checkInWindow` expone la misma regla que aplica el check-in: `localDate` (fecha calendario de la propiedad), `checkInDate`, `checkOutDate`, `allowed` y `code` (`check_in_too_early`, `check_in_window_elapsed` o `null`). La ventana es `[checkInDate, checkOutDate)`; el día operativo no la altera. El wizard deshabilita el avance cuando `allowed` es `false`, pero el `POST /check-in` vuelve a validarla dentro de la transacción.
- Política de housekeeping del check-in: `DIRTY` y `CLEANING` bloquean; `CLEAN` e `INSPECTED` permiten; `INSPECTION_PENDING` se admite por defecto hasta que el hotel piloto defina lo contrario (decisión reversible, ver `DECISIONS.md`).
- Check-in: solo `CONFIRMED`, con habitación asignada, `ACTIVE`/`AVAILABLE`, sin bloqueo activo y sin otra estancia in-house. Se habilita desde la fecha local de llegada y hasta el check-out. Idempotente: si la reserva ya está `CHECKED_IN`, devuelve la misma estancia. Si la fiesta de la reserva tiene un bloqueo legal (principal menor/incapaz, menor sin responsable o supervisión, autorización faltante) responde `409 reservation_party_check_in_blocked`; una FNRH incompleta o un conteo distinto no bloquean el check-in hotelero.
- Check-out: idempotente, marca `Stay.CHECKED_OUT`, la reserva `CHECKED_OUT` y libera la habitación. Acepta `notes` opcionales (≤ 2000).
- Room move: mismo room type, habitación libre, sin bloqueo ni reserva solapada; actualiza `Stay.roomId`, `Reservation.roomId` e incrementa `moveCount`.
- No-show: solo `CONFIRMED`, después de la fecha de llegada y sin estancia existente. Idempotente para reservas ya `NO_SHOW`.
- Incidencias: `type` (`NOTE`, `MAINTENANCE`, `COMPLAINT`, `SAFETY`, `OTHER`), `severity` (`LOW`, `MEDIUM`, `HIGH`), título 3–120, descripción 3–4000 y alcance opcional por `roomId`, `reservationId` o `stayId`. Si se envía `stayId`, el alcance se deriva de la estancia y no puede contradecirla. Resolver exige `resolution` de 3–4000 y es idempotente.
- Cada acción escribe `ReservationHistory` (check-in/out/move/no-show) y `AuditEvent` en la misma transacción.

Errores específicos: `reservation_room_required`, `check_in_too_early`, `check_in_window_elapsed`, `room_out_of_service`, `room_occupied`, `room_housekeeping_not_ready`, `stay_inconsistent`, `reservation_not_check_in_eligible`, `reservation_party_check_in_blocked`, `stay_not_check_out_eligible`, `stay_not_in_house`, `no_show_too_early`, `reservation_has_stay`, `reservation_not_no_show_eligible`, `stay_not_found`, `incident_not_found`, `incident_scope_mismatch`.

### Folio, caja y night audit

| Método | Ruta                                      | Guard         | Permiso              | Status |
| ------ | ----------------------------------------- | ------------- | -------------------- | ------ |
| GET    | `/api/v1/folios`                          | auth + tenant | `folio.read`         | 200    |
| POST   | `/api/v1/folios`                          | auth + tenant | `folio.manage`       | 201    |
| GET    | `/api/v1/folios/:id`                      | auth + tenant | `folio.read`         | 200    |
| POST   | `/api/v1/folios/:id/charges`              | auth + tenant | `folio.manage`       | 201    |
| POST   | `/api/v1/folios/:id/charges/:lineId/void` | auth + tenant | `folio.manage`       | 201    |
| POST   | `/api/v1/folios/:id/payments`             | auth + tenant | `payment.manage`     | 201    |
| POST   | `/api/v1/folios/:id/cancel`               | auth + tenant | `folio.manage`       | 201    |
| GET    | `/api/v1/cash-sessions`                   | auth + tenant | `cash.read`          | 200    |
| POST   | `/api/v1/cash-sessions`                   | auth + tenant | `cash.manage`        | 201    |
| GET    | `/api/v1/cash-sessions/:id`               | auth + tenant | `cash.read`          | 200    |
| POST   | `/api/v1/cash-sessions/:id/movements`     | auth + tenant | `cash.manage`        | 201    |
| POST   | `/api/v1/cash-sessions/:id/close`         | auth + tenant | `cash.manage`        | 201    |
| GET    | `/api/v1/operational-days`                | auth + tenant | `night_audit.read`   | 200    |
| GET    | `/api/v1/operational-days/:id`            | auth + tenant | `night_audit.read`   | 200    |
| POST   | `/api/v1/operational-days/close`          | auth + tenant | `night_audit.manage` | 201    |
| POST   | `/api/v1/operational-days/:id/reopen`     | auth + tenant | `night_audit.manage` | 201    |

- Un folio se vincula a una estancia o reserva de la misma propiedad; un vínculo cruzado responde `404 stay_not_found`/`reservation_not_found` y un segundo folio activo `409 folio_already_exists`.
- Los cargos son líneas `POSTED`; un void exige motivo y conserva el importe original. Se rechaza si dejaría los pagos por encima de los cargos (`409 void_would_underfund_payments`).
- Los pagos se registran por `method` (`CASH`, `CREDIT_CARD`, `BANK_TRANSFER`, …) sin datos de tarjeta; no se admite sobrepago (`409 payment_exceeds_balance`). Al llegar a saldo cero el folio pasa a `SETTLED` y registra `closedAt`.
- Cancelar exige motivo y cero pagos (`409 folio_has_payments`).
- Una propiedad admite una sola caja abierta (`409 cash_session_already_open`); abrir una fecha operativa futura responde `409 cash_session_future_date`, y mover o cerrar una caja cerrada `409 cash_session_closed`/`cash_session_already_closed`.
- Al cerrar, una diferencia contra el esperado exige `varianceReason` (`400 cash_variance_reason_required`); `expectedCashAmount` se persiste para auditoría.
- `POST /operational-days/close` acepta `force` + `forceReason` para cerrar con bloqueos (`409 night_audit_blocked`), es idempotente por `idempotencyKey` y rechaza un segundo cierre (`409 operational_day_already_closed`). El reopen exige motivo y permite un re-cierre posterior.
- Todas las mutaciones escriben `AuditEvent` en la misma transacción.

Errores específicos: `folio_not_found`, `folio_already_exists`, `folio_not_open`, `folio_link_required`, `folio_link_mismatch`, `folio_cancelled`, `folio_already_settled`, `folio_has_payments`, `folio_line_not_found`, `charge_already_voided`, `payment_exceeds_balance`, `void_would_underfund_payments`, `currency_mismatch`, `cash_session_not_found`, `cash_session_already_open`, `cash_session_already_closed`, `cash_session_closed`, `cash_session_future_date`, `cash_variance_reason_required`, `night_audit_blocked`, `operational_day_already_closed`, `operational_day_in_future`, `operational_close_not_found`.

### Piloto

| Método | Ruta                                | Guard         | Permiso                 | Status |
| ------ | ----------------------------------- | ------------- | ----------------------- | ------ |
| GET    | `/api/v1/pilot/feedback`            | auth + tenant | `pilot.feedback.read`   | 200    |
| POST   | `/api/v1/pilot/feedback`            | auth + tenant | `pilot.feedback.submit` | 201    |
| GET    | `/api/v1/pilot/feedback/:id`        | auth + tenant | `pilot.feedback.read`   | 200    |
| PATCH  | `/api/v1/pilot/feedback/:id/review` | auth + tenant | `pilot.feedback.manage` | 200    |

- El feedback se limita a la organización y propiedad activas; `message` 8–4000, `rating` opcional 1–5 y `context` JSON opcional de hasta 4 KB.
- Revisar es idempotente: un feedback ya revisado se devuelve sin cambios y el mensaje original no se puede editar desde la API.
- No modifica folios, caja ni reservas; cada envío y revisión genera `AuditEvent`.

Errores específicos: `pilot_feedback_not_found`, `pilot_feedback_context_too_large`.

### Documents

| Método | Ruta                                                | Guard         | Permiso              | Status |
| ------ | --------------------------------------------------- | ------------- | -------------------- | ------ |
| GET    | `/api/v1/documents/templates`                       | auth + tenant | `documents.read`     | 200    |
| POST   | `/api/v1/documents/preview`                         | auth + tenant | `documents.generate` | 201    |
| POST   | `/api/v1/documents`                                 | auth + tenant | `documents.generate` | 201    |
| GET    | `/api/v1/documents`                                 | auth + tenant | `documents.read`     | 200    |
| GET    | `/api/v1/documents/:id`                             | auth + tenant | `documents.read`     | 200    |
| GET    | `/api/v1/documents/:id/download`                    | auth + tenant | `documents.read`     | 200    |
| POST   | `/api/v1/documents/:id/physical-signature-received` | auth + tenant | `documents.manage`   | 201    |
| POST   | `/api/v1/documents/:id/print-events`                | auth + tenant | `documents.manage`   | 201    |

- Los endpoints siguen el patrón de tenant por cabeceras (`X-Organization-Id` y `X-Property-Id`) en lugar de repetir `:propertyId` en la ruta. Toda consulta queda limitada a la organización y propiedad resueltas por el servidor.
- Tipos implementados: `GUEST_REGISTRATION`, `LODGING_TERMS` y `CHECKIN_SUMMARY`, en locale `pt-BR`. Las plantillas son property-scoped, versionadas e inmutables en el flujo de emisión: una emisión congela `templateId`, `templateVersion`, el cuerpo de la plantilla y un snapshot de los datos en `GeneratedDocument.snapshot`.
- `preview` renderiza HTML A4 server-side con un renderer fijo; el cuerpo de la plantilla es texto plano escapado y nunca HTML arbitrario. No persiste PDF. `POST /documents` genera el PDF A4 con PDFKit, calcula SHA-256 y guarda los bytes privados en PostgreSQL. La descarga exige autenticación y tenant; no existe URL pública ni firmada.
- `POST /documents` acepta `{ type, reservationId, templateId?, guestId?, locale? }`. `CHECKIN_SUMMARY` exige una estancia existente. Reservas canceladas o no-show no admiten emisión. El número tiene formato `DOC-YYYYMMDD-XXXXXXXXXXXX`.
- `GET /documents?reservationId=&guestId=&stayId=&documentType=&limit=` devuelve metadata e historial, sin bytes ni snapshot. `GET /documents/:id` agrega `printEvents`.
- `POST /documents/:id/print-events` acepta `{ type: PRINT_DIALOG_OPENED | PRINT_CONFIRMED_BY_STAFF | REPRINT_REQUESTED, note? }`. Registra una solicitud/apertura de impresión, no una impresión física exitosa. `DocumentPrintEvent` es append-only y un trigger de PostgreSQL rechaza `UPDATE`/`DELETE`.
- `POST /documents/:id/physical-signature-received` acepta `{ receivedAt?, notes? }`; `receivedById` siempre se deriva del actor autenticado. Es idempotente para documentos ya firmados. No es firma electrónica.
- La descarga responde `application/pdf`, `Content-Disposition: attachment`, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff` y `X-Document-SHA256`. Generación, descarga, preview, firma y eventos de impresión escriben `AuditEvent` sin PII ni contenido del documento.

Errores específicos: `document_template_not_found`, `reservation_not_found`, `document_guest_mismatch`, `document_reservation_state_invalid`, `document_checkin_required`, `document_not_found`, `document_voided`, `invalid_received_at`, `received_at_in_future`, `received_at_before_generation`, `property_context_required`.

### Reports

| Método | Ruta                                 | Guard         | Permiso        | Status |
| ------ | ------------------------------------ | ------------- | -------------- | ------ |
| GET    | `/api/v1/reports`                    | auth + tenant | `reports.read` | 200    |
| GET    | `/api/v1/reports/executions`         | auth + tenant | `reports.read` | 200    |
| POST   | `/api/v1/reports/:reportKey/run`     | auth + tenant | `reports.read` | 201    |
| POST   | `/api/v1/reports/:reportKey/exports` | auth + tenant | `reports.read` | 200    |

- Catálogo fijo: `occupancy`, `arrivals`, `departures`, `reservations` y `cash-daily`. No se aceptan SQL, nombres de columnas ni definiciones de reportes desde el cliente. `cash-daily` exige además `reports.financial` en el servicio, aunque el guard de entrada solo requiera `reports.read`.
- `POST /reports/:reportKey/run` acepta `{ filters: { from, to }, page?, pageSize? }`, con fechas calendario `YYYY-MM-DD`, `pageSize` entre 1 y 100 y un período máximo de 62 días. La respuesta incluye `executionId`, propiedad, timezone, moneda, filtros, resumen, columnas, filas, `totalRows` y paginación.
- La ocupación se calcula al cierre de cada día de la propiedad: habitaciones activas menos habitaciones con bloqueo `OUT_OF_ORDER`/`OUT_OF_SERVICE` vigente son vendibles; se cuentan estancias activas al final del día. Un check-out durante el día no cuenta esa noche. La fórmula exacta y sus límites quedan documentados en el ADR-044 y requieren validación con el hotel piloto.
- Llegadas y salidas usan `checkInDate`/`checkOutDate` calendario. “Previstas” excluye canceladas; “realizadas/concluidas” se deriva de la estancia o del estado actual. El reporte de reservas usa la fecha de creación en la timezone de la propiedad y muestra el estado actual, no una fotografía histórica de cada transición.
- Caja diaria agrupa por fecha operativa. Los movimientos `CASH_IN` y `ADJUSTMENT` suman; `CASH_OUT` y `REFUND` restan. El esperado usa `CashSession.expectedCashAmount` cuando existe y, si no, apertura + movimientos. La diferencia solo se publica para cajas cerradas. Los pagos por otros medios se muestran aparte: un pago registrado no equivale a efectivo recibido.
- Exportación: `POST /reports/:reportKey/exports` con `{ format: PDF | CSV, filters }`. PDF es A4 horizontal con propiedad, período, timezone, generación, filtros, resumen, tabla y paginación. CSV incluye metadata, resumen y tabla; usa BOM UTF-8 y neutralización de fórmulas. Ambos se limitan a 5000 filas y responden `Cache-Control: private, no-store`.
- Cada ejecución/exportación escribe `AuditEvent` (`report.executed`/`report.exported`) con `reportKey`, fechas, formato y conteos; no guarda contenido, filas ni PII. `GET /reports/executions` devuelve las últimas 50 entradas auditadas. No se persisten PDFs de reportes ni existe una tabla de historial separada en v1.
- Errores: `report_not_found`, `report_filter_invalid`, `report_execution_limit_exceeded`, `permission_denied`.

### Admin

Contexto requerido: `X-Organization-Id` (sin `X-Property-Id`).

| Método | Ruta                                                   | Permiso                       |
| ------ | ------------------------------------------------------ | ----------------------------- |
| GET    | `/api/v1/admin/memberships`                            | `organization.members.read`   |
| POST   | `/api/v1/admin/memberships`                            | `organization.members.manage` |
| PATCH  | `/api/v1/admin/memberships/:id`                        | `organization.members.manage` |
| GET    | `/api/v1/admin/memberships/:id/sessions`               | `organization.members.manage` |
| DELETE | `/api/v1/admin/memberships/:id/sessions/:sessionId`    | `organization.members.manage` |
| GET    | `/api/v1/admin/properties/:propertyId/memberships`     | `organization.members.read`   |
| POST   | `/api/v1/admin/properties/:propertyId/memberships`     | `organization.members.manage` |
| PATCH  | `/api/v1/admin/properties/:propertyId/memberships/:id` | `organization.members.manage` |
| GET    | `/api/v1/admin/permissions`                            | `organization.roles.read`     |
| GET    | `/api/v1/admin/roles`                                  | `organization.roles.read`     |
| POST   | `/api/v1/admin/roles`                                  | `organization.roles.manage`   |
| PATCH  | `/api/v1/admin/roles/:id`                              | `organization.roles.manage`   |
| GET    | `/api/v1/admin/security-events`                        | `security.events.read`        |

`GET /admin/permissions` devuelve el catálogo `{ items: string[] }` que la UI usa para editar roles. Los roles de sistema son inmutables (`409 system_role_immutable`); otorgar permisos exige que el actor ya los posea (`403 permission_escalation_denied`).

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
| 404  | `room_lease_not_found`                      | Lease expirado o inexistente                              |
| 409  | `room_lease_held`                           | Otro actor mantiene el lease de la habitación             |
| 409  | `room_lease_conflict`                       | Otro actor ganó la selección concurrente                  |
| 409  | `room_lease_changed`                        | El lease cambió en otra sesión                            |
| 403  | `room_lease_owner_required`                 | Renovar/liberar un lease de otra sesión                   |
| 503  | `room_lease_unavailable`                    | Redis no disponible para coordinar la selección           |
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
| 409  | `reservation_room_required`                 | Check-in sin habitación asignada                          |
| 409  | `check_in_too_early`                        | Check-in antes de la fecha local de llegada               |
| 409  | `check_in_window_elapsed`                   | Check-in en o después de la fecha de salida               |
| 409  | `room_out_of_service`                       | Habitación no disponible operativamente o bloqueada       |
| 409  | `room_occupied`                             | Habitación con otra estancia in-house                     |
| 409  | `stay_inconsistent`                         | Reserva en casa sin registro de estancia                  |
| 409  | `reservation_not_check_in_eligible`         | Reserva no confirmada para check-in                       |
| 409  | `stay_not_check_out_eligible`               | Estancia no in-house para check-out                       |
| 409  | `stay_not_in_house`                         | Room move sobre estancia no in-house                      |
| 409  | `no_show_too_early`                         | No-show antes de vencer la llegada                        |
| 409  | `reservation_has_stay`                      | No-show sobre reserva con estancia                        |
| 409  | `reservation_not_no_show_eligible`          | No-show sobre reserva no confirmada                       |
| 409  | `incident_scope_mismatch`                   | Alcance de incidencia contradictorio                      |
| 404  | `stay_not_found`                            | Estancia inexistente en la propiedad                      |
| 404  | `incident_not_found`                        | Incidencia inexistente en la propiedad                    |
| 422  | `invalid_housekeeping_transition`           | Transición de housekeeping no permitida                   |
| 400  | `folio_link_required`                       | Folio sin estancia ni reserva                             |
| 400  | `folio_link_mismatch`                       | Estancia y reserva no se corresponden                     |
| 400  | `currency_mismatch`                         | Moneda distinta a la del folio o caja                     |
| 400  | `cash_variance_reason_required`             | Cierre de caja con diferencia sin motivo                  |
| 404  | `folio_not_found`                           | Folio inexistente en la propiedad                         |
| 404  | `folio_line_not_found`                      | Cargo inexistente en el folio                             |
| 404  | `cash_session_not_found`                    | Sesión de caja inexistente en la propiedad                |
| 404  | `operational_close_not_found`               | Cierre operativo inexistente en la propiedad              |
| 409  | `folio_already_exists`                      | Ya existe un folio activo para la reserva o estancia      |
| 409  | `folio_not_open`                            | Cargo o void sobre un folio no abierto                    |
| 409  | `folio_cancelled`                           | Pago sobre un folio cancelado                             |
| 409  | `folio_already_settled`                     | Pago sobre un folio ya liquidado                          |
| 409  | `folio_has_payments`                        | Cancelar un folio con pagos                               |
| 409  | `charge_already_voided`                     | Void repetido con un motivo distinto                      |
| 409  | `payment_exceeds_balance`                   | Pago superior al saldo pendiente                          |
| 409  | `void_would_underfund_payments`             | El void dejaría pagos por encima de los cargos            |
| 409  | `cash_session_already_open`                 | La propiedad ya tiene una caja abierta                    |
| 409  | `cash_session_closed`                       | Movimiento sobre una caja cerrada                         |
| 409  | `cash_session_already_closed`               | Cierre repetido con un importe distinto                   |
| 409  | `cash_session_future_date`                  | Apertura para un día operativo futuro                     |
| 409  | `night_audit_blocked`                       | Cierre operativo con bloqueos; `details.blockers`         |
| 409  | `operational_day_already_closed`            | Día operativo ya cerrado                                  |
| 400  | `pilot_feedback_context_too_large`          | Contexto de feedback mayor a 4 KB                         |
| 400  | `export_too_large`                          | Exportación supera 5000 filas; acotar filtros             |
| 400  | `report_filter_invalid`                     | Período de reporte invertido o mayor a 62 días            |
| 400  | `report_execution_limit_exceeded`           | Reporte supera 5000 filas; acotar filtros                 |
| 404  | `report_not_found`                          | Clave de reporte fuera del catálogo fijo                  |
| 404  | `document_not_found`                        | Documento inexistente en la propiedad                     |
| 404  | `document_template_not_found`               | Plantilla inexistente para tipo/locale/versión            |
| 400  | `document_guest_mismatch`                   | Huésped seleccionado ajeno a la reserva                   |
| 409  | `document_reservation_state_invalid`        | Documento sobre reserva cancelada o no-show               |
| 409  | `document_checkin_required`                 | `CHECKIN_SUMMARY` sin estancia existente                  |
| 409  | `document_voided`                           | Firma física sobre un documento anulado                   |
| 400  | `invalid_received_at`                       | `receivedAt` no es un instante ISO 8601 válido            |
| 400  | `received_at_in_future`                     | Firma física con fecha futura                             |
| 400  | `received_at_before_generation`             | Firma física anterior a la generación                     |
| 400  | `invalid_property_timezone`                 | La propiedad tiene una timezone IANA inválida             |
| 404  | `pilot_feedback_not_found`                  | Feedback inexistente en la propiedad                      |
| 429  | `rate_limited`                              | Demasiados intentos de login; `details.retryAfterSeconds` |
| 503  | `auth_mode_unavailable`                     | Login local deshabilitado                                 |

## Idempotencia

`POST /api/v1/reservations` acepta `idempotencyKey` por body (8–64 caracteres).

- La key es única por propiedad (`Reservation.propertyId + idempotencyKey`).
- Misma key + mismo payload (`guestId`, `roomTypeId`, fechas): devuelve la reserva original.
- Misma key + payload distinto: `409 idempotency_key_reuse`.
- La reserva y su historial se crean en la misma transacción.

Los endpoints financieros de Phase 5 también reciben `idempotencyKey` por body (8–64): `POST /folios`, `/folios/:id/charges`, `/folios/:id/payments`, `/folios/:id/cancel`, `POST /cash-sessions`, `/cash-sessions/:id/close` y `/operational-days/close`.

- La key es única por propiedad y por tabla (`Folio`, `FolioLine`, `Payment`, `CashSession`, `CashMovement`, `OperationalClose`).
- Repetir la misma key con el mismo payload devuelve el resultado original sin duplicar filas.
- Misma key con payload distinto responde `409 idempotency_key_reuse`.
- El cierre de caja y el cierre operativo registran el replay en auditoría.

El resto de endpoints de escritura no financieros todavía no acepta `Idempotency-Key`; los duplicados se cubren con constraints únicas y la exclusión de solapamientos.

## Endpoints previstos (no implementados)

- exportación XLSX de reportes y reportes programados;
- historial persistente de reportes con re-descarga de artefactos;
- conciliación bancaria y tokenización de tarjetas;
- facturación/fiscal y numeración de comprobantes;
- integraciones Edge/OTA/PIX (Fase 8, sujetas a discovery y validación de proveedor).

## API acceptance principles

- Tenant scoping enforced on every endpoint.
- No mass assignment.
- No raw Prisma error leaked to client.
- Conflict responses are deterministic and actionable.
- All write operations have authorization, validation and audit coverage.
