# NOVA PMS — Plan de mejoras de calidad, seguridad y cobertura

> Documento para ejecutar con un agente de código. Fecha de la revisión: 2026-11-17.
> Base: revisión del repo `Haessler16/nova` (AGENTS.md, PRODUCT_BRIEF, ARCHITECTURE, AUDIT_2026-11-15) y métricas medidas sobre el código.

## 0. Reglas para el agente (leer primero)

1. Lee `AGENTS.md`, `docs/ARCHITECTURE.md` y `docs/DECISIONS.md` antes de tocar nada. Si algo de este plan contradice AGENTS.md, **gana AGENTS.md** y lo reportas.
2. **Un PR por tarea** (las tareas llevan ID `T-xx`). PRs pequeños, revisables, con rollback trivial.
3. **No cambies el contrato HTTP** ni el comportamiento observable en las fases de refactor (F2, F3). Los tests e2e existentes deben pasar **sin modificarse**.
4. No construyas módulos futuros (pagos, Academy, OCR, offline completo). Las fases F9 y F10 son ADR/propuesta, no implementación, salvo confirmación explícita.
5. **No afirmes que un comando pasó si no lo ejecutaste.** Al cerrar cada tarea pega la salida resumida de los comandos de verificación.
6. Mantén el estilo existente: identificadores en inglés, errores con `{ code, message, details? }`, multi-tenancy resuelto en servidor, dinero en `Decimal`.
7. Si una tarea exige una decisión de producto o de infraestructura, **detente y pregunta**; no la inventes.

### Comandos de verificación estándar

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test                 # unitarios API
pnpm test:e2e             # API e2e (requiere Postgres 17 + Redis)
pnpm build
```

### Orden recomendado de PRs

| Orden | Fase                                       | Riesgo   | Valor                    |
| ----- | ------------------------------------------ | -------- | ------------------------ |
| 1     | F0 CI verde + higiene                      | Muy bajo | Desbloquea todo lo demás |
| 2     | F1 Clock inyectable                        | Bajo     | Tests deterministas      |
| 3     | F5 Guardrails ESLint (modo `warn`)         | Bajo     | Evita regresiones        |
| 4     | F2 Partir `front-office.service.ts`        | Medio    | Mantenibilidad           |
| 5     | F3 Partir páginas web grandes              | Medio    | Mantenibilidad           |
| 6     | F6 Tests de UI en CI                       | Bajo     | Red de seguridad         |
| 7     | F7 Supply chain y cobertura                | Bajo     | Seguridad                |
| 8     | F4 Defensa en profundidad del tenant (RLS) | Alto     | Seguridad de datos       |
| 9     | F8 Docs                                    | Bajo     | Claridad                 |
| 10    | F9 LGPD operativa                          | Alto     | Cumplimiento             |

---

## F0 — CI verde e higiene del repo

**Problema medido:** `pnpm format:check` falla en 44 archivos y es el primer paso de calidad del CI (`.github/workflows/ci.yml`), así que el pipeline está rojo antes de llegar a lint. Además hay artefactos versionados que no deben estar.

### T-01 Formatear todo

```bash
pnpm format                       # prettier --write
pnpm format:check                 # debe salir 0
git diff --stat | tail -1
```

Commit aislado: `chore: apply prettier to whole repo`. **No mezcles lógica** en este commit.

**Aceptación:** `pnpm format:check` sale con código 0.

### T-02 Quitar basura versionada

```bash
git rm --cached .DS_Store 2>/dev/null || true
git ls-files | grep -E "\.DS_Store$" | xargs -r git rm --cached
git ls-files | grep -E "\.(xlsx|docx)$|^shot-.*\.png$"   # revisar y decidir
```

- `.DS_Store` ya está en `.gitignore`; solo hay que desversionarlo.
- Mueve `*.xlsx`, `*.docx` y capturas sueltas de la raíz a `docs/assets/` (o elimínalos si son artefactos de trabajo). Si pesan más de ~500 KB, sácalos del repo y enlázalos.
- Actualiza `package.json`: reemplaza la `description` "Phase 1 foundation…" por una descripción actual y sube `version` si corresponde.

**Aceptación:** `git ls-files | grep -E "\.DS_Store"` no devuelve nada; la raíz del repo contiene solo configuración, `apps/`, `docs/`, `prisma/`, `scripts/`.

### T-03 Confirmar que H-01 de la auditoría está cerrado

`docs/audit/AUDIT_2026-11-15.md` registra H-01 (test de disponibilidad con expectativa desactualizada). Verifica si sigue abierto:

```bash
pnpm --filter api test:e2e -- guests-reservations
```

Si falla, corrige **el test o el código según corresponda** y documenta cuál era la fuente de verdad. Si pasa, actualiza el estado en la auditoría.

---

## F1 — `Clock` inyectable (fechas deterministas)

**Problema medido:** hay ~95 llamadas a `new Date()` / `Date.now()` en `apps/api/src` (11 en `front-office.service.ts`, 7 en `session.service.ts`, 6 en `auth.service.ts`…). La auditoría ya registró tests que dependían de la hora UTC.

### T-04 Crear `Clock`

`apps/api/src/common/time/clock.ts`

```ts
import { Injectable } from '@nestjs/common';

