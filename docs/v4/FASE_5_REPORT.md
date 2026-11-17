# Fase 5 — UX guiada de cambio de habitación

**Fecha:** 2026-11-17
**Ficha:** `docs/v4/NOVA_PMS_FICHA_04_OPENCODE_TECHNICAL.md`, sección «Fase 5 — Cambio de habitación».
**Estado:** ejecutada. Backend, UI, pruebas y documentación en el mismo cambio.
**Rama:** `main`. Sin migración: la fase reutiliza el modelo existente.

---

## 1. Resumen

El cambio de habitación deja de ser un selector alimentado por el room rack. Recepción abre la estancia
en casa, pulsa «Mover» y obtiene un flujo guiado: habitación actual con su housekeeping, huésped y datos
de la reserva (fechas, noches, ocupantes), lista de destinos con filtros y motivos de rechazo,
comparación origen/destino y confirmación con motivo obligatorio y auditoría.

El backend no duplica reglas: un nuevo read model `GET /front-office/stays/:id/room-move-candidates`
y la transacción existente `POST /front-office/stays/:id/room-move` comparten los mismos predicados
(`apps/api/src/front-office/room-move.ts`). La lista de candidatas no puede ofrecer algo que la
transacción rechace, y el primer bloqueo mostrado coincide con el error que devolvería la
confirmación. No se creó un endpoint de movimiento paralelo.

---

## 2. Existente / falta / se modifica

| Requisito de la ficha | Antes | Ahora |
| --------------------- | ----- | ----- |
| Mostrar reserva/estancia y habitación actual | El modal recibía el `Stay` de la fila | La cabecera del modal muestra huésped, código, fechas, noches, ocupantes y habitación actual con tipo, piso, ala y housekeeping |
| Listar habitaciones destino candidatas | Selector con el room rack, sin elegibilidad | `GET /stays/:id/room-move-candidates` con el inventario de la propiedad menos la habitación actual |
| Filtros por tipo/capacidad/piso/ala/estado | Ninguno | Tipo (con capacidad visible), piso, ala/edificio, housekeeping y búsqueda por UH, combinables |
| Excluir destinos no elegibles | No se sabía hasta enviar el formulario | Ocultas por defecto; «Mostrar no elegibles» las lista con su bloqueo (`ROOM_MOVE_BLOCKER_LABELS`) |
| Mostrar diferencias y advertencias | Ninguna | Panel de comparación actual/destino con housekeeping y advertencia `housekeeping_not_ready` |
| Motivos de rechazo sin duplicados | n/a | Una habitación ocupada reporta sólo `room_occupied`; la reserva de la estancia ocupante no se repite como `room_not_available` |
| Solicitar motivo | Opcional | Obligatorio en UI (3–500) y opcional en API con default `Room move.` |
| Confirmar | `POST` con `roomId` | Igual, con revalidación transaccional; conflicto explicado y alternativas refrescadas |
| Mostrar resultado y habitación nueva | Toast genérico | Panel «Cambio registrado» con `Hab. origen → Hab. destino` y nota de auditoría |
| Reutilizar el endpoint existente | Sí | Sí; el contrato sólo gana `reason` documentado y errores explícitos |
| Auditar actor, fecha, origen, destino y motivo | `reservation.room_moved` sin números de habitación | Auditoría ampliada con `fromRoomNumber`/`toRoomNumber`; se mantiene `ReservationHistory` |

---

## 3. Modelo y migración

No hay cambios de esquema ni migración. `RoomMoveCandidate` es un read model calculado en la
respuesta; el movimiento sigue escribiendo `Stay`, `Reservation`, `ReservationHistory` y `AuditEvent`.

---

## 4. API

| Método | Ruta | Permiso | Notas |
| ------ | ---- | ------- | ----- |
| GET | `/api/v1/front-office/stays/:id/room-move-candidates` | `front_office.read` | Solo lectura; no reserva ni adquiere lease |
| POST | `/api/v1/front-office/stays/:id/room-move` | `front_office.manage` | Transaccional; cuerpo `{ roomId, reason? }` |

Contrato del read model:

- `stay`: `id`, `status`, habitación actual (`number`, `floor`, `building`, `housekeepingState`,
  `roomType` con capacidad), `guest` y `reservation` (`code`, `status`, `checkInDate`, `checkOutDate`,
  `nights`, `adults`, `children`).
