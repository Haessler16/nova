# Fase 3 — Real-time & Experience Enhancements

**Estado**: Planificación inicial, trabajo incremental sobre base verificada.

**Fecha**: 2026-11-16

**Autoridad de integridad**: PostgreSQL continúa siendo autoridad final. Redis sigue siendo coordinación efímera. Se añaden Durable Objects / SSE para actualizaciones en tiempo real.

---

## Objetivo

Mejorar la experiencia de room rack y check-in con:

- Actualizaciones en tiempo real (SSE / WebSocket / Durable Objects)
- Lease con TTL configurable y liberación forzada con auditoría
- Room move que adquiere y transfiere lease entre sesiones
- Soporte dark mode completo
- Pilot con hotel específico definiendo TTL definitivo y permisos

---

## Entregado

### Backend

- [x] Lease Redis: TTL configurable por entorno, rango 1–600 s (Fase 2, `ROOM_ASSIGNMENT_LEASE_TTL_SECONDS`)
- [x] Lease liberación forzada: `POST /inventory/rooms/:id/lease-release` + auditoría `room_lease_released_forced` con actor, dueño anterior y razón
- [x] Transferencia de lease: `POST /inventory/rooms/:id/assignment-leases/transfer` (adquiere destino, luego libera origen propio)
- [x] SSE: `GET /inventory/rooms/updates` con eventos `ready`, `room.updated`, `room.housekeeping`, `room.block_changed`, `room.lease_changed`
- [x] Publicación de eventos después del commit, por organización y propiedad
- [x] `RoomAssignmentLeasesService.releaseForced()` y `transfer()` con auditoría; `RedisService.del()`
- [x] Tests: 4 casos e2e de stream (ready + evento, dos suscriptores concurrentes del mismo tenant, aislamiento por propiedad, sesión requerida) y 3 casos e2e de liberación forzada/transferencia
- [ ] `room_lease_expired` como código de error explícito (la expiración se resuelve con `404 room_lease_not_found` en `renew`; el rack converge por polling)
- [ ] `POST /inventory/rooms/:id/room-move`: reemplazado por transferencia de lease; el movimiento real sigue en `POST /reservations/:id/room-assignment` (ver ADR-052)
- [ ] Dark mode tokens en `theme/index.ts`
- [ ] `updatedByUserId` no nulo vía trigger: no implementado (sigue nulo en filas sembradas hasta la próxima mutación)

### Frontend

- [x] Room rack consume el stream SSE y refresca sin spinner; polling cada 15 s como fallback y reconexión con backoff exponencial (2 s → 30 s)
- [x] Drawer: "Liberar selección forzada" con motivo obligatorio cuando el lease es de otra sesión; registra la auditoría
- [ ] Room move desde el drawer (depende de la decisión de producto sobre mover estancias; hoy es una acción de Front Office)
- [ ] Calendar dark mode
- [ ] Badge `subtle` dark mode variant

### Datos y documentación

- [x] `docs/v4/FASE_3_REPORT.md` con scope, estado y criterios de aceptación
- [x] `docs/API.md`: lease-release, transferencia, SSE y notas de comportamiento
- [x] `docs/DECISIONS.md`: ADR-052 (override y transferencia de lease), ADR-053 (SSE en proceso con fallback)
- [ ] Migración aditiva para trigger de `updatedByUserId`
- [ ] Capturas pilot (room move, liberación forzada, dark mode)

---

## Criterios de aceptación (tentativos)

| Criterio                                  | Estado                  | Evidencia                                                                                                                                                                                                                                            |
| ----------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lease TTL configurable por entorno        | Cumplido                | `ROOM_ASSIGNMENT_LEASE_TTL_SECONDS` validado a 1–600 s; el e2e lo fija en 2 s para probar expiración                                                                                                                                                 |
| Liberación forzada de lease con auditoría | Cumplido                | `POST /inventory/rooms/:id/lease-release` → `200 { released, previousOwnerDisplayName }` + `AuditEvent room_lease_released_forced` con actor, dueño anterior y razón (e2e)                                                                           |
| Transferencia de lease para room move     | Cumplido (coordinación) | `POST /inventory/rooms/:id/assignment-leases/transfer` → `{ from, to }`; `409 room_lease_held` si el destino está tomado y el origen conserva su lease (e2e). El movimiento real sigue en `POST /reservations/:id/room-assignment`                   |
| SSE de actualizaciones del rack           | Cumplido                | `GET /inventory/rooms/updates` emite `ready` y propaga `room.updated` al cambiar una habitación; dos pestañas del mismo tenant reciben el mismo evento con el mismo `id`; una propiedad no recibe eventos de otra; sin sesión responde `401` (4 e2e) |
| Realtime en frontend con fallback         | Cumplido (código)       | El rack consume el stream con `fetch`, refresca con debounce de 250 ms y cae a polling de 15 s con backoff; no verificado en navegador en esta sesión                                                                                                |
| Dark mode contraste AA                    | Pendiente               | Requiere paleta dark y revisión visual de 17 pantallas; no iniciado                                                                                                                                                                                  |
| Badge subtle dark mode                    | Pendiente               | Depende de la paleta dark                                                                                                                                                                                                                            |

