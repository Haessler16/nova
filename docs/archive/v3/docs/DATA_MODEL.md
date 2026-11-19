# Modelo conceptual (adaptar al schema real)
- `ReservationInstruction`: organizationId, propertyId, reservationId, category, title, body, priority, status, source, sourceDepartment, visibility, assignedDepartment, assignedUserId, actionType, actionDueAt, validFrom/Until, completedAt/By, createdBy/At, metadataJson.
- `GuestNote`: organizationId, propertyId, guestId, category, body, priority, visibility, purpose, expiresAt, isActive, createdBy/At.
- `ReservationSourceNote`: reservationId, sourceTextOriginal, sourceSystem, sourceDepartment, externalReference, importedAt/By, contentHash, parserVersion.
- `InstructionEvent` append-only: instructionId, eventType, actorUserId, eventAt, from/to status, reason, metadata.
- `PaymentActionReference` opcional: instructionId + referencia al PaymentIntent/PreAuthorization real. No duplica transacciones ni ledger.

Todas las operaciones deben filtrar organizationId y propertyId. Añadir índices para reservationId/status/priority/actionDueAt y guestId/createdAt. No guardar datos de tarjeta en metadata.
