# Phase 11 — Notes & Instructions v1

## Objetivo

Implementar el paquete `docs/v3` de notas e instrucciones: convertir observaciones libres de reservas en notas e instrucciones estructuradas, preservando el texto original, sin ejecutar pagos, cargos, cambios de tarifa ni asignaciones de habitación.

## Entregado

### API y persistencia

- Enums y modelos Prisma: `ReservationInstruction`, `ReservationSourceNote`, `InstructionEvent`, `GuestNote`.
- Migración aditiva `20261115130000_phase11_notes_instructions`.
  - Enums, tablas, índices y FKs.
  - FKs compuestas de tenant para impedir vínculos entre organización/propiedad distintas.
  - Trigger que rechaza `UPDATE`/`DELETE` sobre `ReservationSourceNote`.
  - Trigger que rechaza `UPDATE`/`DELETE` sobre `InstructionEvent`.
- Parser determinista pt-BR `pt-br-notes-v1` (`apps/api/src/instructions/instruction-parser.ts`).
  - Solo sugerencias con `requiresHumanConfirmation: true`.
  - `PGTO DIRETO NO HOTEL` → `PAYMENT_PREAUTHORIZATION` pendiente en `CHECK_IN` con `CREDIT_CARD`.
  - `PGTO ... LANÇADO NO CAIXA` → `VERIFY_PAYMENT` en `NEEDS_CLARIFICATION`.
  - Desayuno, upgrade, llegada, facturación, tarifa, confidencial y “no cancelar” generan sugerencias informativas o tareas, nunca mutaciones.
  - Redacción de PAN/CVV etiquetados y de PAN desnudo con Luhn antes de persistir; `sourceTextHash` conserva el digest del texto exacto recibido.
  - Fechas ambiguas y valores monetarios generan warnings.
- Servicio con RBAC y aislamiento (`apps/api/src/instructions/instructions.service.ts`).
  - Listado por visibilidad y categoría confidencial.
  - Creación, edición, transiciones y timeline de eventos.
  - Parse idempotente por hash de contenido.
  - Confirmación con dedupe por sugerencia; no crea pagos ni folios.
  - Notas de huésped independientes, con vencimiento y desactivación.
- Endpoints REST bajo el contexto de tenant por headers existente (`/api/v1/reservations/:id/...`, `/api/v1/guests/:id/notes`).
- Seed sintético idempotente: texto fuente de ejemplo, instrucciones de pago/desayuno/check-in y notas persistentes de Ana.
- Pruebas unitarias del parser: 11 casos.
- E2E `apps/api/test/instructions.e2e-spec.ts`: 17 casos, incluyendo preautorización pendiente, dedupe, redacción de tarjeta en texto fuente y en altas manuales de instrucciones/notas de huésped, separación de notas de huésped, visibilidad confidencial/finanzas, transiciones, auditoría y aislamiento cross-tenant/property.

### Web

- Tipos compartidos para instrucciones, sugerencias, texto fuente, eventos y notas de huésped.
- Etiquetas y colores para categoría, prioridad, estado, acción y momento de ejecución.
- `ReservationInstructions`: panel en el detalle de reserva con lista, transiciones, creación manual, importación de texto, sugerencias seleccionables, confirmación y texto original preservado.
- `GuestNotesPanel`: notas persistentes del huésped con alta y desactivación, accesible desde la tabla de huéspedes.
- Resumen previo al check-in en Front Office: muestra instrucciones pendientes y aclara que el check-in no inicia preautorizaciones ni cobra pagos.

## Reglas de negocio aplicadas

- El tenant/propiedad se resuelve en el servidor; el cliente no puede elegir organización/propiedad para leer o mutar datos.
- La confirmación de una sugerencia solo crea una instrucción.
- `PGTO DIRETO NO HOTEL` no es pago realizado ni autorización aprobada.
- La preautorización real queda fuera del parser y requiere el flujo de pagos, permiso, importe confirmado y proveedor tokenizado.
- No se persisten PAN/CVV ni se copian a metadata.
- `GuestNote` no se copia automáticamente a reservas futuras.
- Cada edición/cambio de estado genera eventos y auditoría.

## Refinamientos de la ejecución v3 (paso a paso)

Tras verificar la primera entrega contra `docs/v3`, se cerraron los huecos detectados:

### Paso 1 — dominio, integridad y auditoría