/** Single source of "now". Inject it instead of calling `new Date()`. */
export abstract class Clock {
  abstract now(): Date;
}

@Injectable()
export class SystemClock extends Clock {
  now(): Date {
    return new Date();
  }
}
```

`apps/api/src/common/time/clock.module.ts`

```ts
import { Global, Module } from '@nestjs/common';
import { Clock, SystemClock } from './clock';

@Global()
@Module({
  providers: [{ provide: Clock, useClass: SystemClock }],
  exports: [Clock],
})
export class ClockModule {}
```

Importa `ClockModule` una vez en `AppModule`.

`apps/api/src/common/time/fake-clock.ts` (solo tests)

```ts
import { Clock } from './clock';

export class FakeClock extends Clock {
  constructor(private current: Date) {
    super();
  }
  now(): Date {
    return new Date(this.current.getTime());
  }
  set(next: Date | string): void {
    this.current = new Date(next);
  }
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}
```

### T-05 Migrar servicios por orden de impacto

Orden: `front-office` → `night-audit` → `folio` → `documents` → `room-assignment-leases` → `auth/*`.

Antes:

```ts
const operationalDay = computeOperationalDay(
  new Date(),
  property.timezone,
  property.operationalDayStart,
);
```

Después:

```ts
constructor(
  private readonly prisma: PrismaService,
  private readonly audit: AuditService,
  private readonly clock: Clock,
  /* ... */
) {}

