# NOVA PMS — Database Design v0.2

## Convenciones

- PostgreSQL.
- UUID para IDs expuestos.
- `createdAt`, `updatedAt` en entidades mutables.
- `deletedAt` solo cuando soft-delete tenga sentido; no usarlo para borrar historial financiero/operativo.
- Todas las tablas tenant-scoped incluyen `organizationId`; las entidades de propiedad incluyen `propertyId` cuando corresponda.
- Crear índices para filtros tenant-scoped y relaciones.
- Constraints compuestas para evitar referencias cruzadas entre organizaciones.
- Fechas almacenadas en UTC como instantes; zona horaria IANA configurada por propiedad.
- Dinero con Decimal o unidades menores enteras + currency. Nunca Float/Double.
- Evitar guardar documentos personales si no son necesarios.

## Entidades iniciales

### Organization

- id
- name
- slug
- status
- createdAt / updatedAt

### Property

- id
- organizationId
- name
- code
- timezone (IANA)
- currencyCode
- operationalDayStart (hora local, `HH:mm`)
- status
- createdAt / updatedAt

### User

- id
- email normalizado y único global
- name
- passwordHash (nullable; hash `scrypt` versionado)
- status
- createdAt / updatedAt

### Membership

- id
- organizationId
- userId
- roleId (nullable; rol de organización opcional)
- status
- createdAt / updatedAt

`roleId = null` representa staff regular con permisos derivados de `PropertyMembership`.

### PropertyMembership

- id
- organizationId
- propertyId
- userId
- roleId
- status

### Role / Permission

- roles y permisos configurables, con permisos atómicos y asignación acotada por organización/propiedad.
- `Role.organizationId` acota el rol a una organización.
- `Membership.roleId` y `PropertyMembership.roleId` se validan contra el mismo tenant mediante FKs compuestas.

### Session

- id
- userId
- tokenHash (SHA-256 hex, único)
- expiresAt
- revokedAt / revokedReason
- lastSeenAt
- createdAt / updatedAt

### AuditEvent

- id
- organizationId
- propertyId nullable
- actorUserId nullable (system actor permitido)
- action
- entityType
- entityId
- occurredAt
- correlationId
- reason nullable
- metadata JSON limitado y saneado
- before/after solo para campos no sensibles y con retención definida.

### RoomType

- id
- organizationId / propertyId
- name
- code (único por propiedad)
- description nullable
- capacityAdults / capacityChildren
- bedType nullable
- status
- createdAt / updatedAt

### Room

- id
- organizationId / propertyId
- roomTypeId
- number (único por propiedad)
- floor / building nullable
- attributes (array de strings, máximo 20)
- housekeepingState (`DIRTY`, `CLEANING`, `CLEAN`, `INSPECTED`)
- operationalState (`AVAILABLE`, `OUT_OF_ORDER`, `OUT_OF_SERVICE`)
- status
- createdAt / updatedAt

`housekeepingState` y `operationalState` son dimensiones separadas: limpieza vs. disponibilidad operativa.

### RoomBlock

- id
- organizationId / propertyId / roomId
- type (`OUT_OF_ORDER`, `OUT_OF_SERVICE`)
- status (`ACTIVE`, `RELEASED`, `EXPIRED`)
- reason
- startsAt / endsAt
- createdByUserId nullable
- releasedAt / releaseReason nullable
- createdAt / updatedAt

### RoomStatusHistory

- id
- organizationId / propertyId / roomId
- roomBlockId nullable
- category (`OPERATIONAL`, `HOUSEKEEPING`)
- fromState nullable
- toState
- reason nullable
- actorUserId nullable
- correlationId nullable
- occurredAt

Append-only. No tiene `updatedAt`; un trigger rechaza `UPDATE`, `DELETE` y `TRUNCATE`.

### Guest

- id
- organizationId / propertyId
- fullName
- email / phone (opcionales, normalizados)
- documentType (`PASSPORT`, `NATIONAL_ID`, `DRIVER_LICENSE`, `OTHER`) / documentNumber (opcionales y solo juntos)
- notes (≤ 2000)
- status (`ACTIVE`, `DISABLED`; sin borrado físico)
- createdAt / updatedAt