---

## Limitaciones y preguntas abiertas

- **Lease vs reserva**: Sigue siendo coordinación de UX. PostgreSQL sigue siendo autoridad de integridad contra doble asignación.
- **Redis como single point de coordinación**: En producción con múltiples instancias de API, el lock de Redis debe ser distribuido ( RedLock ) o reemplazado por Durable Object binding `env.REALTIME`.
- **SSE vs WebSocket**: SSE es más simple para un solo canal de "room updates". WebSocket requiere manejo de conexiones persistentes y reconexión. Durable Objects proveen estado compartido nativo.
- **Dark mode production**: El tema actual (`light` por defecto) requiere expansión del palette para dark mode sin romper la brand identity.
- **Pilot hotel**: ¿Cuál propiedad ejecutará la Fase 3? ¿Se requiere migrar datos reales o es sintético?

---

## Estado por sprint

| Sprint | Alcance                                           | Estado                                                                                                                                                                                                                               |
| ------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1      | TTL configurable + liberación forzada + auditoría | **Entregado** — endpoint, servicio, `RedisService.del()` y e2e de liberación forzada (200, `released: false` idempotente, `403` sin permiso, auditoría con razón y dueño anterior)                                                   |
| 2      | Room move con lease                               | **Entregado como transferencia de lease** — adquiere destino primero, libera solo origen propio, `409` si el destino está tomado y conserva el lease vigente. El movimiento de reserva/estancia no se duplica en inventory (ADR-052) |
| 3      | SSE del rack                                      | **Entregado en backend, integrado en frontend** — `RoomEventsService`, `GET /inventory/rooms/updates`, publicación tras commit, 3 e2e (stream, aislamiento por propiedad, autenticación). El rack usa SSE + polling de respaldo      |
| 4      | Dark mode                                         | **No iniciado** — requiere definir la paleta dark y revisar 17 pantallas; ~170 superficies usan colores claros fijos, así que un modo parcial dejaría la UI inconsistente                                                            |
| 5      | Piloto + reporte final                            | **Bloqueado** — falta elegir la propiedad piloto (OPEN QUESTION)                                                                                                                                                                     |

## Verificación ejecutada

| Comando                                                                              | Resultado |
| ------------------------------------------------------------------------------------ | --------- |
| `pnpm --filter @nova/api typecheck`                                                  | OK        |
| `pnpm --filter @nova/api lint`                                                       | OK        |
| `pnpm --filter @nova/api test`                                                       | 115/115   |
| `pnpm test:e2e:isolated` (suite completo sobre seed aislado)                         | 144/144   |
| `pnpm --filter @nova/api test:e2e -- inventory.e2e-spec.ts front-office.e2e-spec.ts` | 35/35     |
| `pnpm --filter @nova/api test:e2e -- room-updates.e2e-spec.ts`                       | 4/4       |
| `pnpm --filter @nova/web typecheck`                                                  | OK        |
| `pnpm --filter @nova/web lint`                                                       | OK        |
| `pnpm --filter @nova/web exec playwright test e2e/inventory-validation.spec.ts`      | 3/3       |

No se ejecutaron: `front-office-checkin.spec.ts` ni la verificación visual de dos pestañas viendo el rack sincronizado; la sincronización está cubierta en el e2e de backend, no en navegador.

## Roadmap sugerido (órden de prioridad)

1. **Sprint 1**: Lease TTL configurable + liberación forzada + auditoría

   - Endpoint `POST /inventory/rooms/:id/lease-release`
   - Validación de rango TTL (1–600)
   - Registro en tabla de auditoría `RoomLeaseEvent`
   - Test E2E: adquisición, renovación, liberación forzada, reasignación posterior

2. **Sprint 2**: Room move con lease

   - Endpoint `POST /inventory/rooms/:id/room-move`
   - Flujo: adquiere lease destino → valida constraint PG → libera origen → retorna nuevo estado
   - Manejo de conflictos: 409 si destino tiene lease ajeno, 409 si origen lease ajeno y no se puede liberar

3. **Sprint 3**: SSE updates para room rack

   - Endpoint `GET /inventory/rooms/updates?lastEventId=X`
   - Frontend: reconexión automática, fallback a polling cada 15 s si SSE error
   - Test E2E: dos pestañas ven mismo rack sincronizado en <2 s

4. **Sprint 4**: Dark mode full stack

   - Expandir `theme/index.ts` con `dark` colorScheme usando los mismos tokens `sky.`, `mint.`, etc.
   - `date-field.tsx` dark mode: contraste AA verificado (usar `sky.100` fondo con `sky.900` texto, o inverso según legibilidad)
   - Badge `subtle` dark variant
   - Test visual en modo dark

5. **Sprint 5**: Pilot hotel + reporte final
   - Aplicar todo lo anterior en una propiedad pilot
   - Capturas antes/después
   - FASE_3_REPORT.md final con evaluación y limitaciones remanentes
