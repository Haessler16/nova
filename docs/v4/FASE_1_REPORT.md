# Fase 1 — Front Desk: búsqueda operativa y check-in guiado

**Fecha:** 2026-11-16
**Ficha:** `docs/v4/NOVA_PMS_FICHA_04_OPENCODE_TECHNICAL.md`, sección «Fase 1».
**Estado:** ejecutada. Backend, frontend, migración, pruebas y documentación incluidos en el mismo cambio.

---

## 1. Resumen

La recepción ya puede buscar reservas desde Front Desk por huésped (sin importar acentos), código de reserva o UH, combinando rango de fechas y estado, con los filtros conservados en la query string. Desde el resultado puede abrir la reserva, abrir el perfil del huésped o iniciar un check-in guiado de cuatro pasos. El wizard muestra la elegibilidad real de cada habitación (housekeeping, estado operativo, bloqueo, ocupación y solapamiento) y el backend revalida todo dentro de la transacción de check-in antes de confirmar.

No se creó un endpoint paralelo de búsqueda: se extendió `GET /api/v1/reservations`, que ya aplica tenant, permisos, paginación y filtros de solapamiento.

---

## 2. Qué existía y qué cambió

| Requisito de la ficha                   | Antes                                                                                                                               | Ahora                                                                                                                                 |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Búsqueda visible en Front Desk          | No había buscador dedicado; solo listas operativas (llegadas, en casa, salidas, rack).                                              | Formulario «Búsqueda operativa» con texto, desde, hasta y estado.                                                                     |
| Texto por nombre, apellido, código o UH | `GET /reservations?search=` cubría código y nombre, pero era sensible a acentos; la UH solo se encontraba incluyéndola en el texto. | El mismo `search` cubre nombre, código y UH, y resuelve acentos.                                                                      |
| Combinar texto + fechas + estado        | El endpoint aceptaba los filtros, pero la UI no los exponía juntos ni los conservaba.                                               | Se combinan en una sola consulta y se reflejan en la URL.                                                                             |
| Limpiar filtros                         | No existía en Front Desk.                                                                                                           | «Limpiar filtros» restablece formulario, resultados y query string.                                                                   |
| Loading / error / empty / resultados    | Solo estados de las listas operativas.                                                                                              | Estados explícitos del buscador, con reintento y mensajes de error.                                                                   |
| Tolerancia a mayúsculas y acentos       | `contains` insensible a mayúsculas, sensible a acentos.                                                                             | `unaccent` + `lower` para el nombre del huésped; códigos y UH por `contains`.                                                         |
| Conservar filtros en query string       | No.                                                                                                                                 | `q`, `fromDate`, `toDate`, `status`; deep link y recarga los restauran.                                                               |
| Acciones contextuales                   | No había acciones por fila en resultados.                                                                                           | «Abrir» reserva, «Huésped» y «Check-in» (este último abre el wizard).                                                                 |
| Flujo guiado de check-in                | Modal plano que asignaba habitación y confirmaba en un paso.                                                                        | Wizard Reserva → Habitación → Huéspedes → Confirmar.                                                                                  |
| Revalidación de habitación en backend   | Solo al `POST /check-in`, con errores genéricos.                                                                                    | `GET .../check-in-readiness` de solo lectura + revalidación transaccional en el `POST`.                                               |
| Habitaciones sucias/bloqueadas          | El backend ya validaba estado operativo, bloqueo, ocupación y solapamiento; no housekeeping.                                        | Se agrega el bloqueo por housekeeping (`DIRTY`/`CLEANING`).                                                                           |
| Acción de folio/Caixa desde resultados  | No existía.                                                                                                                         | No se agregó: el listado no expone saldos y el contrato de folio requiere permiso y proyección propios. Queda como brecha consciente. |

---

## 3. Backend

### 3.1 Búsqueda sobre `GET /api/v1/reservations`

- `search` mantiene el `OR` de Prisma sobre `code`, `guest.fullName` y `room.number`. Cuando el texto contiene letras, se resuelve además una lista de IDs con `unaccent` y se agrega al mismo `OR`. La UH se busca por ese mismo campo; no se agregó un filtro separado.
- La consulta raw:

  ```sql
  SELECT r."id"
  FROM "Reservation" r
  JOIN "Guest" g ON g."id" = r."guestId"
  WHERE r."organizationId" = $1::uuid
    AND r."propertyId" = $2::uuid
    AND public.unaccent(lower(g."fullName")) LIKE public.unaccent($3::text) ESCAPE '!'
  ORDER BY r."checkInDate" ASC, r."id" ASC
  LIMIT 200
  ```