- `candidates`: todas las demás habitaciones de la propiedad con `roomType`, `housekeepingState`,
  `operationalState`, `occupancy` (`VACANT`/`OCCUPIED`), `activeBlock`, `eligible`, `blockers` y
  `warnings`.
- `blockers` (en el orden en que la transacción rechazaría): `room_inactive`, `room_out_of_service`,
  `room_type_mismatch`, `room_block_overlap`, `room_occupied`, `room_not_available`.
- `warnings`: `housekeeping_not_ready` cuando el destino no está `CLEAN` ni `INSPECTED`. Housekeeping
  no bloquea el movimiento (la regla transaccional histórica lo permite), pero se advierte.

Reglas revalidadas dentro de la transacción: estancia `IN_HOUSE`; habitación `ACTIVE` y `AVAILABLE`;
mismo room type que la reserva; sin bloqueo activo que se solape con la estancia (hasta el check-out);
sin otra estancia in-house; sin reserva solapada. Mover a la habitación actual es idempotente y no
incrementa `moveCount` ni audita.

Errores de conflicto: `stay_not_in_house` (tanto en el read model como en el movimiento cuando la
estancia dejó de estar `IN_HOUSE`), `room_inactive`, `room_out_of_service`, `room_type_mismatch`,
`room_block_overlap`, `room_occupied`, `room_not_available`; `404 stay_not_found` fuera del contexto
autorizado.

---

## 5. UI

- `/front-office` (pestaña «En casa») — botón «Mover» de cada estancia abre el modal guiado.
- El modal carga candidatas con indicador de carga y permite reintentar tras error; usa un contador de
  peticiones para descartar respuestas fuera de orden al cambiar de estancia o refrescar.
- Filtros: tipo de habitación (muestra `adultosA / menoresN`), piso, ala/edificio, housekeeping y UH,
  más «Mostrar no elegibles». El filtro de tipo se inicializa con el tipo de la reserva, porque mover a
  otro tipo está prohibido por la regla actual.
- Tabla de destinos con UH, tipo/capacidad, piso/ala, housekeeping, ocupación, estado operativo, bloqueo
  vigente y motivo de inelegibilidad. Las filas no elegibles se atenúan y su botón queda deshabilitado.
  La columna «Acción» es sticky a la derecha y la tabla tiene un ancho mínimo con scroll horizontal
  explícito, de modo que los botones «Elegir»/«Elegida» quedan siempre visibles y clicables en desktop
  y tablet aunque los motivos de rechazo alarguen la fila.
- Panel de comparación con la habitación actual y el destino elegido, más la advertencia de
  housekeeping cuando corresponde.
- Motivo obligatorio en UI; el backend mantiene el default para clientes que no lo envían.
- Resultado en el mismo modal con la transición de UH; el room rack, las llegadas y las incidencias se
  recargan al cerrar la operación. En conflicto, se muestra un mensaje específico por código y se
  refrescan las alternativas sin cerrar el modal.
- La vista histórica sigue sin acciones operativas; el botón «Mover» sólo aparece en el día operativo
  actual.

Los textos nuevos están en español, igual que el resto de la aplicación; la traducción transversal a
`pt-BR` sigue en la Fase 7 de la ficha.

---

## 6. Pruebas

`apps/api/test/front-office.e2e-spec.ts` — casos nuevos/extendidos sobre habitaciones dedicadas
(`E2E-…-A`, `-B`, `-C`, `-D`, `-E` y `-F`) para no depender de los datos demo. La habitación `-F` es
sucia y no tiene reservas, de modo que el caso de housekeeping no queda contaminado por la reserva
pendiente que usa la prueba de check-in en habitación sucia:

1. `exposes room-move candidates with eligibility, warnings and tenant scope` — contexto de la estancia
   (habitación actual, fechas, noches, ocupantes), exclusión de la habitación actual, destino libre
   elegible, habitación sucia elegible **con** `housekeeping_not_ready`, habitación bloqueada y fuera de
   servicio con ambos bloqueos, tipo distinto con `room_type_mismatch`, lectura permitida con
   `front_office.read`, `403` para un rol sin ese permiso, `403` al intentar mover sin
   `front_office.manage` y `404 stay_not_found` con un id ajeno.
2. `moves an in-house stay to another room and rejects room type mismatches` — movimiento exitoso,
   `moveCount = 1`, reserva actualizada, `409 room_type_mismatch` al intentar otro tipo.