Perfil minimizado por propiedad. Sin fecha de nacimiento, dirección ni historial de documentos. Los datos FNRH opcionales (fecha de nacimiento, país, domicilio, etc.) viven en una tabla separada `GuestFnrhProfile` y no se devuelven en el listado de huéspedes. No hay unicidad de email/documento: la deduplicación es asistida y nunca automática.

### Reservation

- id
- organizationId / propertyId
- code (único por propiedad, `^[A-Z0-9-]{4,32}$`)
- status (`CONFIRMED`, `CHECKED_IN`, `CHECKED_OUT`, `CANCELLED`, `NO_SHOW`; Phase 3 solo crea `CONFIRMED` y cancela)
- source nullable
- checkInDate / checkOutDate (`date`, calendario hotelero)
- adults / children
- guestId / roomTypeId / roomId (roomId nullable)
- notes, idempotencyKey (único por propiedad)
- createdByUserId, cancelledAt, cancellationReason
- createdAt / updatedAt

### ReservationHistory

- id
- organizationId / propertyId / reservationId
- action (`reservation.created`, `reservation.updated`, `reservation.room_assigned`, `reservation.cancelled`)
- fromStatus / toStatus
- fromRoomId / toRoomId
- reason, actorUserId, correlationId, occurredAt

Append-only. Un trigger rechaza `UPDATE`, `DELETE` y `TRUNCATE`.

## Modelo de dominio futuro

- RatePlan, Rate
- GuestContact, GuestDocument (documento separado y con protección reforzada si se aprueba)
- ReservationRoomAssignment múltiple
- AvailabilityHold / RoomLease
- OutboxEvent
- Modelos separados `OperationalDay`/`NightAuditRun` (hoy el día operativo se calcula y el cierre usa `OperationalClose`)
- Integraciones externas: configuración FNRH, ledger de operaciones y identificadores externos (diseño en `docs/v2`, sin migración)

`Stay`, `Folio`, `FolioLine`, `Payment`, `CashSession`, `CashMovement`, `OperationalClose`, `ImportJob`/`GuestImport`, `ReservationGuest`, `GuestFnrhProfile` y los modelos de notas/instrucciones ya están implementados y se documentan en las notas de fase.

## Integridad multi-tenant

Para entidades relacionadas, preferir claves únicas compuestas:

- `@@unique([organizationId, id])` en tablas padre cuando sea necesario.
- Relaciones compuestas que incluyan organizationId/propertyId.
- Nunca permitir Reservation.propertyId que pertenezca a otra Organization.
- Índices iniciando por organizationId y propertyId en consultas de operación.

## Concurrencia de habitación

Estado implementado en Phase 3:

- Los estados que ocupan inventario son `CONFIRMED` y `CHECKED_IN`. `CANCELLED`, `CHECKED_OUT` y `NO_SHOW` liberan el intervalo.
- La estancia es `[checkInDate, checkOutDate)`; un checkout puede coincidir con el checkin de otra reserva.
- Las reservas pueden crearse sin habitación asignada; la asignación se valida y se puede cambiar mientras la reserva siga `CONFIRMED`.
- No hay overbooking autorizado en esta fase.
- Una habitación no puede pertenecer a dos room types; asignar una reserva a otra tipología responde `409 room_type_mismatch`.
- La aplicación bloquea la fila `Room` y valida solapamiento; PostgreSQL impone la garantía final con `Reservation_room_date_no_overlap`.
- Los bloqueos de inventario (`RoomBlock`) y las reservas se serializan por el lock de la fila `Room`; todavía no hay una constraint única que relacione ambas tablas.

La capa Redis/lease es auxiliar. La constraint/transacción PostgreSQL es la garantía final.

## Phase 1 implementation notes

Applied in `prisma/migrations/20261108000000_init/migration.sql`:

