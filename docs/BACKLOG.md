# NOVA PMS — Prioritized Backlog v0.1

Estimaciones relativas para planificación, no compromisos. `S` = pequeño, `M` = medio, `L` = grande, `XL` = investigación/alto riesgo. La estimación debe revisarse tras inspeccionar el repositorio.

> **Estado 2026-11-08:** FND-001 a FND-012, INV-001 a INV-006, GST-001/002, RSV-001/002/003/005/006 y FO-001 a FO-006 implementados localmente y verificados (lint, typecheck, format, builds, unit tests, E2E aislados y `pnpm db:verify`). La UI web de fases 1–4 cubre login/sesión, selector organización/propiedad, configuración, inventario, huéspedes, reservas, calendario, Front Office, auditoría, administración y cuenta. Quedan pendientes RSV-004 (lease temporal; la exclusión PostgreSQL ya existe y RSV-004 no es requisito de integridad) y las fases posteriores. El CI remoto está definido en `.github/workflows/ci.yml` pero aún no se ejecutó en GitHub. Ver `docs/PHASE_1_REPORT.md`, `docs/PHASE_2_REPORT.md`, `docs/PHASE_3_REPORT.md` y `docs/PHASE_4_REPORT.md`.

> **Actualización 2026-11-09:** Fase 5 (folios, pagos, caja y night audit) y Fase 6 (onboarding, sandbox demo aislado, feedback de piloto, runbook/checklist, drill de restore y pruebas de concurrencia) implementadas localmente y verificadas. ACD-001 queda como checklist de onboarding (no tour superpuesto) y ACD-002 como sandbox por schema PostgreSQL. RPT-002 (reportes/exportación) y RSV-004 siguen pendientes. Ver `docs/PHASE_5_REPORT.md` y `docs/PHASE_6_REPORT.md`.

> **Actualización 2026-11-09 (Fase 7, primer corte):** IMP-001 implementado para CSV de huéspedes con preview, confirmación todo-o-nada, límite de 500 filas/512 KB e idempotencia por propiedad. RES-001 cubierto parcialmente: service worker de shell/offline sin cachear API y bloqueo explícito de escrituras sin conexión; RES-002/RES-003 (lecturas locales y outbox) quedan pendientes. IMP-002 (OCR/PDF) sigue fuera de alcance. Ver `docs/PHASE_7_REPORT.md`.

> **Actualización 2026-11-09 (groundwork Fase 8):** IMP-001 amplía su valor con exportaciones CSV auditadas de huéspedes, reservas y folios (hasta 5000 filas). RPT-002 queda cubierto parcialmente: exportación CSV operativa, sin reportes agregados ni XLSX. Se agrega diagnóstico `/health/version` y filtros de actor/fecha con cursor en auditoría. No se inicia coordinador Edge ni integraciones de proveedor: Fase 8 sigue en discovery. Ver `docs/PHASE_8_GROUNDWORK.md`.

> **Actualización 2026-11-13 (Documents v1):** primer corte de `docs/v2` implementado: plantillas property-scoped versionadas, preview HTML A4 seguro, PDF A4 server-side con PDFKit, snapshot inmutable, SHA-256, historial, descarga autenticada sin URL pública, eventos de impresión append-only y recepción de firma física. UI contextual en el detalle de reserva, llegadas, huéspedes en casa, salidas, folio y huésped (selector de reserva dentro del modal). Renderer cubierto con pruebas unitarias de escape HTML y campos opcionales.

> **Actualización 2026-11-13 (Reports v1 + FNRH discovery):** reportes operativos implementados con catálogo fijo (ocupación, llegadas, salidas, reservas y caja diaria), permisos `reports.read`/`reports.financial`, filtros de hasta 62 días, paginación, PDF A4 horizontal, CSV con neutralización de fórmulas, auditoría de ejecuciones/exportaciones e historial derivado del audit log. La UI `/reports` quedó integrada. FNRH queda en discovery documentado (`docs/v2/docs/FNRH_DISCOVERY.md` y ADR-045): sin llamadas, credenciales, endpoints ni afirmaciones fiscales inventadas. RPT-002 se cubre en su alcance operativo; XLSX, reportes programados e historial persistente de artefactos siguen pendientes.

