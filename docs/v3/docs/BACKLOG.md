# Backlog

## P0 Discovery

- [x] Inspeccionar Reservation, Guest, Payment/Folio, RatePlan, RoomType, RBAC, audit log y origen actual de observaciones.
- [x] Mapear canales y departamentos; acordar visibilidad y diccionario por propiedad.

## P1 Dominio y UX

- [x] Modelos de notas, instrucciones, source text e historial.
- [x] CRUD y validación server-side.
- [x] Tags, prioridad, estado, vigencia, departamento, origen y visibilidad.
- [x] UI en crear/editar reserva, detalle y check-in.
- [x] Notas persistentes separadas en perfil de huésped.

## P2 Parser

- [x] Reglas determinísticas pt-BR.
- [x] Preview de sugerencias, frase fuente, confianza y revisión humana.
- [x] Idempotencia/deduplicación de importación.
- [x] Preservar texto original.

## P3 Pago

- [ ] Deep-link a flujo existente de preautorización. Bloqueado: el módulo de preautorización no existe todavía.
- [x] Monto confirmado por operador/política (la UI/dominio no infieren importe; la ejecución real queda para el módulo de pagos).
- [ ] Estado gobernado por proveedor; relacionar referencia. Pendiente del módulo de pagos.
- [x] Nunca guardar PAN/CVV ni crear caja por autorización.

## P4

- [ ] Bandeja por departamento, diccionario configurable, IA/OCR opcional, métricas.
      Definition of Done: RBAC, tenant isolation, audit, tests, responsive, accesible, sin side effects del parser.
