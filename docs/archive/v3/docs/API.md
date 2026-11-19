# API propuesta (ajustar a convenciones existentes)

- GET/POST `/properties/:propertyId/reservations/:reservationId/instructions`
- PATCH `/properties/:propertyId/reservations/:reservationId/instructions/:id`
- POST `.../:id/acknowledge`, `.../:id/complete`, `.../:id/dismiss`
- GET/POST `/properties/:propertyId/guests/:guestId/notes`
- POST `/properties/:propertyId/reservations/:reservationId/source-notes/parse`
- POST `/properties/:propertyId/reservations/:reservationId/source-notes/confirm`

Parser devuelve sugerencias con category/title/body/priority/sourcePhrase/confidence/requiresHumanConfirmation/actionType/executionMoment/paymentMethod. El parse endpoint no crea pagos. Confirmar sugerencia solo guarda instrucción. Iniciar preautorización requiere módulo de pagos, permiso, importe confirmado y proveedor.