- El patrón se escapa (`!`, `%`, `_`) antes de llegar a `LIKE`; la consulta solo devuelve IDs y el `where` externo de Prisma reaplica tenant, estado, fechas y paginación. El orden del listado sigue siendo `checkInDate ASC, id ASC`.
- Límite de página: `limit` 1–100 (default 50), `cursor` por `id`, respuesta `{ items, nextCursor }`.

### 3.2 `GET /api/v1/front-office/reservations/:id/check-in-readiness`

- Permiso: `front_office.read`. Guard: auth + tenant. `ParseUUIDPipe` en el ID.
- Reconciliación previa de bloqueos vencidos (`roomState.reconcileProperty`) y búsqueda de la reserva por `id + organizationId + propertyId`; si no pertenece a la propiedad responde `404 reservation_not_found`.
- Devuelve:

  ```ts
  interface CheckInReadiness {
    reservation: ReservationSummaryResponse;
    checkInWindow: {
      localDate: string;
      checkInDate: string;
      checkOutDate: string;
      allowed: boolean;
      code: 'check_in_too_early' | 'check_in_window_elapsed' | null;
    };
    currentRoomId: string | null;
    currentRoomEligible: boolean | null; // null si la reserva no tiene UH
    rooms: CheckInRoomOption[];
  }
  ```

- `rooms` son las unidades `ACTIVE` del room type de la reserva. Cada opción incluye `housekeepingState`, `operationalState`, `occupancy`, `activeBlock`, `eligible` y `reasons`.
- Razones: `ROOM_OUT_OF_SERVICE`, `ROOM_BLOCKED`, `ROOM_OCCUPIED`, `ROOM_NOT_AVAILABLE` (reserva activa solapada) y `HOUSEKEEPING_NOT_READY`.
- `checkInWindow` usa la misma función que el check-in: `localDate` de la propiedad, `checkInDate`, `checkOutDate` y `allowed`/`code` (`check_in_too_early`, `check_in_window_elapsed`). La ventana es `[checkInDate, checkOutDate)` y no depende del día operativo. El wizard bloquea el avance cuando `allowed` es `false`.
- Es de solo lectura: no reserva ni bloquea la habitación. La autoridad sigue siendo `POST /check-in`, que repite las validaciones con locks dentro de la transacción.

### 3.3 Reglas de check-in

- `CHECK_IN_BLOCKED_HOUSEKEEPING_STATES = [DIRTY, CLEANING]`.
- `CLEAN` e `INSPECTED` se admiten. `INSPECTION_PENDING` se admite por defecto y queda como decisión del hotel piloto (ver ADR-050). La política se refleja en los `reasons` de cada habitación; la UI no duplica la lista de estados.
- Al confirmar, si la habitación está `DIRTY` o `CLEANING`, el endpoint responde `409 room_housekeeping_not_ready` con `details.housekeepingState`.
- Se conservan las validaciones existentes: estado de reserva, ventana de check-in, habitación asignada/activa/disponible, bloqueo, ocupación in-house, solapamiento y bloqueo legal de la fiesta.
- `lockRoom` devuelve también `housekeepingState` para que la validación transaccional use el valor leído con lock.

### 3.4 Migración

`prisma/migrations/20261116120000_phase12_search_unaccent/migration.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS unaccent;
ALTER EXTENSION unaccent SET SCHEMA public;
```

Es aditiva: no altera tablas, columnas, índices ni constraints. La extensión se fija en `public` porque Prisma limita `search_path` al esquema de la conexión (incluidos los esquemas E2E aislados); la consulta la invoca como `public.unaccent(...)`. Requiere permiso para crear extensiones (o que un DBA la cree en `public` antes de migrar).

---

## 4. Frontend

### 4.1 Buscador de Front Desk

