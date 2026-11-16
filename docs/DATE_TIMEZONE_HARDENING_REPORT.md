# Date and timezone hardening

## Objetivo

Eliminar el uso de la fecha UTC del host como “hoy” del hotel y corregir los lugares donde un instante se convertía en fecha calendario sin la zona horaria de la propiedad.

## Diagnóstico

- `Reservation.checkInDate`, `Reservation.checkOutDate` y `OperationalDay.operationalDate` son fechas calendario (`date`) y se guardan a medianoche UTC por convención de Prisma. Eso es correcto y no debe convertirse.
- Los instantes (`new Date()`, `createdAt`, `generatedAt`, `receivedAt`) sí deben proyectarse a la zona IANA de la propiedad.
- Varias suites E2E calculaban “hoy” con `new Date().toISOString().slice(0, 10)`. En São Paulo (UTC-3), entre las 21:00 y las 23:59 locales, UTC ya es el día siguiente. El test creaba llegadas para “mañana”, el listado de llegadas quedaba vacío y el check-in respondía `409 check_in_too_early`.
- El mismo atajo UTC aparecía en el filtro por fecha de folios, en los números `F-...`/`DOC-...`, en los nombres de CSV y en los valores por defecto de la web.

## Cambios

### API

- `apps/api/src/common/time/property-day.ts`: nuevo `calendarDateInTimezone(instant, timezone)`, validación de instante y zona, y pruebas con instantes fijos y cambios de DST.
- `apps/api/src/reservations/reservation-dates.ts`: reutiliza el helper central; se mantiene la reexportación para compatibilidad.
- `apps/api/src/folio/folio.service.ts`:
  - El filtro `GET /folios?date=` usa límites `[inicio, fin)` del día local de la propiedad.
  - El número de folio usa la fecha local de la propiedad.
- `apps/api/src/documents/documents.service.ts`: `DOC-YYYYMMDD-...` usa la fecha local de la propiedad.
- `apps/api/src/exports/exports.controller.ts` + `exports.service.ts`: el nombre `nova-<export>-YYYY-MM-DD.csv` usa la fecha local de la propiedad.

### Web

- `apps/web/src/lib/format.ts`: `todayISO(offsetDays, timezone?)` usa la zona de la propiedad y cae a la fecha local del navegador, nunca a UTC. Nuevo `calendarDateInTimezone`.
- Reservas, calendario, Front Office, reportes, folios y huéspedes pasan `property.timezone` de la sesión a los valores por defecto y a los nombres de CSV.

### Tests

- Nuevo `apps/api/test/support/property-date.ts` con `propertyCalendarDate(offsetDays, timezone)`.
- `documents`, `front-office`, `folio`, `exports`, `guests-reservations`, `pilot-hardening`, `reservation-party` y `reports` usan el helper compartido.
- Regresiones añadidas:
  - Instante fijo `2026-11-16T00:42:00Z` → `2026-11-15` en `America/Sao_Paulo`.
  - Filtro de folios por fecha local con `createdAt` fijo en `2026-01-15T02:30:00Z`.
  - Prefijo de fecha local en números de folio y documento.
  - Nombre local del CSV de exportación.
- Se corrigió una expectativa preexistente de disponibilidad: con una habitación DLX bloqueada, la otra habitación DLX sigue disponible; la prueba ahora verifica que la bloqueada no aparece y la libre sí.

## Comandos ejecutados

- `pnpm typecheck` — OK.
- `pnpm lint` — OK.
- `pnpm --filter @nova/api test` — 17 suites, 96 tests OK.
- `pnpm test:e2e:isolated` — 15 suites, 124 tests OK (pasada final).
- `pnpm --filter @nova/api build` — OK.
- `pnpm --filter @nova/web build` — OK.

## Limitaciones

- Los formularios que editan horas de reloj (`datetime-local`), como bloqueos de habitación y vigencia de instrucciones, siguen interpretando el valor en la zona del navegador. Alinearlos con la zona de la propiedad requiere convertir una hora local de propiedad a instante y queda como tarea de UI separada.
- `formatDateTime` sigue mostrando instantes en la zona del navegador. Para operadores en otra zona horaria conviene añadir un parámetro de timezone y pasarlo desde las páginas; no cambia la persistencia ni los cálculos.
- En pasadas intermedias de la suite completa aparecieron fallos intermitentes en `inventory` (404 al leer una habitación recién bloqueada) y `documents` (409) que no se reprodujeron al ejecutar esas suites aisladas ni en la pasada final 15/15. No se modificó código de esos módulos salvo el helper de fechas.
