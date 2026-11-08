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

## Modelo de dominio futuro

- RatePlan, Rate
- Guest, GuestContact, GuestDocument (documento separado y con protección reforzada si se aprueba)
- Reservation, ReservationGuest, ReservationRoomAssignment
- AvailabilityHold / RoomLease
- Stay
- Folio, FolioLine, PaymentRecord, CashSession, CashMovement
- OperationalDay, NightAuditRun
- ImportJob, ImportRow, ImportError
- OutboxEvent

## Integridad multi-tenant

Para entidades relacionadas, preferir claves únicas compuestas:

- `@@unique([organizationId, id])` en tablas padre cuando sea necesario.
- Relaciones compuestas que incluyan organizationId/propertyId.
- Nunca permitir Reservation.propertyId que pertenezca a otra Organization.
- Índices iniciando por organizationId y propertyId en consultas de operación.

## Concurrencia de habitación

La implementación de no-solapamiento de bloqueos ya existe para `RoomBlock` (ver Phase 2). Antes de reservas confirmadas hay que definir:

- límites de reservas por habitación y estados que ocupan inventario;
- tratamiento de checkout date como extremo exclusivo;
- reservas sin habitación asignada;
- overbooking autorizado y permisos, si el producto lo requiere.

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

`scripts/verify-db-integrity.ts` consulta `pg_constraint`, `pg_trigger`, `pg_proc` y `pg_extension` y falla si falta cualquiera de los objetos manuales esperados (37 constraints, 4 triggers, 2 funciones, `btree_gist`).

```bash
pnpm db:verify
```

CI lo ejecuta después de migrar y sembrar. Esto cierra la limitación de que una migración futura elimine silenciosamente reglas manuales.

## Prisma

`prisma/schema.prisma` modela la foundation y el inventario. Las constraints avanzadas de PostgreSQL se agregan como SQL manual en las migraciones; documentarlas y probarlas. No simular una constraint compleja solo en TypeScript.

Reglas para futuras migraciones:

1. Generar el diff con `prisma migrate diff`.
2. Revisar que el diff no elimine constraints/triggers manuales existentes.
3. Añadir manualmente cualquier constraint nueva no expresable en Prisma.
4. Ejecutar `pnpm db:migrate:deploy` y `pnpm db:verify`.
