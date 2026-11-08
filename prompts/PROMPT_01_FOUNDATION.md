# PROMPT 01 — NOVA PMS Foundation

Actúa como Staff Engineer responsable de implementar la primera fase real de NOVA PMS en este repositorio.

## Lectura obligatoria

Antes de escribir código, lee:
- `AGENTS.md`
- `README.md`
- `docs/PRODUCT_BRIEF.md`
- `docs/ARCHITECTURE.md`
- `docs/DATABASE.md`
- `docs/API.md`
- `docs/SECURITY.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/DECISIONS.md`

Inspecciona además el estado real del repositorio, `git status --short`, package manager, Node version, archivos existentes y cualquier instrucción adicional.

## Objetivo de esta tarea

Implementar únicamente Phase 1 — Foundation. No implementar habitaciones, huéspedes, reservas, room rack, check-in/out, folios, pagos, night audit, OCR, Academy avanzada, offline avanzado ni Edge.

## Antes de implementar

1. Resume el estado actual del repo y detecta si ya existe código que deba preservarse.
2. Identifica decisiones no resueltas que bloqueen la implementación.
3. Propón una estructura de monorepo y un plan corto, con archivos y criterios de aceptación.
4. Si el repo existente contradice el stack propuesto, no migres automáticamente: presenta el conflicto y propone la opción menos destructiva.

## Alcance de implementación

- Configurar pnpm workspaces si el repo está vacío o la migración es segura.
- Crear `apps/web` con Next.js, React, TypeScript y Chakra UI.
- Crear `apps/api` con NestJS y TypeScript.
- Configurar PostgreSQL y Redis en Docker Compose para desarrollo local.
- Configurar Prisma y una migración inicial.
- Crear `.env.example` sin secretos.
- Crear scripts root para dev, build, lint, typecheck, test y format según tooling elegido.
- Crear health/liveness y readiness endpoints en API.
- Implementar entidades foundation: Organization, Property, User, Membership, PropertyMembership, Role, Permission, AuditEvent.
- Implementar tenant context en backend derivado de identidad/membership. Si todavía no hay autenticación real, usa un mecanismo de desarrollo explícito y aislado, nunca un header público confiable en producción.
- Implementar un servicio/guard de autorización inicial.
- Crear audit service append-only para eventos relevantes.
- Crear seeds de desarrollo con datos claramente ficticios.
- Añadir pruebas unitarias y E2E para tenant isolation y health endpoints.
- Documentar comandos de instalación, migración, seed y ejecución local.

## Criterios de aceptación

1. Un desarrollador puede iniciar PostgreSQL y Redis con un comando documentado.
2. Web y API arrancan localmente.
3. Prisma conecta a PostgreSQL y la migración inicial se aplica desde un entorno limpio.
4. Health y readiness reflejan estado real de dependencias críticas.
5. La API construye contexto tenant en servidor.
6. Un usuario sin membership no puede leer ni mutar recursos de una organización/propiedad.
7. Manipular organizationId/propertyId desde el cliente no permite cruzar tenants.
8. AuditEvent no se modifica ni elimina mediante endpoints normales.
9. Tests automatizados cubren al menos acceso autorizado, acceso denegado y spoofing de tenant.
10. Lint, typecheck, unit tests y E2E aplicables pasan.

## Restricciones

- No inventes un sistema de autenticación incompleto y lo declares producción-ready. Si debes crear auth mínima para el entorno local, marca límites y riesgos.
- No uses Redis locks para garantizar integridad de negocio.
- No uses `float` para dinero.
- No guardes datos personales reales en seeds.
- No crees interfaces de módulos futuros sin necesidad.
- No añadas dependencias innecesarias.
- No hagas cambios destructivos ni sobrescribas archivos existentes sin explicar y pedir confirmación.
- No afirmes que tests pasaron sin ejecutarlos.

## Al finalizar

Entrega:
- resumen de arquitectura implementada;
- árbol de archivos relevante;
- comandos exactos para levantar el proyecto;
- migraciones ejecutadas;
- tests ejecutados y resultados reales;
- decisiones añadidas a `docs/DECISIONS.md`;
- riesgos/limitaciones;
- siguiente tarea recomendada, sin implementarla todavía.

Actualiza `docs/IMPLEMENTATION_PLAN.md` marcando lo completado y lo pendiente. No marques como terminado algo que no haya sido probado.