const operationalDay = computeOperationalDay(
  this.clock.now(),
  property.timezone,
  property.operationalDayStart,
);
```

Test determinista:

```ts
const clock = new FakeClock(new Date('2026-03-10T02:30:00Z')); // 23:30 en America/Sao_Paulo del día 9
// ... construir el módulo de test con { provide: Clock, useValue: clock }
clock.set('2026-03-10T09:00:00Z');
```

Escribe al menos estos casos para `computeOperationalDay`/check-in: antes/después de `operationalDayStart`, cambio de día UTC vs local, y zona horaria con DST.

**Aceptación:** los tests del servicio migrado no dependen de la hora real; `grep -n "new Date()" <archivo>` sin resultados (salvo parseo con argumentos).

---

## F5 — Guardrails de ESLint (hacer justo después de F1)

**Objetivo:** que lo corregido no vuelva a degradarse. Primero en `warn` para no bloquear; subir a `error` cuando F1/F2 terminen. **Estado: `error` desde que `eslint src` quedó en 0 warnings** (reservations, reports, reservation-party, rooms, night-audit, admin, auth, folio e instructions partidos).

`apps/api/.eslintrc.js` (añadir a `rules`)

```js
rules: {
  // ...existentes
  'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
  'max-lines-per-function': ['error', { max: 120, skipBlankLines: true, skipComments: true }],
  complexity: ['error', 15],
  'no-restricted-syntax': [
    'error',
    {
      selector: "NewExpression[callee.name='Date'][arguments.length=0]",
      message: 'Inject Clock and use clock.now() instead of new Date().',
    },
    {
      selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
      message: 'Inject Clock and use clock.now() instead of Date.now().',
    },
  ],
},
overrides: [
  {
    files: ['**/*.spec.ts', 'test/**/*.ts', 'src/common/time/clock.ts', 'prisma/**/*.ts'],
    rules: { 'no-restricted-syntax': 'off', 'max-lines': 'off', 'max-lines-per-function': 'off' },
  },
],
```

Para la web (`apps/web/.eslintrc.json`), añade `max-lines` a 300 en `warn` para `src/components/**` y `src/app/**/_components/**`.

**Aceptación:** `pnpm lint` pasa sin warnings (161 → 0) y las reglas quedan en `error`, de modo que cualquier archivo nuevo que las viole rompe el lint.

---

## F2 — Partir `front-office.service.ts` (2.271 líneas)

**Estado actual** (métodos públicos y su posición): `overview` (428), `checkInReadiness` (689), `checkIn` (836), `checkoutReadiness` (1119), `checkOut` (1199), `roomMoveCandidates` (1423), `moveRoom` (1585), `noShow` (1729), `listIncidents` (1833), `createIncident` (1856), `resolveIncident` (1955). Helpers privados: `readCheckoutFolios`, `loadProperty`, `lockReservation`, `lockStay`, `lockRoom`, `assertRoomInProperty`.

**Regla:** refactor puro. Misma firma pública, mismos errores, mismos códigos. Un commit por extracción, tests e2e verdes en cada commit.

### Estructura objetivo

```
apps/api/src/front-office/
  front-office.controller.ts        # sin cambios
  front-office.module.ts            # registra los nuevos providers
  front-office.service.ts           # fachada delgada (≤ 120 líneas)
  application/
    overview.query.ts
    check-in.use-case.ts            # checkInReadiness + checkIn
    check-out.use-case.ts           # checkoutReadiness + checkOut
    room-move.use-case.ts           # roomMoveCandidates + moveRoom
    no-show.use-case.ts
    incidents.service.ts
  infrastructure/
    row-locks.ts                    # lockReservation / lockStay / lockRoom
    property-loader.ts              # loadProperty
  room-move.ts                      # ya existe (dominio)
  room-occupancy.ts                 # ya existe (dominio)
```

### T-06 Extraer `row-locks.ts` (primer paso, el más seguro)

Hoy `lockReservation` y `lockStay` son casi idénticos. Unifícalos con una lista cerrada de tablas (nunca interpolar strings del usuario):

```ts
// infrastructure/row-locks.ts
import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export type Transaction = Prisma.TransactionClient;

const LOCKABLE = {
  Reservation: {
    table: Prisma.raw('"Reservation"'),
    code: 'reservation_not_found',
    label: 'Reservation',
  },
  Stay: { table: Prisma.raw('"Stay"'), code: 'stay_not_found', label: 'Stay' },
} as const;

export type LockableEntity = keyof typeof LOCKABLE;

export async function lockRow(
  tx: Transaction,
  entity: LockableEntity,
  scope: { organizationId: string; propertyId: string; id: string },
): Promise<void> {
  const { table, code, label } = LOCKABLE[entity];
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id" FROM ${table}
    WHERE "id" = ${scope.id}::uuid
      AND "organizationId" = ${scope.organizationId}::uuid
      AND "propertyId" = ${scope.propertyId}::uuid
    FOR UPDATE
  `);
  if (rows.length === 0) {
    throw new NotFoundException({
      code,
      message: `${label} not found in the selected property.`,
    });
  }
}
```

En el servicio, `lockReservation` pasa a ser:

```ts
await lockRow(tx, 'Reservation', { organizationId, propertyId, id: reservationId });
return tx.reservation.findFirstOrThrow({
  where: { id: reservationId },
  select: RESERVATION_SUMMARY_SELECT,
});
```

`lockRoom` mantiene su helper específico si devuelve datos adicionales; no fuerces la unificación.

**Aceptación:** `pnpm test:e2e -- front-office` verde; los códigos de error `reservation_not_found` / `stay_not_found` y sus mensajes no cambian.

### T-07 Extraer `CheckInUseCase`

```ts
// application/check-in.use-case.ts
@Injectable()
export class CheckInUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly roomState: RoomStateService,
    private readonly leases: RoomAssignmentLeasesService,
    private readonly clock: Clock,
    private readonly properties: PropertyLoader,
  ) {}

  readiness(context: TenantContext, reservationId: string): Promise<CheckInReadiness> {
    /* mover el cuerpo de checkInReadiness tal cual */
  }

  async execute(
    context: TenantContext,
    reservationId: string,
  ): Promise<{ reservation: ReservationSummaryResponse; stay: StayResponse }> {
    /* mover el cuerpo de checkIn tal cual; dividir en funciones puras:
       - assertCheckInWindow(...)   (ya existe buildCheckInWindow)
       - ensureRoomAssignable(...)
       - createStay(...)
       - appendCheckInAudit(...)    */
  }
}
```

La fachada delega:

```ts
@Injectable()
export class FrontOfficeService {
  constructor(
    private readonly checkInUseCase: CheckInUseCase,
    private readonly checkOutUseCase: CheckOutUseCase,
    private readonly roomMoveUseCase: RoomMoveUseCase,
    private readonly noShowUseCase: NoShowUseCase,
    private readonly overviewQuery: OverviewQuery,
    private readonly incidents: IncidentsService,
  ) {}

