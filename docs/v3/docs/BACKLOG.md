# Backlog
## P0 Discovery
- [ ] Inspeccionar Reservation, Guest, Payment/Folio, RatePlan, RoomType, RBAC, audit log y origen actual de observaciones.
- [ ] Mapear canales y departamentos; acordar visibilidad y diccionario por propiedad.
## P1 Dominio y UX
- [ ] Modelos de notas, instrucciones, source text e historial.
- [ ] CRUD y validación server-side.
- [ ] Tags, prioridad, estado, vigencia, departamento, origen y visibilidad.
- [ ] UI en crear/editar reserva, detalle y check-in.
- [ ] Notas persistentes separadas en perfil de huésped.
## P2 Parser
- [ ] Reglas determinísticas pt-BR.
- [ ] Preview de sugerencias, frase fuente, confianza y revisión humana.
- [ ] Idempotencia/deduplicación de importación.
- [ ] Preservar texto original.
## P3 Pago
- [ ] Deep-link a flujo existente de preautorización.
- [ ] Monto confirmado por operador/política.
- [ ] Estado gobernado por proveedor; relacionar referencia.
- [ ] Nunca guardar PAN/CVV ni crear caja por autorización.
## P4
- [ ] Bandeja por departamento, diccionario configurable, IA/OCR opcional, métricas.
Definition of Done: RBAC, tenant isolation, audit, tests, responsive, accesible, sin side effects del parser.