- Componente dentro de `apps/web/src/app/(app)/front-office/page.tsx`, arriba de los indicadores.
- Campos: «Huésped, reserva o UH» (texto libre), «Desde», «Hasta» y «Estado»; botones «Buscar» y «Limpiar filtros».
- La consulta usa `limit=25` y «Cargar más» reutiliza `nextCursor`.
- Tabla de resultados: huésped principal, código, UH o «Sin UH», llegada, salida, estado, tipo y acciones. No se muestran saldos ni documentos.
- Estados: cargando, error con reintento, sin resultados y resultados. Los filtros inválidos de fecha se muestran con el mensaje del backend.
- Query string: `q`, `fromDate`, `toDate`, `status` con `window.history.replaceState`; al recargar o entrar por deep link se restauran los filtros y se dispara la búsqueda.
- En tablet la tabla conserva scroll horizontal, pero la columna «Acciones» queda fija a la derecha (`position: sticky`) para que abrir reserva, huésped y check-in sigan visibles sin desplazar la tabla.
- Deep links relacionados: `/reservations?reservation=<id>` y `/reservations?search=<texto>`; `/guests?search=<texto>`.

### 4.2 Wizard de check-in

`apps/web/src/components/check-in-wizard.tsx`, modal `xl` con cuatro pasos:

1. **Reserva:** huésped, código, fechas, ocupación, tipo, observaciones e instrucciones relevantes para la llegada. Permite «Confirmar lectura» de una instrucción `NEW` sin ejecutar pagos ni tarifas.
2. **Habitación:** lista de unidades del tipo con housekeeping, estado operativo, ocupación y bloqueo; las no elegibles muestran sus razones y no se pueden seleccionar. Si la UH actual no cumple, se avisa. Al continuar se asigna la UH con `POST /reservations/:id/room-assignment` y se recarga la elegibilidad.
3. **Huéspedes:** fiesta de la reserva con documento/contacto, marca de bloqueo legal y enlace al perfil del huésped.
4. **Confirmar:** resumen final; el botón se deshabilita si la ventana está cerrada, hay bloqueo de fiesta o no hay una habitación elegible seleccionada. Solo se muestra éxito después de la respuesta del backend.

El wizard no implementa preautorizaciones, cobros ni cambios de tarifa; una instrucción de pago queda como pendiente y así se etiqueta.

### 4.3 Tipos y etiquetas

- `CheckInRoomBlockReason`, `CheckInRoomOption`, `CheckInReadiness` en `apps/web/src/lib/types.ts`.
- `CHECK_IN_BLOCK_REASON_LABELS` en `apps/web/src/lib/format.ts`.
- La UI permanece en español, igual que el resto de la aplicación; los valores de dominio no se traducen.

---

## 5. Pruebas y verificación

Ejecutadas el 2026-11-16:

| Comprobación                 | Comando                                                                                         | Resultado                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Typecheck API                | `pnpm --filter @nova/api typecheck`                                                             | Verde                                      |
| Lint API                     | `pnpm --filter @nova/api lint`                                                                  | Verde                                      |
| Typecheck web                | `pnpm --filter @nova/web typecheck`                                                             | Verde                                      |
| Lint web                     | `pnpm --filter @nova/web lint`                                                                  | Verde                                      |
| Unit parser de instrucciones | `pnpm --filter @nova/api test -- instruction-parser`                                            | 18/18                                      |
| E2E API aislado              | `pnpm test:e2e:isolated`                                                                        | 15/15 suites, 132/132 tests                |
| UI real                      | `pnpm --filter @nova/web exec playwright test e2e/front-office-checkin.spec.ts --reporter=list` | 2/2                                        |
| Tablet                       | Chromium 768×1024 y 1024×768                                                                    | Sin overflow; acciones y wizard accesibles |

Cobertura E2E agregada:

- readiness con habitaciones elegibles y no elegibles, incluyendo razones de housekeeping y bloqueo;
- check-in rechazado en habitación `DIRTY` (`room_housekeeping_not_ready`);
- readiness de una reserva de otra propiedad → 404 y sin fuga de datos;
- ventana de check-in abierta, demasiado temprana y vencida, y rechazo transaccional `check_in_window_elapsed`;
- búsqueda por nombre sin acentos, por UH y por código, con paginación y scoping tenant;
- Playwright: reserva futura → el wizard muestra el aviso y deshabilita «Continuar»; y reserva del día → crea huésped `José E2E <sufijo>`, busca `jose e2e <sufijo>`, recorre el wizard, confirma el check-in, verifica la estancia en el overview y limpia con checkout en `finally`.