  checkIn(context: TenantContext, reservationId: string) {
    return this.checkInUseCase.execute(context, reservationId);
  }
  checkInReadiness(context: TenantContext, reservationId: string) {
    return this.checkInUseCase.readiness(context, reservationId);
  }
  // ...resto igual: el controller no cambia
}
```

Repite para `CheckOutUseCase`, `RoomMoveUseCase`, `NoShowUseCase`, `OverviewQuery` e `IncidentsService`, **uno por PR**.

**Meta por archivo:** ≤ 500 líneas; ninguna función > 120 líneas ni complejidad > 15. `checkIn` (~280 líneas) y `checkOut` (~220) deben partirse en funciones internas con nombre.

**Aceptación global F2:**

- `front-office.service.ts` ≤ 150 líneas.
- `pnpm test:e2e` verde sin tocar los tests.
- `grep -rn "FrontOfficeService" apps/api/src` muestra que controller y módulo no cambiaron su uso.
- Pasar las reglas de F5 de `warn` a `error` para estos archivos.

Después, aplica el mismo patrón al siguiente archivo más grande (`reservations.service.ts`, 1.208 líneas), solo si el tiempo lo permite.

---

## F3 — Partir las páginas web grandes

**Medido:** `front-office/page.tsx` 2.283 líneas, `reservations/page.tsx` 1.841, `inventory/rooms/page.tsx` 1.619. Todos son `'use client'` y concentran estado, fetch, formularios y modales.

### Estructura objetivo (ejemplo para Front Office)

```
apps/web/src/app/(app)/front-office/
  page.tsx                      # composición, ≤ 150 líneas
  _components/
    ArrivalsPanel.tsx
    InHousePanel.tsx
    DeparturesPanel.tsx
    IncidentsPanel.tsx
    RoomMoveModal.tsx
    NoShowDialog.tsx
  _hooks/
    useFrontOfficeOverview.ts
    useCheckIn.ts
    useCheckOut.ts
  _lib/
    types.ts
    formatters.ts
```

### T-08 Patrón de extracción

1. Mueve los **tipos y formateadores** a `_lib/` (cero riesgo).
2. Extrae **un modal o panel por PR**; el estado del modal (`useDisclosure`) vive dentro del componente.
3. Extrae los **efectos de datos** a hooks; la página queda solo componiendo.

Ejemplo de `page.tsx` final:

```tsx
'use client';

import { Stack } from '@chakra-ui/react';
import { ArrivalsPanel } from './_components/ArrivalsPanel';
import { InHousePanel } from './_components/InHousePanel';
import { DeparturesPanel } from './_components/DeparturesPanel';
import { IncidentsPanel } from './_components/IncidentsPanel';
import { useFrontOfficeOverview } from './_hooks/useFrontOfficeOverview';

export default function FrontOfficePage() {
  const { data, isLoading, error, refresh } = useFrontOfficeOverview();

  return (
    <Stack spacing={6}>
      <ArrivalsPanel items={data?.arrivals ?? []} loading={isLoading} onChanged={refresh} />
      <InHousePanel items={data?.inHouse ?? []} loading={isLoading} onChanged={refresh} />
      <DeparturesPanel items={data?.departures ?? []} loading={isLoading} onChanged={refresh} />
      <IncidentsPanel items={data?.incidents ?? []} loading={isLoading} onChanged={refresh} />
    </Stack>
  );
}
```

Ejemplo de hook (adaptar al cliente HTTP que ya use el proyecto en `src/lib`):

```ts
// _hooks/useFrontOfficeOverview.ts
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api'; // usar el helper existente
import type { FrontOfficeOverview } from '../_lib/types';