- Composite tenant foreign keys:
  - `PropertyMembership (organizationId, propertyId) → Property (organizationId, id)`;
  - `PropertyMembership (organizationId, roleId) → Role (organizationId, id)`;
  - `PropertyMembership (organizationId, userId) → Membership (organizationId, userId)`;
  - `AuditEvent (organizationId, propertyId) → Property (organizationId, id)`.
- `User.email` must be lowercase, trimmed and contain `@`.
- `Property.currencyCode` must match `^[A-Z]{3}$`.
- `Property.operationalDayStart` must match `HH:mm`.
- `AuditEvent.metadata` is capped at 8 KiB.
- Trigger `AuditEvent_append_only_row` rejects `UPDATE`/`DELETE`; trigger `AuditEvent_append_only_truncate` rejects `TRUNCATE`.

Audit semantics:

- `propertyId` is the **authorization scope** in which the action occurred.
- The affected record is identified by `entityType` + `entityId`.
- Example: creating a property from Centro writes `entityType=Property`, `entityId=<new id>`, `propertyId=<Centro id>`.

## Phase 2 implementation notes

Applied in `prisma/migrations/20261108120000_phase2_inventory_auth/migration.sql` (Prisma diff + manual hardening).

### Organization roles and sessions

- `Membership.roleId` nullable.
- `Membership (organizationId, roleId) → Role (organizationId, id)` composite FK (`Membership_role_tenant_fkey`).
- `Session.tokenHash` unique with `Session_token_hash_check` (`^[0-9a-f]{64}$`).
- `Session_expiry_check` enforces `expiresAt > createdAt`.

### Inventory tenant integrity

Composite FKs:

- `RoomType (organizationId, propertyId) → Property (organizationId, id)`;
- `Room (organizationId, propertyId) → Property (organizationId, id)`;
- `Room (organizationId, propertyId, roomTypeId) → RoomType (organizationId, propertyId, id)`;
- `RoomBlock (organizationId, propertyId) → Property (organizationId, id)`;
- `RoomBlock (organizationId, propertyId, roomId) → Room (organizationId, propertyId, id)`;
- `RoomBlock (organizationId, createdByUserId) → Membership (organizationId, userId)`;
- `RoomStatusHistory (organizationId, propertyId) → Property (organizationId, id)`;
- `RoomStatusHistory (organizationId, propertyId, roomId) → Room (organizationId, propertyId, id)`;
- `RoomStatusHistory (organizationId, propertyId, roomBlockId) → RoomBlock (organizationId, propertyId, id)`;
- `RoomStatusHistory (organizationId, actorUserId) → Membership (organizationId, userId)`.

Estas FKs impiden referencias cruzadas entre organizaciones/propiedades aunque Prisma solo modele relaciones de una columna.

### Checks adicionales

- `RoomType_code_check`: código en mayúsculas, `^[A-Z0-9_-]{1,24}$`.
- `RoomType_name_check`: nombre trimmed, 1–120.
- `RoomType_capacity_check`: `capacityAdults >= 1`, `capacityChildren >= 0`.
- `Room_number_check`: número trimmed, 1–32.
- `Room_attributes_count_check`: `cardinality(attributes) <= 20`.
- `Room_floor_check` / `Room_building_check`: longitudes acotadas si no son null.
- `RoomBlock_reason_check`: motivo trimmed, 3–500.
- `RoomBlock_interval_check`: `endsAt > startsAt`.
- `RoomBlock_release_reason_check`: razón de liberación 3–500 si existe.
- `RoomBlock_status_fields_check`: `ACTIVE` ⇒ sin `releasedAt`/`releaseReason`; no `ACTIVE` ⇒ `releasedAt` obligatorio.
- `RoomStatusHistory_to_state_check` / `from_state_check` / `reason_check`.

### No-solapamiento de bloqueos

```sql
ALTER TABLE "RoomBlock"
    ADD CONSTRAINT "RoomBlock_active_no_overlap"
    EXCLUDE USING gist (
        "roomId" WITH =,
        tsrange("startsAt", "endsAt", '[)') WITH &&
    )
    WHERE ("status" = 'ACTIVE');
```

Requiere `CREATE EXTENSION IF NOT EXISTS btree_gist`.

