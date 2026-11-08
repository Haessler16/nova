# NOVA PMS — Database Design v0.1

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
- operationalDayStart (hora local)
- status
- createdAt / updatedAt

### User

- id
- email normalizado y único global
- name
- passwordHash / proveedor de identidad
- status
- createdAt / updatedAt

### Membership

- id
- organizationId
- userId
- status
- createdAt / updatedAt

### PropertyMembership

- id
- organizationId
- propertyId
- userId
- roleId
- status

### Role / Permission

- roles y permisos configurables, con permisos atómicos y asignación acotada por organización/propiedad.

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

## Modelo de dominio futuro

- RoomType, Room, RoomStatusHistory
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

La implementación concreta de no-solapamiento debe definirse antes de reservas confirmadas. Investigar:

- PostgreSQL range types + exclusion constraint;
- `btree_gist`;
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

Audit semantics for Phase 1:

- `propertyId` is the **authorization scope** in which the action occurred.
- The affected record is identified by `entityType` + `entityId`.
- Example: creating a property from Centro writes `entityType=Property`, `entityId=<new id>`, `propertyId=<Centro id>`.

These constraints are manual SQL. Prisma does not model them, so future migrations must preserve them and reviews must check for drift.

## Prisma

`prisma/schema.prisma` contiene solo entidades de foundation. Las constraints avanzadas de PostgreSQL pueden requerir migración SQL manual; documentarlas y probarlas. No simular una constraint compleja solo en TypeScript.
