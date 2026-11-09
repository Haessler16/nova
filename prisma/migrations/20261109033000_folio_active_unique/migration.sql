-- At most one non-cancelled folio per reservation or stay. Cancelled folios
-- remain as history and allow a replacement account to be opened.
CREATE UNIQUE INDEX "Folio_one_active_per_reservation_key"
    ON "Folio" ("organizationId", "propertyId", "reservationId")
    WHERE "status" <> 'CANCELLED' AND "reservationId" IS NOT NULL;

CREATE UNIQUE INDEX "Folio_one_active_per_stay_key"
    ON "Folio" ("organizationId", "propertyId", "stayId")
    WHERE "status" <> 'CANCELLED' AND "stayId" IS NOT NULL;