- La constraint es la garantía final de que dos bloqueos activos de la misma habitación no se solapan.
- La aplicación además bloquea la fila `Room` con `SELECT ... FOR UPDATE` y valida solapamiento para devolver `409 room_block_overlap` de forma determinista en lugar de un error crudo de constraint.
- El intervalo es semiabierto `[startsAt, endsAt)`: un bloqueo puede empezar justo cuando termina otro.

### Historial append-only

- `nova_room_status_history_append_only()` lanza excepción en `UPDATE`/`DELETE`/`TRUNCATE`.
- Triggers `RoomStatusHistory_append_only_row` y `RoomStatusHistory_append_only_truncate`.
- La API no expone rutas de mutación del historial.

### Reconciliación de estado operativo

`RoomStateService` deriva el estado operativo de los bloqueos activos:

- bloqueo `OUT_OF_ORDER` activo ⇒ `OUT_OF_ORDER`;
- si no, bloqueo `OUT_OF_SERVICE` activo ⇒ `OUT_OF_SERVICE`;
- si no, `AVAILABLE`.

Propiedades:

- La mutación (alta/liberación de bloqueo) ocurre en una transacción con lock de la fila `Room`.
- La expiración de bloqueos (`endsAt <= now`) se reconcilia de forma perezosa al leer habitaciones; se marca `EXPIRED` con `releasedAt = endsAt` y se escribe auditoría.
- Cada cambio de estado operativo escribe `RoomStatusHistory` (`category = OPERATIONAL`) y `AuditEvent`.
- No hay scheduler en segundo plano; el estado puede quedar desactualizado hasta la siguiente lectura.

### Verificación de integridad

`scripts/verify-db-integrity.ts` consulta `pg_constraint`, `pg_trigger`, `pg_proc`, `pg_indexes` y `pg_extension` y falla si falta cualquiera de los objetos manuales esperados (77 constraints, 8 triggers, 4 funciones, 2 índices parciales, `btree_gist`).

```bash
pnpm db:verify
```

CI lo ejecuta después de migrar y sembrar. Esto cierra la limitación de que una migración futura elimine silenciosamente reglas manuales.

## Phase 3 implementation notes — guests and reservations

Applied in `prisma/migrations/20261108210000_phase3_guests_reservations/migration.sql`.

### Composite tenant foreign keys

- `Guest (organizationId, propertyId) → Property (organizationId, id)`;
- `Reservation (organizationId, propertyId) → Property (organizationId, id)`;
- `Reservation (organizationId, propertyId, guestId) → Guest (organizationId, propertyId, id)`;
- `Reservation (organizationId, propertyId, roomTypeId) → RoomType (organizationId, propertyId, id)`;
- `Reservation (organizationId, propertyId, roomId) → Room (organizationId, propertyId, id)`;
- `Reservation (organizationId, createdByUserId) → Membership (organizationId, userId)`;
- `ReservationHistory (organizationId, propertyId) → Property (organizationId, id)`;
- `ReservationHistory (organizationId, propertyId, reservationId) → Reservation (organizationId, propertyId, id)`;
- `ReservationHistory (organizationId, actorUserId) → Membership (organizationId, userId)`.

### No-solapamiento de reservas

```sql
ALTER TABLE "Reservation"
    ADD CONSTRAINT "Reservation_room_date_no_overlap"
    EXCLUDE USING gist (
        "roomId" WITH =,
        daterange("checkInDate", "checkOutDate", '[)') WITH &&
    )
    WHERE ("roomId" IS NOT NULL AND "status" IN ('CONFIRMED', 'CHECKED_IN'));
```

- Es la garantía final: dos transacciones concurrentes no pueden confirmar la misma habitación en fechas solapadas, incluso si la validación de aplicación fallara.
- El servicio además bloquea la fila `Room` con `SELECT ... FOR UPDATE` y devuelve `409 room_not_available` de forma determinista.
- `checkInDate`/`checkOutDate` son `date`, no instantes. La granularidad es de noche hotelera; las horas de check-in/out pertenecen a Front Office.
- `RoomBlock` sigue usando `tsrange` con instantes. La comparación reserva↔bloqueo usa los extremos UTC de las fechas de reserva; revisar si se introduce precisión horaria.

