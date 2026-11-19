# PRD — NOVA Notes & Instructions v1

## Problema y objetivo
Las observaciones de reservas llegan como bloques extensos. Convertirlas en notas e instrucciones estructuradas, visibles en reserva, perfil del huésped y check-in, conservando el texto original.

## Dominio
- **Reservation Note/Instruction:** aplica a una reserva concreta.
- **Guest Note:** preferencia o información persistente del huésped; nunca copiar automáticamente desde una reserva.
- **Source Note:** texto original importado, inmutable.
- **Operational Task:** acción pendiente derivada de una instrucción.
- Separar información descriptiva de acciones que requieren ejecución.

## Categorías
PAYMENT, MEAL, BILLING, ROOM, ARRIVAL, IMPORTANT, EXTRA, CONFIDENTIAL, GENERAL.
Prioridad LOW/NORMAL/HIGH/CRITICAL. Estado NEW/ACKNOWLEDGED/IN_PROGRESS/COMPLETED/DISMISSED/NEEDS_CLARIFICATION.
Origen RESERVATIONS/FRONT_DESK/GUEST/CHANNEL/IMPORT/SYSTEM.
Visibilidad ALL_AUTHORIZED/FRONT_DESK/RESERVATIONS/FINANCE/MANAGEMENT.

## Ejemplo operativo confirmado
`RSV COM CAFE / TRF DBL R$ 606,00 + 15% / PGTO DIRETO NO HOTEL (12-15/11) / LUXO CASAL`
- `RSV COM CAFE`: sugerencia “Desayuno incluido”; reconciliar con RatePlan para no duplicar beneficio.
- `TRF DBL R$ 606,00 + 15%`: información de tarifa; no sobrescribir tarifa ni generar cobros.
- `PGTO DIRETO NO HOTEL`: crear instrucción HIGH: “Realizar preautorização de cartão no check-in”; método tarjeta de crédito; momento CHECK_IN; estado pendiente.
- `LUXO CASAL`: categoría de habitación informativa; reconciliar con RoomType, no asignar habitación automáticamente.

**Preautorización:** no equivale a captura/cobro. No marcar reserva pagada, no crear ingreso de caja ni reducir saldo. Tras acción real, mostrar estado informado por proveedor: AUTHORIZED, DECLINED, PENDING, EXPIRED, VOIDED o CAPTURED. El parser solo sugiere. El botón abre el módulo de pagos existente, con permisos y confirmación. No inferir importe de R$606 + 15%; operador/política debe confirmar importe. Usar token del proveedor; nunca guardar PAN/CVV.

## Funcionalidades Must
1. CRUD de notas/instrucciones de reserva y notas de huésped separadas.
2. Categoría, tags, prioridad, estado, vigencia, origen, departamento responsable y visibilidad.
3. Texto original inmutable y metadata de importación.
4. Timeline/auditoría de creación, edición, lectura confidencial, reconocimiento, finalización y descarte.
5. Panel en creación/edición de reserva, detalle de reserva y resumen del check-in.
6. Parser inicial determinístico pt-BR; sugerencias con frase fuente, confianza y revisión humana.
7. Acciones de check-in con deep-link al módulo responsable; nunca side effects del parser.

## UX
NOVA light, balanced density, pastel tags, hybrid modals. En reserva: bloque “Notas e instruções” con tarjetas separadas entre “Informações” y “Ações pendentes”. En detalle: alertas HIGH/CRITICAL arriba, timeline y acordeón “Ver texto original”. En check-in: solo instrucciones pertinentes al check-in y botón “Confirmar leitura”. En huésped: notas persistentes con expiración/propósito. Modal medium para crear/editar, drawer para historial; accesible y responsive.

## Seguridad/LGPD
RBAC y tenant/property isolation en servidor. Visibilidad por departamento. No usar datos sensibles innecesarios. Redactar datos de tarjeta en importaciones; limitar acceso al texto original. CNPJ/datos de facturación deben vivir en campos de facturación cuando corresponda. No enviar PII a IA externa sin aprobación y evaluación LGPD.