La suite E2E usa esquemas aislados y el seed sintético; no toca datos reales.

---

## 6. Evidencia visual

`docs/img/fase1-frontdesk-search.png` — Front Desk a 1440×900 con la sesión «Admin Demo Aurora» y `?q=elisa`: el buscador conserva el texto en la URL y devuelve `DEMO-1104` (Elisa Prado) con fechas, estado y acciones.

Tablet:

- `docs/img/tablet-768-search.png` y `docs/img/tablet-1024-search.png`: el documento no desborda (`scrollWidth = innerWidth`) y las acciones de la fila quedan visibles en la columna fija.
- `docs/img/tablet-768-wizard-room.png`: el wizard entra en 768×1024, el cuerpo scrollea y el pie queda accesible.
- `docs/img/tablet-1024-wizard-summary.png`: recorrido completo hasta el resumen en 1024×768 con «Confirmar check-in» visible; se cerró sin confirmar.

Antes de fijar la columna, a 768 y 1024 las acciones quedaban fuera del área visible de la tabla y solo se alcanzaban con scroll horizontal. El wizard no requirió cambios: en ambos tamaños el diálogo cabe en el viewport, el listado de habitaciones scrollea dentro del cuerpo y el pie permanece visible.

---

## 7. Decisiones

Documentadas en `docs/DECISIONS.md`:

- **ADR-050:** reutilizar `GET /reservations` en lugar de crear `/front-office/search`; resolver acentos con `unaccent` sobre IDs y mantener el `OR` de Prisma; readiness de solo lectura con revalidación transaccional; `DIRTY`/`CLEANING` bloquean y `INSPECTION_PENDING` queda configurable; wizard extraído a componente; filtros en query string con `replaceState`.

---

## 8. Limitaciones y pendientes

1. **Política de inspección pendiente:** `INSPECTION_PENDING` se admite por defecto. Requiere definición del hotel piloto; el cambio es de una constante en el backend.
2. **Ventana de check-in:** readiness la expone y el wizard bloquea el avance; el backend sigue revalidando en la transacción y puede rechazar por cambio de fecha entre la consulta y la confirmación.
3. **Saldo/preautorización:** no se consulta ni se bloquea; sigue siendo una decisión de producto. Tampoco se muestra saldo en resultados.
4. **Acción de folio/Caixa:** no se agregó a la fila; requiere un contrato permission-aware que hoy el listado no ofrece.
5. **Techo de 200 IDs:** una búsqueda acentuada muy amplia puede omitir coincidencias más allá del límite; el `contains` exacto sigue cubriendo el resto.
6. **Extensión `unaccent`:** el despliegue necesita permiso para crearla en `public`; si no, la migración falla y debe resolverse en infraestructura.
7. **Idioma:** la UI sigue en español; la ficha prioriza pt-BR. Cambiar el idioma es un trabajo transversal, no de esta fase.
8. **Datos de demo:** para la captura se refrescó el seed sintético (`pnpm db:seed`), que reajusta las fechas relativas de las reservas demo.

---

## 9. Archivos principales

- `apps/api/src/reservations/reservations.service.ts`
- `apps/api/src/front-office/front-office.service.ts`
- `apps/api/src/front-office/front-office.controller.ts`
- `prisma/migrations/20261116120000_phase12_search_unaccent/migration.sql`
- `apps/api/test/front-office.e2e-spec.ts`
- `apps/api/test/guests-reservations.e2e-spec.ts`
- `apps/web/src/components/check-in-wizard.tsx`
- `apps/web/src/app/(app)/front-office/page.tsx`
- `apps/web/src/app/(app)/reservations/page.tsx`
- `apps/web/src/app/(app)/guests/page.tsx`
- `apps/web/src/lib/types.ts`
- `apps/web/src/lib/format.ts`
- `apps/web/e2e/front-office-checkin.spec.ts`
- `docs/API.md`, `docs/DATABASE.md`, `docs/DECISIONS.md`, `docs/v4/NOVA_PMS_FICHA_04_OPENCODE_TECHNICAL.md`
- `docs/img/fase1-frontdesk-search.png`