### Checks principales

- `Guest_full_name_check`, `Guest_email_check`, `Guest_phone_check`, `Guest_document_check`, `Guest_document_number_check`, `Guest_notes_check`.
- `Reservation_code_check`, `Reservation_date_order_check`, `Reservation_occupancy_check`, `Reservation_idempotency_key_check`, `Reservation_cancellation_fields_check`.
- `ReservationHistory_action_check`, `ReservationHistory_reason_check`, `ReservationHistory_room_change_check`.

### Historial append-only

- `nova_reservation_history_append_only()` lanza excepción en `UPDATE`/`DELETE`/`TRUNCATE`.
- Triggers `ReservationHistory_append_only_row` y `ReservationHistory_append_only_truncate`.

## Phase 4 implementation notes — Front Office

Applied in `prisma/migrations/20261108230000_phase4_front_office/migration.sql`.

### Stay

- `Stay` es único por `reservationId` (`Stay_reservationId_key`); una reserva tiene como máximo una estancia.
- `status` es `IN_HOUSE` o `CHECKED_OUT`. La ocupación de una habitación se deriva de una estancia `IN_HOUSE`, nunca de `Room.housekeepingState`.
- `checkedInAt` es obligatorio; `checkedOutAt` solo existe con `CHECKED_OUT` (`Stay_checkout_consistency`) y debe ser posterior al check-in (`Stay_checkout_after_checkin`).
- `moveCount >= 0` (`Stay_move_count_check`).
- FKs compuestas garantizan que reserva, huésped y habitación pertenecen a la misma organización y propiedad (`Stay_tenant_reservation_fkey`, `Stay_tenant_room_fkey`, `Stay_tenant_guest_fkey`).
- Las acciones de check-in/out/move bloquean la fila `Stay` o `Reservation` con `SELECT ... FOR UPDATE` y validan dentro de la transacción; la unicidad por reserva es la garantía final contra dobles check-in.
- `Reservation.noShowAt` registra el instante del no-show; el estado `NO_SHOW` libera el intervalo de la exclusion constraint.

### Incident

- `Incident` admite alcance opcional por habitación, reserva o estancia; si se vincula a una estancia, el servicio deriva habitación y reserva y rechaza un alcance contradictorio (`incident_scope_mismatch`).
- `title` 3–120, `description` 3–4000 y `resolution` 3–4000 cuando existe (`Incident_title_length`, `Incident_description_length`, `Incident_resolution_length`).
- `status = RESOLVED` exige `resolvedAt`; `OPEN` exige que sea nulo (`Incident_resolved_consistency`).
- FKs compuestas `Incident_tenant_room_fkey`, `Incident_tenant_reservation_fkey` e `Incident_tenant_stay_fkey` impiden cruces de tenant.

### Housekeeping y ocupación

- El room rack combina `occupancy` (derivada de `Stay`) con `housekeepingState` y `operationalState` (derivados de inventario/bloqueos). Son dimensiones separadas y no se sincronizan entre sí.
- El check-out no fuerza un estado de housekeeping: la habitación queda `VACANT` para ocupación y conserva su estado de limpieza hasta que el equipo lo transicione.

## Phase 5 implementation notes — Folio, caja y night audit

Applied in `20261109030000_phase5_folio_hardening`, `20261109032000_cash_session_currency` y `20261109033000_folio_active_unique` (la migración `20261109021002_phase5_folio_cash` fue un draft reemplazado por ellas).

### Folio y FolioLine

- `Folio` conserva el estado (`OPEN`, `SETTLED`, `CANCELLED`) y debe vincularse a una estancia o reserva (`Folio_link_check`).
- Los cargos viven en `FolioLine` y nunca se borran. Un void conserva el importe, `voidedAt` y `voidReason` (`FolioLine_void_check`).
- Los índices únicos parciales `Folio_one_active_per_reservation_key` y `Folio_one_active_per_stay_key` permiten un solo folio no cancelado por reserva y por estancia.
- `Folio_propertyId_number_key` y `Folio_propertyId_idempotencyKey_key` evitan números duplicados y dobles aperturas.
- Importes `DECIMAL(10,2)` positivos en líneas (`FolioLine_amount_check`) y moneda `^[A-Z]{3}$`.

