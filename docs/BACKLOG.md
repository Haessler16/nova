# NOVA PMS — Prioritized Backlog v0.1

Estimaciones relativas para planificación, no compromisos. `S` = pequeño, `M` = medio, `L` = grande, `XL` = investigación/alto riesgo. La estimación debe revisarse tras inspeccionar el repositorio.

> **Estado 2026-11-08:** FND-001 a FND-012, INV-001 a INV-006, GST-001/002 y RSV-001/002/003/005 implementados localmente y verificados (lint, typecheck, format, build, unit tests, E2E aislados y `pnpm db:verify`). La UI web de fases 1–3 cubre login/sesión, selector organización/propiedad, configuración, inventario, huéspedes, reservas, auditoría, administración y cuenta. Quedan pendientes RSV-004 (lease temporal; la exclusión PostgreSQL ya existe y RSV-004 no es requisito de integridad), RSV-006 (calendario gráfico de reservas) y las fases posteriores. El CI remoto está definido en `.github/workflows/ci.yml` pero aún no se ejecutó en GitHub. Ver `docs/PHASE_1_REPORT.md`, `docs/PHASE_2_REPORT.md` y `docs/PHASE_3_REPORT.md`.

**Phase 3 — guests y reservas (backend):** CRUD de huéspedes con minimización, búsqueda asistida, ciclo de vida de reserva (`CONFIRMED`/`CANCELLED`), disponibilidad por fechas, asignación de habitación transaccional, idempotencia de creación, historial append-only y garantía de no-solapamiento con exclusion constraint PostgreSQL. Check-in/check-out pertenecen a Phase 4 (Front Office).

## P0 — Foundation (bloquea todo)

| ID      | Épica    | Historia / tarea                           | Prioridad | Est. | Dependencias    | Criterio de aceptación                                     |
| ------- | -------- | ------------------------------------------ | --------- | ---- | --------------- | ---------------------------------------------------------- |
| FND-001 | Repo     | Crear monorepo pnpm con apps web/api       | Must      | M    | —               | Web y API arrancan con comandos root                       |
| FND-002 | Infra    | Docker Compose PostgreSQL + Redis          | Must      | S    | FND-001         | Healthchecks verdes y volúmenes persistentes               |
| FND-003 | Quality  | Configurar lint, format, typecheck y tests | Must      | M    | FND-001         | Scripts reproducibles en CI/local                          |
| FND-004 | DB       | Integrar Prisma y migración inicial        | Must      | M    | FND-002         | Migración aplica desde DB vacía                            |
| FND-005 | Tenancy  | Organization y Property                    | Must      | M    | FND-004         | Una propiedad pertenece a una organización                 |
| FND-006 | Identity | User y Membership                          | Must      | M    | FND-004         | Usuario solo accede a organizaciones con membership activa |
| FND-007 | Access   | Roles y permisos                           | Must      | L    | FND-006         | Permisos comprobados en backend                            |
| FND-008 | Tenancy  | TenantContext y guards                     | Must      | L    | FND-006,FND-007 | Requests cross-tenant denegados                            |
| FND-009 | Audit    | AuditEvent append-only                     | Must      | M    | FND-005,FND-006 | Mutaciones críticas producen evento auditable              |
| FND-010 | API      | Health/readiness + Swagger                 | Must      | S    | FND-001         | Readiness detecta DB/Redis no disponibles                  |
| FND-011 | Tests    | Suite de aislamiento multi-tenant          | Must      | L    | FND-008         | Tests de acceso, denegación y spoofing                     |
| FND-012 | DX       | Seeds ficticios y documentación local      | Must      | S    | FND-004         | Nuevo desarrollador puede levantar el proyecto             |

## P1 — Property configuration e inventario

| ID      | Épica        | Historia / tarea                                   | Prioridad | Est. | Dependencias | Criterio de aceptación                     |
| ------- | ------------ | -------------------------------------------------- | --------- | ---- | ------------ | ------------------------------------------ |
| INV-001 | Config       | Timezone, currency y operational day por propiedad | Must      | M    | P0           | Configuración se aplica a consultas/fechas |
| INV-002 | Inventory    | CRUD de tipos de habitación                        | Must      | M    | P0           | Solo usuarios autorizados pueden gestionar |
| INV-003 | Inventory    | CRUD de habitaciones físicas                       | Must      | M    | INV-002      | Código/número único por propiedad          |
| INV-004 | Housekeeping | Estados de housekeeping separados                  | Must      | M    | INV-003      | Estado no se deduce de ocupación           |
| INV-005 | Inventory    | Fuera de servicio / fuera de orden                 | Must      | M    | INV-003      | Motivo, intervalo e historial auditado     |
| INV-006 | UI           | Panel de configuración e inventario                | Must      | L    | INV-001..005 | Flujo usable en desktop y teclado          |

## P2 — Guests y reservations