> **Actualización 2026-11-13 (FNRH baseline + plan + modelo de huéspedes):** el discovery de FNRH quedó convertido en un plan ejecutable (`docs/v2/docs/FNRH_INTEGRATION_PLAN.md`), con manual oficial 2.4.2, changelog, generación de clave, homologación, brecha de datos, adapter aislado, ledger de operaciones y matriz de pruebas. El modelo de huéspedes, acompañantes y menores y su migración aditiva quedaron diseñados en `docs/v2/docs/FNRH_GUEST_MODEL.md`, sin ejecutar migraciones ni inventar acompañantes. La revisión oficial confirmó que los menores se vinculan a la FNRH del responsable, que el principal debe ser adulto y que sólo CPF/pasaporte son documentos FNRH; las firmas pendientes de producto/legal están en `docs/v2/docs/FNRH_GUEST_MODEL_REVIEW.md`. El flujo de UI para capturar acompañantes y menores está diseñado en `docs/v2/docs/FNRH_GUEST_UI_FLOW.md`, sin implementar pantallas. `FNRH_DISCOVERY.md` queda como baseline corto y ADR-045/046/047 registran las decisiones. No hay credenciales, llamadas reales ni cliente HTTP: la implementación sigue bloqueada por contradicciones del contrato (URL base, formato de credencial, paginación, `cpf_solicitante`) y por la puerta de homologación.

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

Estado P2: GST-001, GST-002, RSV-001, RSV-002, RSV-003, RSV-005 y RSV-006 implementados en backend/UI con tests. RSV-004 no se implementó (Redis/lease no sustituye PostgreSQL).

Estado P3: FO-001 a FO-006 implementados en API y UI con E2E aislados: room rack, llegadas/salidas/in-house, check-in/out idempotentes, room move e incidencias. Quedan pendientes de validación con el piloto las horas de llegada/salida, no-show y la política de overbooking.

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

## P11 — Notes & Instructions v1

| ID      | Épica  | Historia / tarea                                   | Prioridad | Est. | Dependencias | Criterio de aceptación                                                       |
| ------- | ------ | -------------------------------------------------- | --------- | ---- | ------------ | ---------------------------------------------------------------------------- |
| NTS-001 | Notes  | Instrucciones estructuradas por reserva            | Must      | M    | RSV,FO       | Categoría, prioridad, estado, visibilidad y eventos auditables               |
| NTS-002 | Notes  | Texto fuente inmutable con redacción de tarjeta    | Must      | M    | NTS-001      | PAN/CVV redactados; hash del texto recibido; trigger rechaza UPDATE/DELETE   |
| NTS-003 | Parser | Parser determinista pt-BR que solo sugiere         | Must      | L    | NTS-002      | Requiere confirmación humana; no crea pagos, cargos, tarifas ni habitaciones |
| NTS-004 | Notes  | Notas persistentes del huésped separadas           | Must      | M    | GST          | No se copian automáticamente a reservas; visibilidad y vencimiento           |
| NTS-005 | UI     | Panel de notas/instrucciones y resumen de check-in | Should    | M    | NTS-001..004 | Reserva, huésped y llegada muestran pendientes sin iniciar cobros            |

Estado P11: NTS-001..005 implementados en API y UI con migración, seed sintético, pruebas unitarias del parser y E2E aislados. Incluye tags, vigencia validada, historial por instrucción, texto original colapsable, separación de información/acciones, resumen de check-in con “Confirmar lectura” y notas de huésped con propósito/expiración. Los triggers append-only cubren también `TRUNCATE`. Preautorización real permanece fuera de alcance: exige el módulo de pagos, permiso, importe confirmado y proveedor tokenizado; no existe aún un deep-link porque ese módulo no está implementado. `PGTO DIRETO NO HOTEL` se representa como instrucción pendiente en check-in, nunca como pago realizado.

## Orden de ejecución recomendado

1. P0 completo.
2. P1 inventario/configuración.
3. P2 reservas y concurrencia.
4. P3 Front Office.
5. P4 folios/caja/night audit.
6. Pilot hardening y onboarding.
7. P5 imports, offline y Edge según evidencia.

No iniciar P2 si FND-008 y FND-011 no están terminados. No iniciar confirmación de reservas sin una garantía transaccional probada en PostgreSQL.