### Payment

- `Payment` referencia siempre un `Folio` (`folioId NOT NULL`) y no almacena datos de tarjeta: solo `method`, `referenceId` y `description`.
- `Payment_amount_check` exige importe positivo; `Payment_method_check` exige un código `^[A-Z][A-Z0-9_]{1,31}$`.
- `Payment_propertyId_idempotencyKey_key` protege contra doble registro.

### CashSession y CashMovement

- `CashSession_one_open_per_property_key` (índice único parcial sobre `status = 'OPEN'`) impide dos cajas abiertas por propiedad.
- `CashSession_close_check` exige coherencia entre `status`, `closedAt`, `closedByUserId` y `closingAmount`.
- `CashSession_currency_code_check` y `CashMovement_currency_code_check` fijan moneda ISO; los movimientos heredan la moneda de la sesión.
- `CashMovement_amount_check` exige importe positivo; el signo se deriva del `type` en el servicio.
- Las mutaciones bloquean la sesión con `SELECT ... FOR UPDATE` antes de crear movimientos o cerrar.

### OperationalClose

- Una fila por propiedad y día operativo (`OperationalClose_organizationId_propertyId_operationalDate_key`).
- `snapshot` es JSONB objeto (`OperationalClose_snapshot_check`); el reopen exige `reopenedAt` y `reopenReason` (`OperationalClose_reopen_check`).
- `OperationalClose_propertyId_idempotencyKey_key` hace el cierre repetible sin duplicar filas.

### Integridad multi-tenant

- FKs compuestas: `Folio_property_tenant_fkey`, `Folio_tenant_stay_fkey`, `Folio_tenant_reservation_fkey`, `FolioLine_property_tenant_fkey`, `FolioLine_tenant_folio_fkey`, `Payment_property_tenant_fkey`, `Payment_tenant_folio_fkey`, `CashSession_property_tenant_fkey`, `CashMovement_property_tenant_fkey`, `CashMovement_tenant_cash_session_fkey` y `OperationalClose_property_tenant_fkey`.
- `pnpm db:verify` incluye estas constraints, los checks financieros y los índices únicos parciales.

## Phase 6 implementation notes — piloto y sandbox

Aplicado en `prisma/migrations/20261109120000_phase6_pilot_feedback/migration.sql`.

### PilotFeedback

- `PilotFeedback` pertenece a una organización y propiedad (`PilotFeedback_property_tenant_fkey`); su autor debe ser miembro (`PilotFeedback_author_membership_fkey`) y el revisor, si existe, también (`PilotFeedback_reviewer_membership_fkey`).
- `message` 8–4000 (`PilotFeedback_message_check`), `rating` 1–5 o nulo (`PilotFeedback_rating_check`) y `context` objeto JSON o nulo (`PilotFeedback_context_check`).
- `status = REVIEWED` exige `reviewedAt` y `reviewedByUserId` (`PilotFeedback_review_check`); el mensaje original no se actualiza desde la API.
- El índice único `PilotFeedback_organizationId_propertyId_id_key` sostiene la clave compuesta usada por las FKs de tenant y las búsquedas por propiedad.

### Sandbox demo

- `pnpm demo:sandbox` crea el schema `demo_sandbox` en la misma instancia PostgreSQL, aplica las migraciones y ejecuta el seed sintético.
- El aislamiento es por schema, no por cluster; el script rechaza URLs no locales y exige `CONFIRM_DEMO_SANDBOX=1`.

## Phase 7 implementation notes — importación CSV

Aplicado en `prisma/migrations/20261109150000_phase7_guest_import/migration.sql`.

### GuestImport

