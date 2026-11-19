# NOVA PMS

SaaS hotelero multi-tenant (Organization → Property). Monorepo con API NestJS,
UI Next.js + Chakra UI, PostgreSQL como fuente de verdad y Redis como apoyo.

El tenant se resuelve siempre en el servidor a partir de la identidad y las
membresías autenticadas; nunca se confía en `organizationId`/`propertyId`
enviados por el cliente.

> La autenticación local es una transición controlada, no un proveedor de
> identidad definitivo, y no es producción-ready sin revisión de seguridad.
> Ver [SECURITY.md](docs/SECURITY.md) y [Limitaciones](docs/APP_REFERENCE.md#limitaciones).

## Requisitos

- Node.js 20.11+ y pnpm 8.15.1
- Docker Desktop (o Docker Engine + Compose v2)
- Puertos libres: 3000 (web), 3001 (API), 5432 (PostgreSQL), 6379 (Redis)

## Inicio rápido

```bash
cp .env.example .env
pnpm install
pnpm infra:up            # PostgreSQL + Redis con healthchecks
pnpm db:generate
pnpm db:migrate:deploy
pnpm db:seed             # datos sintéticos idempotentes
pnpm db:verify           # constraints y triggers manuales
pnpm dev                 # API + web en paralelo
```

- Web: <http://localhost:3000>
- API: <http://localhost:3001>
- Liveness: <http://localhost:3001/health/live>
- Readiness: <http://localhost:3001/health/ready>
- Swagger: <http://localhost:3001/docs> (solo fuera de producción)

## Comandos

| Comando                        | Descripción                                  |
| ------------------------------ | -------------------------------------------- |
| `pnpm dev`                     | API + web en watch                           |
| `pnpm build`                   | build de todos los workspaces                |
| `pnpm lint`                    | ESLint API + Next                            |
| `pnpm typecheck`               | `tsc --noEmit` en API y web                  |
| `pnpm test`                    | tests unitarios de API                       |
| `pnpm --filter @nova/web test` | tests unitarios de web (Vitest)              |
| `pnpm test:e2e`                | E2E API con `dev-header`                     |
| `pnpm test:e2e:auth`           | E2E de sesiones/CSRF/rate limit              |
| `pnpm test:e2e:all:isolated`   | Todos los E2E en schemas PostgreSQL aislados |
| `pnpm format` / `format:check` | Prettier                                     |
| `pnpm db:migrate:deploy`       | aplica migraciones existentes                |
| `pnpm db:seed`                 | datos sintéticos idempotentes                |
| `pnpm db:verify`               | valida constraints/triggers manuales         |
| `pnpm infra:up` / `infra:down` | Docker Compose                               |

Los E2E requieren infraestructura levantada, migraciones aplicadas y seed:
`pnpm infra:up && pnpm db:migrate:deploy && pnpm db:seed && pnpm db:verify`.

## Documentación

El índice con la fuente de verdad de cada tema está en
[docs/README.md](docs/README.md). Puntos de entrada habituales:

- [Arquitectura](docs/ARCHITECTURE.md) · [Base de datos](docs/DATABASE.md) · [API](docs/API.md)
- [Decisiones (ADR index)](docs/DECISIONS.md) · [Seguridad](docs/SECURITY.md)
- [Contribución](CONTRIBUTING.md) · [Plan de mejoras v5](docs/v5/NOVA_IMPROVEMENT_PLAN.md)
- [Referencia completa de la aplicación](docs/APP_REFERENCE.md)

Los documentos de `docs/archive/` son históricos y no describen el estado
actual del código.