export function useFrontOfficeOverview() {
  const [data, setData] = useState<FrontOfficeOverview | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setData(await apiFetch<FrontOfficeOverview>('/front-office/overview'));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, error, isLoading, refresh };
}
```

> Si el proyecto ya usa una librería de datos (React Query, SWR), úsala en lugar de este hook manual; no añadas una dependencia nueva sin preguntar.

**Reglas:** ningún componente > 300 líneas; ningún cambio visual ni de textos; los `data-testid` y roles que usan los specs de Playwright se conservan.

**Aceptación:** `pnpm --filter web typecheck && pnpm --filter web lint && pnpm --filter web build`, más los 3 specs de Playwright existentes en verde (ver F6).

---

## F6 — Tests de UI en CI

**Problema medido:** solo hay 3 specs de Playwright (`front-office-checkin`, `inventory-validation`, `reservation-party`), el CI no los ejecuta y `apps/web` no tiene script `test` ni tests de componentes.

### T-09 Ejecutar Playwright en CI

`playwright.config.ts` asume API y web ya levantados (`PLAYWRIGHT_BASE_URL` por defecto `http://localhost:3000`, API en `:3001`). Añade un job en `.github/workflows/ci.yml`:

```yaml
e2e-web:
  name: Web e2e (Playwright)
  runs-on: ubuntu-latest
  needs: verify
  services:
    postgres:
      image: postgres:17
      env: { POSTGRES_USER: nova, POSTGRES_PASSWORD: nova_local_only, POSTGRES_DB: nova_pms }
      ports: ['5432:5432']
      options: >-
        --health-cmd "pg_isready -U nova -d nova_pms" --health-interval 5s --health-timeout 5s --health-retries 20
    redis:
      image: redis:7
      ports: ['6379:6379']
  env:
    NODE_ENV: test
    AUTH_MODE: dev-header
    DATABASE_URL: postgresql://nova:nova_local_only@localhost:5432/nova_pms?schema=public
    REDIS_URL: redis://localhost:6379
    PLAYWRIGHT_BASE_URL: http://localhost:3000
    PLAYWRIGHT_API_URL: http://localhost:3001
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
      with: { version: 8.15.1 }
    - uses: actions/setup-node@v4
      with: { node-version: 22, cache: pnpm }
    - run: pnpm install --frozen-lockfile
    - run: pnpm db:generate && pnpm db:migrate:deploy && pnpm db:seed
    - run: pnpm --filter api build && pnpm --filter web build
    - name: Start API and web
      run: |
        (pnpm --filter api start:prod > api.log 2>&1 &)
        (pnpm --filter web start > web.log 2>&1 &)
        npx wait-on http://localhost:3001/health http://localhost:3000
    - run: pnpm --filter web exec playwright install --with-deps chromium
    - run: pnpm --filter web test:e2e:ui
    - if: failure()
      uses: actions/upload-artifact@v4
      with:
        name: playwright-debug
        path: |
          apps/web/test-results
          api.log
          web.log
```

Ajusta los nombres de scripts (`start:prod`, ruta de health) a los reales del repo; verifícalos antes de escribir el job.

### T-10 Tests de componentes con Vitest

```bash
pnpm --filter web add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

`apps/web/vitest.config.ts`

```ts
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  test: { environment: 'jsdom', setupFiles: ['./vitest.setup.ts'], globals: true },
});
```

`apps/web/vitest.setup.ts`: `import '@testing-library/jest-dom/vitest';`

Añade en `apps/web/package.json`: `"test": "vitest run"`, y un paso `pnpm --filter web test` al job `verify`.

Ejemplo (componente extraído en F3; adaptar nombres reales):

```tsx
// ArrivalsPanel.test.tsx
import { ChakraProvider } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { ArrivalsPanel } from './ArrivalsPanel';

const arrival = { reservationId: 'r1', guestName: 'Ana Souza', roomNumber: '101' };