- Cabecera de idempotencia y auditoría de una importación de huéspedes confirmada; **no almacena el CSV ni datos personales**.
- `(propertyId, idempotencyKey)` es único; `(organizationId, propertyId, id)` sostiene la FK compuesta de tenant.
- `rowCount` entre 1 y 500 (`GuestImport_row_count_check`) y `createdCount = rowCount` (`GuestImport_created_count_check`), porque la importación es todo o nada.
- `idempotencyKey` cumple `^[A-Za-z0-9_-]{8,64}$` (`GuestImport_idempotency_key_check`).
- FKs simples a organización/propiedad/usuario, FK compuesta a propiedad y FK de membresía para el creador.
- Los huéspedes creados viven en `Guest`; la auditoría `guest.imported` guarda solo conteos.

## Phase 8 implementation notes — groundwork

No agrega tablas de dominio. `/health/version` es diagnóstico; las exportaciones CSV se derivan de `Guest`, `Reservation` y `Folio`, y sólo escriben `AuditEvent` (`export.*`) con conteos. El feed de auditoría amplía filtros sobre `AuditEvent`.

## Phase 9 implementation notes — Documents & Reports

Aplicado en `prisma/migrations/20261112120040_phase9_documents/migration.sql`.

### DocumentTemplate

- Plantilla property-scoped por `(propertyId, key, locale, version)`.
- `key` en `GUEST_REGISTRATION`, `LODGING_TERMS`, `CHECKIN_SUMMARY`; `locale` en `pt-BR`.
- `body` es texto plano; el renderer lo escapa y nunca interpreta HTML arbitrario.
- Una versión publicada es inmutable en el flujo de emisión; no hay endpoints de escritura de plantillas en v1.

### GeneratedDocument

- Snapshot inmutable de plantilla, propiedad, huésped, reserva, estancia o folio y datos mínimos; `number` único por propiedad con formato `DOC-YYYYMMDD-XXXXXXXXXXXX`.
- Guarda bytes del PDF en PostgreSQL (`content`), `mimeType`, `fileSizeBytes`, `pageCount`, `sha256` y `storageKey`.
- Trigger `GeneratedDocument_immutable_trigger` rechaza `DELETE` y cambios en número, tipo, locale, versión, snapshot, contenido, MIME, tamaño, páginas, hash o storage. Sólo permite avanzar estado, recepción física y notas.
- Descarga autenticada por request; no hay URL pública ni firmada.

### DocumentPrintEvent

- Append-only: registra `PRINT_DIALOG_OPENED`, `PRINT_CONFIRMED_BY_STAFF` o `REPRINT_REQUESTED`; no afirma impresión física.
- Trigger `DocumentPrintEvent_append_only_trigger` rechaza `UPDATE`/`DELETE`.

### Reports

- No persiste reportes ni artefactos. Cada ejecución/exportación escribe `AuditEvent` (`report.executed`/`report.exported`) con `reportKey`, fechas, formato y conteos; el historial se deriva del audit log.
- `cash-daily` lee `CashSession`/`CashMovement`; el resto lee reservas, estancias, habitaciones y bloqueos. La ocupación se calcula por día de la propiedad.

## Phase 10 implementation notes — Reservation party (FNRH)

Aplicado en `prisma/migrations/20261115120000_phase10_reservation_party/migration.sql`.

### GuestFnrhProfile

- Perfil FNRH opcional, 1:1 con `Guest` por `guestId`; guarda fecha de nacimiento, país, domicilio, género/raza/discapacidad y códigos IBGE.
- Separado de `Guest` para no ampliar el perfil operativo ni el listado de huéspedes.
- FKs de tenant a organización y propiedad; no se expone en la lista de huéspedes.

### ReservationGuest

- Fiesta explícita por reserva: `role` (`PRIMARY`, `COMPANION`), `ageGroup`, `legalIncapacity`, `minorSupervision`, `authorizationReference`, `origin` y `responsibleReservationGuestId`.
- `(reservationId, guestId)` único; índice parcial `ReservationGuest_one_primary_per_reservation` garantiza un solo `PRIMARY` por reserva.
- El `PRIMARY` debe coincidir con `Reservation.guestId`; la migración hizo backfill de una fila `PRIMARY` por reserva existente con `ageGroup=UNKNOWN` y `origin=LEGACY_BACKFILL`, sin inventar acompañantes ni menores.
- Menores e incapaces apuntan a un responsable adulto de la misma fiesta; la aplicación valida capacidad del room type y la sincronización de `adults`/`children`.