3. `rejects a blocked destination, keeps the new room and audits the move` — `409 room_out_of_service`
   (el bloqueo out-of-order cambia primero el estado operativo, así que ese es el primer bloqueo, igual
   que en la lista de candidatas) sin mover la estancia, alternativas refrescadas con la habitación
   actual excluida y origen elegible, auditoría `reservation.room_moved` con actor y motivo, e historial
   de reserva con origen/destino.
4. `marks a room taken by another in-house stay as ineligible and rejects the move` — una segunda
   estancia in-house ocupa el destino: `occupancy: OCCUPIED`, `room_occupied` en `blockers`, `409` al
   confirmar y estancia original intacta.
5. `rejects room-move candidates for a stay that already checked out` — tras el check-out, el read
   model responde `409 stay_not_in_house` con `details.status = CHECKED_OUT` y el movimiento devuelve
   el mismo código, de modo que la lista no ofrece destinos que la transacción nunca aceptaría.

### Comandos ejecutados

| Comando | Resultado |
| ------- | --------- |
| `pnpm --filter @nova/api typecheck` | OK |
| `pnpm --filter @nova/web typecheck` | OK |
| `pnpm --filter @nova/api lint` | OK |
| `pnpm --filter @nova/web lint` | OK |
| `pnpm test:e2e:isolated` | 17 suites / 155 tests OK (schema temporal creado y eliminado) |

No se ejecutó la suite Playwright de navegador ni capturas: el flujo no se verificó visualmente en esta
sesión (ver limitaciones).

---

## 7. Estado de aceptación (Fase 5)

| Criterio de la ficha | Estado | Evidencia |
| -------------------- | ------ | --------- |
| Movimiento exitoso con revalidación transaccional | `PROBADO` | E2E 2 (`room-move`, `moveCount`, reserva) |
| Movimiento rechazado por conflicto (bloqueo, ocupación, tipo, solapamiento) | `PROBADO` | E2E 1, 2, 3, 4 |
| Permisos (`front_office.read`/`manage`) | `PROBADO` | E2E 1 |
| Auditoría con actor, motivo y habitaciones | `PROBADO` | E2E 3 (`AuditEvent` + `ReservationHistory`) |
| Aislamiento tenant/propiedad | `PROBADO` (API) | Filtros por organización/propiedad en el servicio + E2E de `stay_not_found` |
| UX guiada: actual, candidatas, filtros, diferencias, motivo, resultado | `IMPLEMENTADO` | `/front-office`, modal «Cambiar habitación» |
| UX validada con prueba de usuario/navegador | `NO INICIADO` | Requiere Playwright y servidores; no ejecutado en esta sesión |
| Evidencia visual (desktop/tablet/estados) | `NO INICIADO` | Sin capturas |

---

## 8. Limitaciones y decisiones abiertas

- **Housekeeping**: mover a una habitación sucia está permitido y sólo se advierte. Si el piloto exige
  bloquearlo, se cambia la regla en `room-move.ts` y ambos caminos la heredan (ADR-056).
- **Motivo**: obligatorio en UI, opcional en API con default `Room move.`. Si debe ser siempre exigido,
  se cambia el DTO (hoy `reason` es opcional por compatibilidad).
- **Sin lease**: el cambio no adquiere el lease de asignación; el destino se valida sólo al confirmar.
  Dos recepcionistas pueden elegir la misma habitación y una recibirá el conflicto.
- **Inventario completo**: las candidatas devuelven todas las habitaciones de la propiedad en una sola
  respuesta. Aceptable para inventarios acotados; si crece, se pagina sin tocar la transacción.
- **Capacidad**: se muestra por tipo y se filtra a través del tipo, no con un rango numérico propio,
  porque la regla actual exige el mismo tipo de la reserva.
- **UI sin verificación en navegador**: typecheck y lint pasan, pero no hubo prueba visual ni Playwright
  en esta sesión. Textos en español (Fase 7 pendiente).
- **Roles**: quién puede mover estancias no está separado de `front_office.manage`; si el hotel necesita
  un permiso específico, se agrega sin cambiar el contrato (ADR-056, validación pendiente).

---

## 9. Siguiente paso recomendado

Fase 6 (sistema consistente de mensajes y confirmaciones) puede reutilizar el patrón de este modal —
título específico, consecuencia visible, bloqueo de doble submit y refresco tras conflicto — para
normalizar `ConfirmDialog`/`WarningDialog` y los toasts de error por código de dominio.
