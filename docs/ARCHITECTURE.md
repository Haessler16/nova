# NOVA PMS — Architecture v0.1

## 1. Principios

- Modular monolith first; separar servicios solo ante necesidad demostrada.
- API backend como autoridad de negocio.
- PostgreSQL como fuente de verdad.
- Tenant isolation enforced server-side.
- Redis para coordinación efímera, cache y publicación de eventos, no integridad.
- Contratos explícitos entre módulos.
- Observabilidad, auditoría y tests desde el inicio.
- Cloud-first; offline y Edge se incorporan en fases separadas.

## 2. Topología lógica

```text
Browser / PWA
    |
    v
Next.js Web (Chakra UI)
    |
    v
NestJS API
    |--------------------|
    v                    v
PostgreSQL             Redis
(source of truth)      (cache, leases, events)
    |
    v
Object storage (future: imports, exports, attachments)
```

## 3. Monorepo propuesto

```text
nova-pms/
├── AGENTS.md
├── apps/
│   ├── web/
│   └── api/
├── packages/
│   ├── contracts/
│   ├── config/
│   └── shared/
├── docs/
├── infrastructure/
│   └── docker/
├── prisma/
├── prompts/
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

No crear paquetes por cada módulo de dominio. `packages/contracts` contiene contratos compartidos seguros (schemas/types), no reglas de negocio duplicadas.

## 4. Módulos de dominio (API)

- identity: autenticación, sesiones, usuarios.
- tenancy: organizaciones, propiedades, membresías y contexto.
- access-control: roles, permisos y policy checks.
- audit: eventos de auditoría.
- property-config: timezone, moneda, hotel day y preferencias.
- inventory: tipos y habitaciones.
- guests: perfiles y deduplicación.
- reservations: reservas, disponibilidad, asignaciones.
- front-office: room rack, arrivals, departures, check-in/out.
- folio: cargos, pagos registrados y ajustes.
- cash: caja y movimientos.
- night-audit: cierre del día operativo.
- reporting: consultas y reportes.

Cada módulo expone servicios de aplicación y contratos internos. Evitar que un módulo escriba directamente tablas de otro módulo sin pasar por sus casos de uso/contratos.

Implementación actual (Phases 1–4): `auth` (sesiones locales, CSRF, rate limiting, dev-header aislado), `tenancy`, `identity`, `properties` + `operational-day`, `inventory` (room types, rooms, blocks, reconciliación de estado e historial), `guests`, `reservations` (disponibilidad, asignación transaccional, historial), `front-office` (room rack, llegadas/salidas/in-house, check-in/out, room move, no-show, incidencias) y `audit`, sobre `prisma`, `redis` y `health`. `folio`, `cash`, `night-audit` y `reporting` todavía no existen.

## 5. Multi-tenancy

Jerarquía:

- Organization: cliente/empresa que contrata NOVA.
- Property: hotel individual.
- User: identidad global.
- Membership: acceso de usuario a una organización y roles por propiedad.

Resolución de contexto:

1. autenticar usuario;
2. validar membership activa;
3. resolver organization/property desde ruta o contexto seleccionado;
4. validar que la propiedad pertenece a la organización;
5. construir TenantContext inmutable en servidor;
6. cada repositorio/servicio recibe contexto explícito.

No confiar en organizationId/propertyId de body/query para autorizar. Si se aceptan como selector, verificar pertenencia contra la sesión autenticada.

Defensa en profundidad:

- filtros tenant-scoped obligatorios en repositorios;
- constraints compuestas cuando aplique;
- pruebas negativas cross-tenant;
- no exponer IDs predecibles como control de acceso;
- evaluar PostgreSQL Row Level Security más adelante, sin asumir que sustituye autorización de aplicación.

## 6. Prevención de doble asignación

La disponibilidad puede cambiar entre lectura y escritura. El flujo definitivo:

1. frontend solicita disponibilidad;
2. usuario selecciona opción;
3. frontend puede obtener lease temporal para mejorar UX;
4. al confirmar, API abre transacción;
5. API vuelve a validar pertenencia, estado, fechas y disponibilidad;
6. PostgreSQL aplica constraint/estrategia de exclusión o bloqueo transaccional apropiado;
7. se persiste asignación/reserva;
8. se registra auditoría y evento outbox dentro de la misma transacción;
9. respuesta refleja resultado definitivo.

Para PostgreSQL, estudiar `EXCLUDE USING gist` con rangos temporales y extensión `btree_gist` para evitar solapamientos por habitación, o estrategia de bloqueo por habitación/intervalo con constraint complementaria. La elección debe probarse con concurrencia real y documentarse. No confiar en Redis lock como única protección.

Leases:

- expiración corta y configurable;
- token opaco;
- vinculado a usuario/property/recurso;
- liberación al cancelar/cerrar sesión cuando sea posible;
- expiración automática;
- nunca bloquea indefinidamente;
- no reemplaza validación transaccional.

## 7. Auditoría y eventos

- Audit log append-only a nivel aplicación.
- Actor, organization, property, action, entity type/id, timestamp, correlation id, reason cuando aplique.
- Guardar cambios relevantes con before/after selectivo, evitando secretos y datos personales innecesarios.
- Para eventos de integración, usar transactional outbox para evitar publicar evento de una transacción no confirmada.
- No usar auditoría como sustituto del historial de dominio.

## 8. Resiliencia

- Health endpoints separados: liveness y readiness.
- Timeouts, retries limitados con jitter/backoff.
- Idempotency keys para operaciones de escritura repetibles.
- No reintentar ciegamente operaciones no idempotentes.
- Frontend comunica estado de conexión y antigüedad de datos.
- Logs estructurados con correlation ID; métricas y tracing cuando sea viable.
- Backups automáticos y pruebas de restauración antes de piloto.

## 9. Web / PWA

- Next.js + React + TypeScript + Chakra UI.
- Accesibilidad y UX de escritorio primero; recepción suele usar pantallas grandes y teclado.
- Componentes operativos densos: calendario, room rack, tablas, formularios rápidos.
- PWA en fase resiliencia: cache del shell y lectura de subconjunto sincronizado.
- No cachear indiscriminadamente datos personales ni respuestas autenticadas.
- No almacenar pagos, documentos o datos altamente sensibles en IndexedDB.
- Operaciones críticas permanecen online hasta que exista arquitectura local validada.

## 10. Infraestructura local

Docker Compose para PostgreSQL y Redis en desarrollo. En producción, secretos gestionados por plataforma, TLS, backups, migraciones controladas y separación de entornos.
