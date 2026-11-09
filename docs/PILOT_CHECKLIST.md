# NOVA PMS — Checklist de piloto

Marcar antes de habilitar el piloto con staff real. Responsable y fecha se completan en la sesión de sign-off.

## Infraestructura y datos

- [ ] PostgreSQL y Redis con healthchecks verdes.
- [ ] `pnpm db:migrate:deploy` sin migraciones pendientes.
- [ ] `pnpm db:seed` con datos sintéticos; cero datos reales de huéspedes.
- [ ] `pnpm db:verify` pasa con todas las constraints, triggers, funciones e índices.
- [ ] Restore drill ejecutado y documentado en `docs/PHASE_6_REPORT.md`.
- [ ] Backup reciente disponible y con retención acordada.

## Accesos y seguridad

- [ ] Roles del piloto asignados por propiedad (admin, manager, recepción, auditor, housekeeping).
- [ ] `AUTH_MODE` correcto para el entorno; header de desarrollo deshabilitado fuera de local.
- [ ] Sesiones, CSRF y rate limiting verificados en el entorno del piloto.
- [ ] Sin secretos en el repositorio ni en el cliente.
- [ ] Eventos de seguridad visibles en `/admin`.

## Flujos operativos

- [ ] Propiedad con timezone, moneda y hora de corte correctas.
- [ ] Tipos de habitación y habitaciones cargados.
- [ ] Huésped creado con datos mínimos.
- [ ] Importación CSV probada en vista previa y confirmada con datos sintéticos; el reintento no duplica huéspedes.
- [ ] Reserva creada, modificada y cancelada con historial.
- [ ] Check-in, check-out, room move, no-show e incidencia probados.
- [ ] Room rack y listas de llegadas/salidas coherentes con el día operativo.

## Finanzas

- [ ] Folio abierto, cargo posteado y pago parcial registrados.
- [ ] Sobrepago rechazado; void no deja pagos por encima de cargos.
- [ ] Folio liquidado pasa a `SETTLED`.
- [ ] Caja abierta, movimientos registrados y cierre con importe contado.
- [ ] Diferencia de caja exige motivo y queda auditada.
- [ ] Cierre operativo con bloqueos, cierre forzado con motivo y reopen probados.

## Monitoreo y soporte

- [ ] `/health/live`, `/health/ready` y `/metrics` accesibles según política.
- [ ] Logs estructurados con `correlationId` revisados.
- [ ] Comportamiento sin conexión verificado: escrituras bloqueadas, sin confirmaciones optimistas y página `/offline` disponible.
- [ ] Runbook `docs/PILOT_RUNBOOK.md` leído por soporte.
- [ ] Contacto de escalamiento y ventana de soporte acordados.
- [ ] Rollback de aplicación ensayado o documentado.

## Adopción y feedback

- [ ] Checklist de `/pilot` recorrido con el equipo del hotel.
- [ ] Canal de feedback explicado; permisos `pilot.feedback.*` asignados.
- [ ] Feedback inicial revisado por el responsable del piloto.
- [ ] Limitaciones conocidas comunicadas (sin scheduler, una moneda, sin PSP/fiscal, UI no oculta acciones).

## Sign-off

- Responsable NOVA: \***\*\*\*\*\***\_\_\***\*\*\*\*\*** Fecha: \***\*\_\_\*\***
- Responsable hotel piloto: **\*\***\_\_\_**\*\*** Fecha: \***\*\_\_\*\***
- Observaciones:
