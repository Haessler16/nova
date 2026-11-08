# NOVA PMS — OpenCode Starter Pack

Este paquete convierte la visión de NOVA PMS en un punto de partida ejecutable para OpenCode. Está escrito como especificación inicial de producto e ingeniería, no como una afirmación de que todas las decisiones ya estén validadas con hoteles reales.

## Cómo empezar

1. Crea un repositorio vacío llamado `nova-pms` (o abre el repositorio que ya hayas creado).
2. Copia el contenido de este ZIP en la raíz del repositorio.
3. Abre esa carpeta en OpenCode.
4. Pide a OpenCode que lea primero `AGENTS.md` y todos los documentos de `docs/`.
5. Ejecuta el prompt `prompts/PROMPT_01_FOUNDATION.md`.
6. Revisa el plan y los cambios antes de aceptar operaciones destructivas o instalar dependencias.

## Stack inicial propuesto

- Monorepo con pnpm workspaces.
- Web: Next.js + React + TypeScript + Chakra UI.
- API: NestJS + TypeScript.
- Persistencia: PostgreSQL + Prisma.
- Redis: coordinación efímera, cache y eventos; nunca autoridad final para integridad.
- Tests: unitarios, integración y E2E.
- Despliegue inicial cloud-first, con PWA instalable como evolución controlada.

Las versiones exactas deben verificarse al iniciar el proyecto y fijarse en lockfile. No actualizar major versions sin una decisión documentada.

## Primera entrega esperada

No construir todavía un PMS completo. La primera entrega es una base ejecutable que incluya:

- estructura de monorepo;
- configuración local reproducible;
- PostgreSQL y Redis en Docker Compose;
- API NestJS y web Next.js arrancables;
- Prisma conectado y primera migración;
- configuración de lint, format y tests;
- documentación y health checks;
- modelo inicial de organización, propiedad, usuario, membresía y auditoría;
- aislamiento de tenant aplicado en backend;
- pruebas automatizadas de aislamiento.

## Documentos

- `AGENTS.md`: reglas permanentes para el agente.
- `docs/PRODUCT_BRIEF.md`: visión, alcance y reglas del producto.
- `docs/ARCHITECTURE.md`: arquitectura y límites entre módulos.
- `docs/DATABASE.md`: modelo de datos inicial y convenciones.
- `docs/API.md`: convenciones de API y endpoints previstos.
- `docs/SECURITY.md`: seguridad, privacidad y LGPD.
- `docs/IMPLEMENTATION_PLAN.md`: fases y orden de ejecución.
- `docs/DECISIONS.md`: decisiones confirmadas, hipótesis y preguntas abiertas.
- `prompts/PROMPT_01_FOUNDATION.md`: primer prompt de implementación.
- `prisma/schema.prisma`: punto de partida del esquema, sujeto a revisión.

## Regla de oro

La base de datos y el backend son la autoridad para operaciones críticas. La interfaz nunca decide por sí sola disponibilidad, asignación definitiva de habitaciones, cobros, cierres ni permisos.
