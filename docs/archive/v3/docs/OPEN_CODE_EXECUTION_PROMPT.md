# Prompt para OpenCode

Lee todo el paquete. **Paso 0:** inspecciona repo, schema, entidades Reservation/Guest/Payment/Folio/RatePlan/RoomType, RBAC, auditoría, departamentos, canales y UI. Identifica campo actual de observaciones y todos sus usos. Presenta plan de archivos/migración/riesgos antes de editar.

**Paso 1:** implementa notas de reserva, notas de huésped separadas, texto fuente inmutable e historial append-only. Reutiliza tenant context, permisos y audit log.

**Paso 2:** integra sección “Notas e instruções” en creación/edición, panel en detalle de reserva, resumen de instrucciones pendientes en check-in y notas persistentes en perfil de huésped. Usa design system NOVA light/balanced, tags pastel y modales hybrid.

**Paso 3:** parser determinístico pt-BR que devuelve sugerencias con sourcePhrase, confidence y requiresHumanConfirmation. Revisión humana obligatoria. No auto-modificar tarifas, habitación, folio, caja, factura ni pagos.

Regla confirmada: `PGTO DIRETO NO HOTEL` significa pago en hotel durante check-in mediante preautorización con tarjeta de crédito. Crear tarea `PAYMENT_PREAUTHORIZATION`, `executionMoment=CHECK_IN`, `paymentMethod=CREDIT_CARD`, estado pendiente. **No significa pago realizado ni autorización obtenida.** Parser jamás inicia preautorización. El botón abre el módulo de pagos existente; operador confirma importe según política. No inferirlo de tarifa. No almacenar PAN/CVV ni crear movimiento de caja por preautorización.

Implementa tests de QA.md. No migraciones destructivas. Ejecuta lint/typecheck/tests/build y entrega resumen, capturas y pendientes. No integrar IA externa con datos reales sin aprobación/LGPD. Trabaja en cambios pequeños y revisables.