| ID      | Épica        | Historia / tarea                                | Prioridad | Est. | Dependencias    | Criterio de aceptación                              |
| ------- | ------------ | ----------------------------------------------- | --------- | ---- | --------------- | --------------------------------------------------- |
| GST-001 | Guests       | Crear/editar huésped con datos mínimos          | Must      | M    | P0              | Validación y tenant scoping                         |
| GST-002 | Guests       | Búsqueda y deduplicación asistida               | Should    | M    | GST-001         | No fusiona perfiles automáticamente                 |
| RSV-001 | Reservations | Crear reserva con huéspedes, fechas y ocupación | Must      | L    | INV-003,GST-001 | Estados y validaciones documentados                 |
| RSV-002 | Availability | Consultar disponibilidad                        | Must      | L    | RSV-001         | Backend calcula según timezone/reglas               |
| RSV-003 | Concurrency  | Confirmación transaccional de habitación        | Must      | XL   | RSV-002         | Dos requests concurrentes no confirman solapamiento |
| RSV-004 | Concurrency  | Lease temporal de selección                     | Should    | M    | RSV-003         | Expira automáticamente y no sustituye DB            |
| RSV-005 | Reservations | Modificar/cancelar con historial                | Must      | M    | RSV-001         | Historial preservado y auditado                     |
| RSV-006 | UI           | Calendario de reservas                          | Must      | XL   | RSV-001..005    | Refleja conflictos y estados del backend            |

Estado P2: GST-001, GST-002, RSV-001, RSV-002, RSV-003 y RSV-005 implementados en backend con tests y UI operativa (listas, alta/edición, asignación y cancelación). RSV-004 no se implementó (Redis/lease no sustituye PostgreSQL); RSV-006 (calendario gráfico) sigue pendiente.

## P3 — Front Office

| ID     | Épica      | Historia / tarea                   | Prioridad | Est. | Dependencias   | Criterio de aceptación               |
| ------ | ---------- | ---------------------------------- | --------- | ---- | -------------- | ------------------------------------ |
| FO-001 | Room rack  | Room rack por propiedad            | Must      | L    | INV,RSV        | Estados y ocupación actualizados     |
| FO-002 | Arrivals   | Lista de llegadas/salidas/in-house | Must      | M    | RSV-001        | Filtros por hotel day                |
| FO-003 | Stay       | Check-in                           | Must      | L    | RSV,INV        | Transición válida e idempotente      |
| FO-004 | Stay       | Check-out                          | Must      | L    | FO-003         | No permite checkout inválido         |
| FO-005 | Stay       | Cambio de habitación               | Should    | L    | FO-003,RSV-003 | Disponibilidad revalidada y auditada |
| FO-006 | Operations | Notas e incidencias                | Should    | M    | P0             | Autoría y visibilidad por permisos   |

## P4 — Folio, caja y night audit

| ID      | Épica       | Historia / tarea                  | Prioridad | Est. | Dependencias   | Criterio de aceptación             |
| ------- | ----------- | --------------------------------- | --------- | ---- | -------------- | ---------------------------------- |
| FIN-001 | Folio       | Crear folio y líneas de cargo     | Must      | L    | FO-003         | Importes exactos, moneda explícita |
| FIN-002 | Payments    | Registrar pago externo            | Must      | L    | FIN-001        | Idempotencia; no almacena PAN/CVV  |
| FIN-003 | Cash        | Apertura/cierre de caja           | Must      | L    | FIN-002        | Totales reconciliables y auditados |
| FIN-004 | Cash        | Movimientos y ajustes             | Should    | M    | FIN-003        | Motivo y permiso requeridos        |
| AUD-001 | Hotel day   | Generar día operativo             | Must      | L    | INV-001        | Respeta hora de corte local        |
| AUD-002 | Night audit | Validaciones y cierre idempotente | Must      | XL   | FIN,FO,AUD-001 | Retry no duplica cargos/cierres    |
| RPT-001 | Reporting   | Dashboard operativo               | Should    | M    | FO,FIN,AUD     | Datos filtrados por propiedad      |
| RPT-002 | Reporting   | Reportes básicos y exportación    | Should    | L    | RPT-001        | Permisos y límites aplicados       |

## P5 — Diferenciadores y robustez

| ID       | Épica      | Historia / tarea                  | Prioridad | Est. | Dependencias   | Criterio de aceptación                         |
| -------- | ---------- | --------------------------------- | --------- | ---- | -------------- | ---------------------------------------------- |
| IMP-001  | Import     | Importar CSV/XLSX con preview     | Should    | L    | GST            | Validación, errores y confirmación humana      |
| IMP-002  | Import     | PDF/imágenes/OCR                  | Could     | XL   | IMP-001        | Extracción revisable; no auto-commit           |
| ACD-001  | Academy    | Tour guiado inicial               | Should    | M    | UI base        | Usuario puede retomar/omitir                   |
| ACD-002  | Academy    | Sandbox demo aislado              | Should    | L    | P0             | Datos ficticios y cero efectos en producción   |
| RES-001  | Resilience | PWA shell cache + estado conexión | Should    | M    | UI base        | App muestra online/offline correctamente       |
| RES-002  | Resilience | Lectura offline limitada          | Could     | L    | RES-001        | Muestra antigüedad y nunca promete actualidad  |
| RES-003  | Resilience | Outbox + reconciliación           | Could     | XL   | RES-002        | Reintentos idempotentes y conflictos visibles  |
| EDGE-001 | Edge       | Discovery hardware/red local      | Could     | XL   | Pilot feedback | Requisitos medidos con hotel piloto            |
| EDGE-002 | Edge       | Coordinador local LAN             | Could     | XL   | EDGE-001       | Diseño de sync, seguridad y operación aprobado |

## Orden de ejecución recomendado

1. P0 completo.
2. P1 inventario/configuración.
3. P2 reservas y concurrencia.
4. P3 Front Office.
5. P4 folios/caja/night audit.
6. Pilot hardening y onboarding.
7. P5 imports, offline y Edge según evidencia.

No iniciar P2 si FND-008 y FND-011 no están terminados. No iniciar confirmación de reservas sin una garantía transaccional probada en PostgreSQL.