- Etiquetas libres (`tags`) en `ReservationInstruction`, con normalización server-side (trim, deduplicación sin distinguir mayúsculas, máximo 10 × 32 caracteres) y migración aditiva `20261115150000_phase11_instruction_tags` con índice GIN.
- Validación de vigencia: `validUntil` debe ser posterior a `validFrom`; se aplica en creación y edición (`instruction_invalid_validity`).
- Migración aditiva `20261115140000_phase11_append_only_truncate`: los triggers existentes cubrían `UPDATE`/`DELETE`, pero PostgreSQL no dispara triggers de fila en `TRUNCATE`. Se añadieron guardas `BEFORE TRUNCATE` para `ReservationSourceNote` e `InstructionEvent`.
- Parse idempotente ante concurrencia: si dos reintentos pasan el pre-chequeo, la violación del índice único de contenido devuelve la nota ganadora en lugar de fallar con 500.
- Lectura confidencial auditada también en listados (`instruction.confidential_listed`), no solo en la consulta individual.
- Redacción de PAN/CVV aplicada también a instrucciones manuales y notas de huésped (no solo al texto fuente importado), con marcadores `[CARD_REDACTED]`/`[CVV_REDACTED]` y prueba E2E dedicada.

### Paso 2 — UX de reserva, check-in y huésped

- Panel de reserva dividido en “Acciones pendientes” e “Información”, con alerta superior para prioridades `HIGH`/`CRITICAL`, tags, vigencia y departamento.
- Historial por instrucción bajo demanda (timeline append-only) y texto original en sección colapsable (“Ver texto original”).
- Creación y edición ampliadas: tags, visibilidad, departamento, acción, momento de ejecución, vigencia y edición posterior de título/detalle/prioridad/visibilidad/departamento/vigencia.
- Alta de reserva: si el operador pega una observación, se interpreta al crear y el detalle queda abierto para revisar y confirmar sugerencias. El parser no modifica pagos, tarifas ni habitaciones.
- Check-in: solo instrucciones relevantes para llegada/check-in, acciones de pago/recordatorio o alertas críticas; botón “Confirmar lectura” que registra `ACKNOWLEDGED` y muestra el estado.
- Notas del huésped: propósito y expiración desde la UI, además de activación/desactivación.

### Paso 3 — parser

- `LUXO CASAL` sin prefijo ya se reconoce como categoría de habitación informativa (ejemplo confirmado del PRD), sin asignar habitación.
- Pruebas del diccionario inicial completo: desayuno, pago en caja, extras, débito, facturación, NF/CNPJ, no cancelar, llegada, aviso de check-in, upgrade, categoría y tarifa.
- Se mantiene la regla: toda sugerencia exige confirmación humana y el parser jamás inicia una preautorización.

## Comandos ejecutados y resultados

- `pnpm db:generate` — OK.
- `pnpm db:migrate:deploy` — OK (16 migraciones, incluidas las dos aditivas de esta ejecución).
- `pnpm typecheck` — OK (API y web).
- `pnpm lint` — OK (API y web).
- `pnpm --filter @nova/api test` — 17 suites, 92 tests, todos OK.
- `pnpm --filter @nova/api test -- instruction-parser` — 14 tests OK.
- E2E aislado de instrucciones — 17 tests OK.
- `pnpm --filter @nova/api build` — OK.
- `pnpm --filter @nova/web build` — OK.
- `pnpm test:e2e:isolated` — 11/15 suites OK. Fallan `guests-reservations`, `reservation-party`, `front-office` y `folio` por desfase de fecha UTC vs. día operativo de São Paulo alrededor de medianoche UTC (`check_in_too_early`, llegadas del día no listadas, disponibilidad por bloqueo) y por expectativas preexistentes. `instructions` pasa completo en esquema aislado.
- Nota de ejecución: correr el E2E de instrucciones contra la base de desarrollo compartida acumula filas sintéticas en la reserva fija y hace fallar expectativas de conteo. Usar `pnpm test:e2e:isolated` (o el runner aislado apuntando al spec) para resultados reproducibles.

## Limitaciones y pendientes

- No se implementa cobro, preautorización real, emisión de NF, routing de folio ni cambios de tarifa. Son módulos distintos con permisos y proveedores propios.
- Tampoco existe todavía un módulo de preautorización al que enlazar la acción `PAYMENT_PREAUTHORIZATION`; la UI muestra el estado pendiente y la advertencia, sin botón que simule un cobro. El deep-link queda bloqueado hasta que exista ese módulo autenticado.
- La confirmación de sugerencias es asistida: el operador puede editar el título/cuerpo antes de confirmar; el parser no reescribe el texto fuente.
- Las etiquetas se modelaron como `String[]` en instrucciones porque el PRD las exige como Must y el modelo conceptual inicial las omitía. No se añadieron a notas de huésped en v1; su clasificación usa categoría y propósito.
- El seed sobre una base de desarrollo con fechas antiguas puede chocar con la constraint de no solapamiento de la fase 10; en un esquema limpio es idempotente. No se borraron datos del entorno local.
- Los fallos E2E preexistentes dependen de la hora UTC y deben corregirse en una tarea separada de fechas/día operativo.