it('muestra llegadas y abre el flujo de check-in', async () => {
  render(
    <ChakraProvider>
      <ArrivalsPanel items={[arrival]} loading={false} onChanged={vi.fn()} />
    </ChakraProvider>,
  );
  expect(screen.getByText('Ana Souza')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /check-in/i }));
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
});
```

**Prioriza** tests de: formateadores de dinero/fechas, validaciones de formularios, estados de error/loading de los paneles de Front Office, y el parser de notas si vive en la web.

**Aceptación:** el job `e2e-web` corre en cada PR y `pnpm --filter web test` forma parte de `verify`.

---

## F7 — Supply chain y cobertura

### T-11 Dependabot

`.github/dependabot.yml`

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule: { interval: weekly }
    open-pull-requests-limit: 5
    groups:
      minor-and-patch:
        update-types: [minor, patch]
  - package-ecosystem: github-actions
    directory: /
    schedule: { interval: weekly }
```

### T-12 Auditoría de dependencias y secretos en CI

Paso en `verify`:

```yaml
- name: Audit dependencies
  run: pnpm audit --prod --audit-level=high
```

Workflow separado `secrets.yml` con `gitleaks/gitleaks-action@v2` en PR. Documenta en `docs/` cómo gestionar falsos positivos.

### T-13 Umbral de cobertura (ratchet)

`apps/api/jest.config.js` (ya existe `collectCoverageFrom`). Mide primero la cobertura real:

```bash
pnpm --filter api test -- --coverage
```

Luego fija el umbral **ligeramente por debajo** del valor medido para que solo pueda subir:

```js
coverageThreshold: {
  global: { statements: 70, branches: 60, functions: 70, lines: 70 }, // ajustar a lo medido
},
```

Y exige más en carpetas críticas (ejemplo):

```js
  './src/folio/': { statements: 85, branches: 75 },
  './src/front-office/': { statements: 80, branches: 70 },
```

### T-14 Config de auth segura por defecto

`AUTH_MODE=dev-header` está en `.env.example` y en el CI (aceptable para pruebas). Verifica y deja cubierto con test que:

- en `NODE_ENV=production` la app **no arranca** con `AUTH_MODE=dev-header` (ya existe el bloqueo; añade/confirma el test de configuración),
- `.env.example` marca `dev-header` con comentario `# NEVER in production`.

**Aceptación F7:** Dependabot activo, `pnpm audit` en CI, umbral de cobertura configurado y documentado.

---

## F4 — Defensa en profundidad del tenant (Row Level Security)

**Contexto:** hoy el aislamiento depende de que cada servicio filtre por `organizationId` / `propertyId` (bien resuelto en servidor y probado con e2e de aislamiento de 19 casos). Es correcto, pero es una **convención**: un `findMany` sin filtro filtraría datos de otro hotel. Con prioridad nº1 en AGENTS.md, conviene que la base de datos también lo imponga.

> **Esta fase requiere un ADR aprobado antes de implementarse** (`docs/DECISIONS.md`). Alto riesgo: cambia el modelo de conexión. No la ejecutes sin confirmación.

### T-15 ADR: RLS con `set_config` por transacción

Decisión a documentar:

- Roles separados: `nova_migrator` (owner/migraciones, `BYPASSRLS` solo si es imprescindible) y `nova_app` (usado por la API, **sin** `BYPASSRLS`, **no superusuario**).
- Cada request de la API ejecuta sus consultas dentro de una transacción que fija `app.organization_id` con `set_config(..., true)` (alcance local a la transacción; compatible con PgBouncer en modo transaction).
- Fail-closed: sin variable fijada, las políticas devuelven 0 filas.

**Advertencia importante:** en el CI, `POSTGRES_USER=nova` crea un **superusuario**, y los superusuarios ignoran RLS. Los tests de RLS deben conectarse con un rol no superusuario creado en la migración o en el setup.

### T-16 Piloto en una tabla (no en todas)

Migración (ejemplo con `Incident`; elige la tabla real según el modelo):

```sql
-- prisma/migrations/<ts>_rls_pilot_incident/migration.sql
CREATE ROLE nova_app LOGIN PASSWORD 'change-me-via-secret' NOSUPERUSER NOBYPASSRLS;
GRANT SELECT, INSERT, UPDATE, DELETE ON "Incident" TO nova_app;

ALTER TABLE "Incident" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Incident" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "Incident"
  USING ("organizationId" = NULLIF(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK ("organizationId" = NULLIF(current_setting('app.organization_id', true), '')::uuid);
```

