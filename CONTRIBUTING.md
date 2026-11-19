# Contribuir a NOVA PMS

## Antes de abrir un PR

1. Lee `AGENTS.md` y `docs/DECISIONS.md` (ADR index).
2. Ejecuta `git status --short` y protege cualquier cambio preexistente.
3. Un PR por tarea (`T-xx` en `docs/v5/NOVA_IMPROVEMENT_PLAN.md`). PRs pequeños,
   revisables y con rollback trivial.
4. No cambies contratos HTTP ni comportamiento observable en refactors.

## Reglas de código

- TypeScript estricto. `any` prohibido salvo justificación acotada.
- El tiempo se lee de `Clock` (`apps/api/src/common/time/clock.ts`):
  `this.clock.now()`, nunca `new Date()` sin argumentos ni `Date.now()`.
  En tests usa `FakeClock`. La regla ESLint `no-restricted-syntax` lo vigila.
- El tenant se resuelve en el servidor; nunca aceptes `organizationId`/
  `propertyId` del cliente como autoridad.
- Dinero en `Decimal`/unidades menores; fechas de calendario separadas de
  instantes, con timezone por propiedad.
- Validación de entrada con DTOs y whitelist. El backend manda; el frontend
  valida sólo para UX.
- No dupliques reglas de negocio entre web y API.

## Tamaño de archivos (guardrails)

| Ámbito                                         | Límite     | Estado de la regla                    |
| ---------------------------------------------- | ---------- | ------------------------------------- |
| `apps/api/src/**`                              | 500 líneas | `warn` (pasar a `error` al cerrar F2) |
| Función en `apps/api/src/**`                   | 120 líneas | `warn`                                |
| Complejidad ciclomática                        | 15         | `warn`                                |
| `apps/web/src/components/**`, `_components/**` | 300 líneas | `warn`                                |

Excepciones: `**/*.spec.ts`, `apps/api/test/**`, `clock.ts`, `prisma/**`.

## Tests

- Toda feature o corrección incluye tests relevantes y criterios de aceptación.
- Un endpoint nuevo con contexto tenant necesita un caso cross-tenant en
  `apps/api/test/tenant-isolation.e2e-spec.ts`.
- Los tests no dependen de la hora real: inyecta `Clock`/`FakeClock`.
- No desactives tests, lint ni tipos para "hacer pasar" el build.

## Verificación obligatoria

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @nova/web test
pnpm test:e2e            # requiere Postgres 17 + Redis
pnpm build
```

Pega la salida resumida en la descripción del PR. No afirmes que un comando
pasó si no lo ejecutaste; si el entorno no tiene base de datos, dilo.

## Seguridad y datos

- Secretos sólo por variables de entorno; nunca en el repo.
- No registres contraseñas, tokens, PII completa ni payloads de pago.
- No copies datos reales a sandbox; el seed es sintético.
- Revisa IDOR, mass assignment, CSRF/XSS y abuso de endpoints al agregar rutas.

## Commits

- Mensajes en el estilo del repositorio (`feat:`, `fix:`, `chore:`, `docs:`).
- Un commit por extracción lógica en refactors; tests verdes en cada paso.