## Phase 11 implementation notes — Notes & instructions

Aplicado en `prisma/migrations/20261115130000_phase11_notes_instructions`, `20261115140000_phase11_append_only_truncate` y `20261115150000_phase11_instruction_tags`.

### ReservationSourceNote

- Texto original inmutable recibido de un canal o pegado por recepción; PAN/CVV, NSU, códigos de autorización y referencias de proveedor se redactan antes de persistir.
- `sourceTextHash` conserva el digest del texto exacto recibido; `contentHash` + `parserVersion` deduplican reintentos.
- `suggestions` y `warnings` son JSON; el parser sólo sugiere y nunca ejecuta pagos, cargos, tarifas ni asignaciones.
- Trigger rechaza `UPDATE`/`DELETE`/`TRUNCATE`.

### ReservationInstruction

- Nota estructurada o instrucción operativa por reserva: categoría, prioridad, estado, visibilidad, departamento, usuario asignado, `actionType`, `executionMoment`, `paymentMethod`, vencimientos y vigencia.
- Máximo 10 tags; índice GIN sobre `tags`.
- `(sourceNoteId, dedupeKey)` único para confirmaciones repetidas; no crea pagos ni folios.

### InstructionEvent

- Timeline append-only por instrucción (`CREATED`, `UPDATED`, `ACKNOWLEDGED`, `IN_PROGRESS`, `COMPLETED`, `DISMISSED`, `NEEDS_CLARIFICATION`, `CONFIRMED_FROM_SOURCE`).
- Trigger rechaza `UPDATE`/`DELETE`/`TRUNCATE`.

### GuestNote

- Nota persistente del huésped, independiente de las instrucciones de reserva; no se copia automáticamente a una reserva.
- Categoría, prioridad, visibilidad, propósito, vencimiento y `isActive`. La visibilidad y las categorías confidenciales se filtran en el servidor.

## Phase 12 implementation notes — Front Desk operational search

Aplicado en `prisma/migrations/20261116120000_phase12_search_unaccent/migration.sql`.

- `CREATE EXTENSION IF NOT EXISTS unaccent;` habilita la búsqueda de huéspedes, códigos y UH sin acentos. No crea tablas, columnas ni índices y es reversible con `DROP EXTENSION IF EXISTS unaccent;` si ningún otro objeto la usa.
- `ALTER EXTENSION unaccent SET SCHEMA public;` fija la extensión en `public`: Prisma limita `search_path` al esquema de la conexión (por ejemplo, un esquema E2E aislado), así que la consulta llama `public.unaccent(...)` de forma calificada.
- La consulta usa `public.unaccent(lower(...)) LIKE public.unaccent(pattern) ESCAPE '!'`, con el patrón escapado, filtros de `organizationId`/`propertyId` y `LIMIT 200`. Sólo devuelve IDs; el resto de filtros y el scoping tenant se reaplican en la consulta Prisma que los consume.
- Requiere permiso para crear extensiones en la base, o que un DBA la cree antes de migrar. Si el rol de despliegue no puede, la migración falla y debe resolverse en infraestructura, no en la aplicación.

## Prisma

`prisma/schema.prisma` modela la foundation, inventario, reservas, Front Office, folios, caja, night audit, feedback de piloto, importaciones de huéspedes, documentos, reportes (sin tablas propias), fiesta FNRH y notas/instrucciones. Las constraints avanzadas de PostgreSQL se agregan como SQL manual en las migraciones; documentarlas y probarlas. No simular una constraint compleja solo en TypeScript.

Reglas para futuras migraciones:

1. Generar el diff con `prisma migrate diff`.
2. Revisar que el diff no elimine constraints/triggers manuales existentes.
3. Añadir manualmente cualquier constraint nueva no expresable en Prisma.
4. Ejecutar `pnpm db:migrate:deploy` y `pnpm db:verify`.