Helper en `PrismaService`:

```ts
async withTenant<T>(
  context: { organizationId: string },
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return this.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.organization_id', ${context.organizationId}, true)`;
    return fn(tx);
  });
}
```

Uso:

```ts
return this.prisma.withTenant(context, (tx) =>
  tx.incident.findMany({ where: { propertyId }, select: INCIDENT_SELECT }),
);
```

Test e2e obligatorio (conexión con `nova_app`):

```ts
it('sin tenant fijado, RLS devuelve 0 filas', async () => {
  const rows = await appPrisma.incident.findMany(); // sin withTenant
  expect(rows).toHaveLength(0);
});

it('con tenant A no ve filas del tenant B', async () => {
  const rows = await prisma.withTenant({ organizationId: orgA }, (tx) => tx.incident.findMany());
  expect(rows.every((r) => r.organizationId === orgA)).toBe(true);
});
```

**Aceptación del piloto:** tests anteriores verdes; sin regresión de rendimiento (comparar `EXPLAIN` en las consultas del piloto); plan de rollback = `ALTER TABLE ... DISABLE ROW LEVEL SECURITY`. Extender al resto de tablas es una decisión posterior, tabla por tabla.

### T-17 Test de cobertura de aislamiento por ruta (independiente de RLS)

Objetivo: que un endpoint nuevo **no pueda** entrar sin caso cross-tenant. Ejemplo:

```ts
// apps/api/test/tenant-route-coverage.e2e-spec.ts
import { COVERED_ROUTES } from './tenant-isolation/covered-routes';

