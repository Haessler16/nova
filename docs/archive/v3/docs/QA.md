# QA obligatorio

1. `PGTO DIRETO NO HOTEL (12-15/11)` propone preautorización en check-in con tarjeta, pendiente; no crea pago/caja ni marca pagado.
2. Retry/import duplicado no duplica instrucciones.
3. `PGTO ... LANÇADO NO CAIXA` solo genera verificación; ledger es fuente de verdad.
4. Desayuno no se duplica si ya está en RatePlan.
5. Upgrade sujeto a disponibilidad no cambia habitación.
6. No cancelar muestra alerta y respeta autorización excepcional.
7. Datos de tarjeta en texto fuente se redactan/restringen.
8. GuestNote no se copia automáticamente a futuras reservas.
9. Confidencial no visible a roles sin permiso.
10. Cross-tenant/property denegado.
11. Edición y cambios generan eventos auditables.
12. Tarifa parseada no altera precio ni folio.
13. Fechas ambiguas solicitan revisión.
14. Preautorización solo se inicia en payment flow con importe confirmado; estado viene del proveedor.
