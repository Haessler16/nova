# Fase 2 — Room Rack, drawer contextual y lease temporal

- Estado: implementado y verificado en local.
- Fecha: 2026-11-16.
- Alcance: Ficha 04, Fase 2 (R-03 y R-04) sobre el inventario y Front Office existentes.
- Autoridad de integridad: PostgreSQL. Redis solo coordina la selección efímera.

## Objetivo

Convertir `/inventory/rooms` en un room rack operativo para recepción y housekeeping, con filtros y contadores confiables, contexto de estancia/bloqueo/lease en un drawer y coordinación temporal entre dos sesiones sin agregar una fuente de verdad paralela.

## Entregado

### Backend

- `GET /inventory/rooms` enriquecido:
  - `occupancy` derivada de una estancia `IN_HOUSE`;
  - `currentStay`, `nextArrival`, `activeBlock`, `updatedBy` y `lease`;
  - `summary` con total, libres, ocupadas y contadores de housekeeping/operativo;
  - `facets` de pisos y edificios.
- Filtros server-side combinables: `roomTypeId`, `status`, `housekeepingState`, `operationalState`, `occupancy`, `floor`, `building`, `minCapacity`, `search`, `cursor`, `limit`.
- `Room.updatedByUserId` con migración aditiva, FK compuesta e índice; se actualiza en alta/edición, housekeeping y reconciliación operativa.
- Historial de habitación con `actorName` para mostrar quién hizo el cambio.
- Lease de selección en Redis:
  - clave por propiedad/habitación, TTL configurable (default 120 s, rango 1–600 s);
  - adquisición atómica `SET NX PX`;
  - renovación/liberación con Lua y comparación de `leaseId`;
  - errores tipados `room_lease_held`, `room_lease_conflict`, `room_lease_changed`, `room_lease_not_found`, `room_lease_owner_required`, `room_lease_unavailable`.
- `POST /reservations/:id/room-assignment` consulta el lease y rechaza a otro dueño con `409 room_lease_held`; la constraint de solapamiento sigue decidiendo el commit.
- `/front-office/reservations/:id/check-in-readiness` incluye el lease de cada habitación.

### Frontend

- Room rack con 8 contadores, filtros de UH/piso/ala/tipo/capacidad/ocupación/housekeeping/operativo, búsqueda y polling cada 15 s sin spinner.
- Tabla con ocupación, huésped/estancia, próxima llegada, bloqueo, housekeeping, estado operativo, última modificación y autor.
- Columna de acciones sticky; layout mínimo de 1065 px con scroll interno en tablet.
- Drawer contextual con:
  - housekeeping, operativo, ocupación, capacidad, piso/ala, última modificación y autor;
  - estancia actual o próxima llegada;
  - lease con dueño, vencimiento, renovar/liberar;
  - alta de incidencia vinculada a la habitación;
  - transición de housekeeping con motivo;
  - bloqueos activos y liberación;
  - historial con actor.
- Wizard de check-in:
  - adquiere lease al elegir habitación;
  - renueva cada 45 s;
  - libera al cambiar de habitación, cerrar, asignar o confirmar;
  - bloquea la selección de una habitación con lease ajeno y muestra el dueño.

### Datos y documentación

- Migración `20261116150000_phase2_room_updated_by`.
- `docs/API.md`: filtros, proyección, endpoints de lease, readiness y errores.
- `docs/DATABASE.md`: `updatedByUserId` y límite del lease.
- `docs/DECISIONS.md`: ADR-051.
- Capturas: `docs/img/fase2-rooms-desktop.png`, `fase2-rooms-drawer.png`, `fase2-rooms-tablet.png`.

## Criterios de aceptación

| Criterio | Estado | Evidencia |
| --- | --- | --- |
| Filtros por UH, piso, ala, tipo, capacidad, ocupación, housekeeping y operativo | Cumplido | E2E inventory: ocupación, piso/ala, capacidad y modificador |
| Contadores correctos e independientes de filtros | Cumplido | `summary` calculado sobre la propiedad; captura desktop |
| Columnas mínimas y acciones accesibles | Cumplido | Capturas desktop/tablet; acciones sticky |
| Drawer con contexto y acciones autorizadas | Cumplido | Estancia/próxima llegada, lease, incidencia, housekeeping, bloqueos, historial |
| Housekeeping auditado y separado de ocupación | Cumplido | E2E inventory + `RoomStatusHistory`; ADR-051 |
| Dos sesiones ven la selección y no inician una asignación conflictiva | Cumplido | E2E lease: listado, `409` de adquisición y `409` de asignación; polling 15 s |
| Lease expira y se libera sin bloquear la operación confirmada | Cumplido | E2E TTL 2 s, renovación, liberación y reasignación posterior |
| Integridad final ante doble asignación | Cumplido | Constraint PostgreSQL existente; lease advisory |
| Migración aditiva y multi-tenant | Cumplido | FK compuesta, consultas por `organizationId`/`propertyId` |

## Verificación ejecutada

```bash
pnpm --filter @nova/api typecheck     # OK
pnpm --filter @nova/web typecheck     # OK
pnpm --filter @nova/api lint          # OK
pnpm --filter @nova/web lint          # OK
pnpm test:e2e:isolated                # 15 suites, 137 tests OK
pnpm --filter @nova/api test:e2e -- inventory.e2e-spec.ts  # 16 tests OK
pnpm --filter @nova/web exec playwright test e2e/front-office-checkin.spec.ts  # 2 tests OK
```

La suite aislada crea un schema temporal, aplica las 18 migraciones, ejecuta el seed sintético y lo elimina. El test de lease usa `ROOM_ASSIGNMENT_LEASE_TTL_SECONDS=2` para no esperar el TTL de producción.

Verificación visual: Chromium real contra web `:3000` y API `:3001`.
- Desktop 1440×1000: tabla completa sin overflow, 45 habitaciones, contadores 34 libres / 11 ocupadas / 34 limpias / 4 sucias / 0 en limpieza / 7 inspeccionadas / 1 fuera de orden / 0 fuera de servicio.
- Drawer: lease visible, acciones de renovar/liberar y formulario de incidencia.
- Tablet 768×1024: UH, tipo, piso, ocupación y acciones visibles; housekeeping/operativo/actualizada requieren scroll horizontal interno.

## Limitaciones y preguntas abiertas

- El lease es coordinación de UX, no una reserva de habitación. Puede expirar entre la validación y el commit; PostgreSQL sigue siendo la autoridad.
- Sin Redis, las lecturas muestran `lease: null` y la adquisición devuelve `503 room_lease_unavailable`. La asignación autoritativa sigue disponible.
- Un navegador cerrado deja el lease hasta el TTL (120 s por defecto). No hay override manual; se requiere decisión de permiso y auditoría.
- La lista usa polling cada 15 s, no WebSocket/SSE. Dos sesiones pueden verse desactualizadas hasta ese intervalo.
- El drawer no ofrece room move ni un enlace directo a reserva/estancia; esas acciones siguen en Front Office. El room move no adquiere lease en esta fase.
- `updatedBy` queda nulo en filas sembradas o reconciliadas por sistema hasta la próxima mutación explícita.
- Queda para piloto: TTL definitivo, permiso de liberación forzada, si room move exige lease y si el rack debe pasar a realtime.