it('toda ruta con contexto de tenant tiene un caso cross-tenant', async () => {
  const router = app.getHttpAdapter().getInstance()._router; // Express 4; ajustar si cambia
  const actual = router.stack
    .filter((l: { route?: unknown }) => l.route)
    .flatMap((l: { route: { path: string; methods: Record<string, boolean> } }) =>
      Object.keys(l.route.methods).map((m) => `${m.toUpperCase()} ${l.route.path}`),
    )
    .filter((r: string) => !PUBLIC_ROUTES.has(r));

  const missing = actual.filter((r: string) => !COVERED_ROUTES.has(r));
  expect(missing).toEqual([]);
});
```

`COVERED_ROUTES` se rellena a mano con las rutas ya cubiertas por los 19 casos existentes; cualquier ruta nueva rompe el test hasta que se añada su caso.

---

## F8 — Documentación

### T-18 Consolidar y sincronizar

1. Crea `docs/README.md` como índice: qué documento es la **fuente de verdad** y cuáles son históricos.
2. Mueve `docs/v2`, `docs/v3`, `docs/v4` y los `PHASE_x_REPORT` a `docs/archive/` (conservar, no borrar).
3. Reduce `README.md` raíz a: qué es, cómo levantar, comandos, enlaces a docs. Mueve el resto (≈40 KB) a `docs/`.
4. Actualiza `docs/audit/AUDIT_2026-11-15.md`: el README ya marca como implementados el drawer y el lease del room rack, que la auditoría lista como no iniciados. Añade `AUDIT_2026-11-17.md` con el estado verificado y la salida de los comandos de la sección 0.
5. Añade `CONTRIBUTING.md` con las reglas de PR de este documento (tamaño de archivos, `Clock`, no `any`, tests por ruta).

**Aceptación:** un desarrollador nuevo llega de `README.md` a una instancia local funcionando en < 15 minutos siguiendo solo el índice.

---

## F9 — LGPD operativa (ADR primero, implementación después de confirmar)

**Hueco según la auditoría:** retención, anonimización, derechos del titular y registro de lecturas de datos sensibles. Hoy `Guest` guarda `fullName`, `email`, `phone`, `documentType`, `documentNumber`, `notes` y hay `GuestFnrhProfile`.

### T-19 ADR (obligatorio, sin código de producción)

Decidir con el hotel piloto y asesoría legal:

- Plazos de retención por tipo de dato (huésped sin estadía, huésped con estadía, datos fiscales/FNRH).
- Qué se **anonimiza** y qué se conserva por obligación legal (folios, documentos fiscales).
- Quién puede ejecutar exportación/anonimización (permiso nuevo en RBAC).
- Quién y cuándo se audita la **lectura** de documento/teléfono/email completo.

### T-20 Esbozo técnico (para implementar tras aprobar el ADR)

Anonimización transaccional con auditoría, sin hard delete:

```ts
// guests/guest-anonymization.service.ts
@Injectable()
export class GuestAnonymizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly clock: Clock,
  ) {}

  async anonymize(context: TenantContext, guestId: string, reason: string) {
    const propertyId = requirePropertyContext(context);

    return this.prisma.$transaction(async (tx) => {
      await lockGuest(tx, { organizationId: context.organizationId, propertyId, id: guestId });

      const blocking = await tx.stay.count({
        where: { guestId, organizationId: context.organizationId, status: 'IN_HOUSE' },
      });
      if (blocking > 0) {
        throw new ConflictException({
          code: 'guest_has_active_stay',
          message: 'Guest has an active stay and cannot be anonymized.',
        });
      }

      await tx.guest.update({
        where: { id: guestId },
        data: {
          fullName: `ANONYMIZED-${guestId.slice(0, 8)}`,
          email: null,
          phone: null,
          documentType: null,
          documentNumber: null,
          notes: null,
          status: 'ARCHIVED', // usar el valor real de RecordStatus
        },
      });
      await tx.guestNote.deleteMany({ where: { guestId } });

      await this.audit.append(
        {
          organizationId: context.organizationId,
          propertyId,
          actorUserId: context.userId,
          action: 'guest.anonymized',
          entityType: 'Guest',
          entityId: guestId,
          reason,
          // NUNCA incluir los datos anonimizados en metadata
          metadata: { anonymizedAt: this.clock.now().toISOString() },
        },
        tx,
      );
    });
  }
}
```

Auditoría de lectura de datos sensibles (interceptor, ajustar al guard/permisos reales):

```ts
@Injectable()
export class SensitiveReadAuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(ctx: ExecutionContext, next: CallHandler) {
    const req = ctx.switchToHttp().getRequest();
    return next.handle().pipe(
      tap(() => {
        void this.audit.append({
          organizationId: req.tenant.organizationId,
          propertyId: req.tenant.propertyId,
          actorUserId: req.user?.id,
          action: 'guest.sensitive_read',
          entityType: 'Guest',
          entityId: req.params.id,
          metadata: { route: req.route?.path },
        });
      }),
    );
  }
}
```

Reglas de datos:

- Tests de que el parser de instrucciones y los logs **no** contienen documento, teléfono ni email (ya existe redacción de NSU/authcode; ampliar a PII).
- Exportación del titular: JSON con campos del huésped + estadías, generado bajo permiso explícito y auditado.
- Job periódico de anonimización por retención: idempotente, por lotes, con límite por ejecución y registro por lote.

---

## F10 — Roadmap posterior (solo ADRs por ahora)

Redactar un ADR corto por cada ítem, sin implementar:

1. **Pagos con proveedor**: tokenización, preautorización, webhooks idempotentes, reversos, conciliación. Define primero la interfaz `PaymentProvider` y el modelo de estados.
2. **Offline real**: outbox idempotente en cliente con `Idempotency-Key` por mutación, resolución de conflictos y qué operaciones se permiten sin red.
3. **Perfil de huésped con historial** (depende de la decisión de LGPD de F9).
4. **Auth de producción**: IdP externo vs. auth local con revisión de seguridad (la auth local está declarada como no apta para producción).
5. **FNRH, OCR/PDF de importación y Academy**: mantener fuera de alcance hasta tener piloto.

---

## Checklist final de cierre

- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm build` en verde (salida pegada en el PR).
- [ ] Job `e2e-web` ejecutándose en CI.
- [ ] Ningún `new Date()` sin argumentos fuera de `clock.ts`, specs y seeds.
- [ ] `front-office.service.ts` ≤ 150 líneas; ningún archivo de la API > 500 líneas en los módulos tocados.
- [ ] Páginas web divididas; ningún componente nuevo > 300 líneas.
- [ ] Dependabot, `pnpm audit` y escaneo de secretos activos.
- [ ] ADRs de F4, F9 y F10 creados en `docs/DECISIONS.md` (sin implementación no aprobada).
- [ ] `docs/audit/AUDIT_2026-11-17.md` con el estado real verificado.
