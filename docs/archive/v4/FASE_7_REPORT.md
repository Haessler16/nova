# Fase 7 — Internacionalización operativa pt-BR (parte 1: capa base y chrome)

**Fecha:** 2026-11-18
**Ficha:** `docs/v4/NOVA_PMS_FICHA_04_OPENCODE_TECHNICAL.md`, sección «9. Fase 7 — Internacionalización operativa pt-BR».
**Estado:** en ejecución. Parte 1 entregada: infraestructura i18n, capa compartida y rutas de entrada. Parte 2 entregada: pantalla piloto `inventory/room-types` completa. Resto de las pantallas pendientes (partes 3–4).
**Rama:** `main`.
**ADR:** ADR-058 sustituye el punto «UI copy stays in Spanish» de ADR-050.

---

## 1. Por qué una parte y no la fase completa

La ficha pide traducir transversalmente etiquetas, estados, categorías, prioridades, acciones, validaciones,
errores y mensajes, y prohíbe explícitamente mezclar portugués y español en la misma pantalla.

La medición previa encontró **~292 cadenas visibles en español repartidas en 31 archivos** (21 rutas y 14
componentes), sin ninguna capa de i18n: cada label era un literal dentro del JSX. Traducir todo en un solo
cambio, sin capa, produce pantallas a medio traducir y un glosario inconsistente, que es justo lo que la
ficha prohíbe. Por eso la fase se ejecuta en incrementos y **cada pantalla se migra de forma atómica**.

Esta parte 1 construye la base que faltaba y migra la copia que se repite en todas las pantallas:

- resolución de locale en servidor y provider de cliente;
- diccionarios tipados `es` / `pt-BR` sin dependencias nuevas;
- navegación y chrome del shell, estados de carga/error/vacío, `ActionDialog`, login y página offline.

---

## 2. Qué se agregó

| Archivo                               | Rol                                                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/lib/i18n/locale.ts`     | `Locale`, `LOCALES`, `LOCALE_COOKIE`, `DEFAULT_LOCALE`, `INTL_LOCALE`, `resolveLocale`                        |
| `apps/web/src/lib/i18n/es.ts`         | Diccionario español; **fuente de verdad de las claves** (`TranslationKey`) y del texto que la app ya mostraba |
| `apps/web/src/lib/i18n/pt-BR.ts`      | Diccionario `pt-BR` tipado como `Record<TranslationKey, string>`: una clave sin traducir es un error de `tsc` |
| `apps/web/src/lib/i18n/dictionary.ts` | `translate(locale, key, vars)` con interpolación `{placeholder}` y fallback a `es`                            |
| `apps/web/src/lib/i18n/provider.tsx`  | `I18nProvider` (locale resuelto en servidor) y `useI18n()` → `{ locale, intlLocale, t }`                      |
| `apps/web/src/lib/i18n/index.ts`      | Superficie pública del módulo                                                                                 |

Sin dependencias nuevas: `next-intl`/`react-intl` se descartaron en ADR-058 porque hoy no hacen falta ICU,
plurales ni carga diferida, y AGENTS.md exige justificar cada dependencia.

## 3. Qué se migró a diccionario

| Superficie                         | Detalle                                                                                                                                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app/layout.tsx`                   | Lee la cookie `nova_locale`, escribe `<html lang>`, pasa el locale a `Providers` y resuelve la metadata en `generateMetadata` (`title`/`description` por diccionario; ninguna cadena queda en un idioma fijo)      |
| `app/providers.tsx`                | Envuelve la app con `I18nProvider` dentro de Chakra y fuera de `SessionProvider`                                                                                                                                   |
| `components/app-shell.tsx`         | Navegación completa (3 secciones, 17 ítems), breadcrumb del topbar, selector de organización/propiedad, tarjeta de usuario, menú, «Saltar al contenido», y las dos guardas (`AuthenticatedLayout`, `PropertyGate`) |
| `components/action-dialog.tsx`     | Eyebrows de los tres tonos, «Cancelar», y el aviso «¿Descartar lo escrito?» con sus dos acciones                                                                                                                   |
| `components/ui.tsx`                | `QueryFeedback` («Cargando…», vacío por defecto) y `ErrorAlert` («Reintentar»)                                                                                                                                     |
| `components/connection-status.tsx` | «En línea» / «Sin conexión» del topbar                                                                                                                                                                             |
| `app/login/page.tsx`               | Título, subtítulos por modo de auth, campos, MFA, mensajes de validación local, ayuda de dev-header, pie y «Ir al panel»                                                                                           |
| `app/offline/page.tsx`             | Título de metadata, encabezado, cuerpo y acción, resueltos en servidor con la misma cookie                                                                                                                         |

El glosario `pt-BR` sigue la terminología hotelera brasileña pedida por la ficha: `UH`, `Hóspede`,
`Governança`, `Caixa`, `Conta` (folio), `Reserva`, `Check-in`, `Checkout`, `Propriedade`.
Los identificadores de enums y los valores de API no se traducen: sólo sus etiquetas.

## 4. Cómo se activa el idioma

- Cookie `nova_locale` con valor `pt-BR` (o `es`). Cualquier otro valor cae en `DEFAULT_LOCALE`.
- `DEFAULT_LOCALE` sigue siendo `es` **a propósito**: mientras falten pantallas por migrar, cambiar el
  defecto dejaría el producto mezclado. Al cerrar la fase, pasar a `pt-BR` es un cambio de una línea.
- La cookie es una preferencia de presentación: no participa de autenticación ni de tenancy.

```bash
# vista previa de QA del chrome en portugués
curl -H 'Cookie: nova_locale=pt-BR' http://127.0.0.1:3000/login
```

## 5. Verificación

| Comando                                 | Resultado                                                                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm --filter @nova/web typecheck`     | OK — incluye la garantía de que `pt-BR` cubre todas las claves de `es`                                                         |
| `pnpm --filter @nova/web lint`          | OK — sin warnings                                                                                                              |
| `pnpm --filter @nova/web build`         | OK — 23 rutas compiladas                                                                                                       |
| `pnpm test` (API)                       | 20 suites / 115 tests OK — sin cambios de backend                                                                              |
| Servidor compilado + `curl`             | `/login` responde `<html lang="es">` por defecto, `<html lang="pt-BR">` con cookie, `<html lang="es">` con `nova_locale=fr-FR` |
| `curl /offline` con `nova_locale=pt-BR` | Renderiza «Sem conexão», «Sem conexão — NOVA PMS» y «Tentar novamente»                                                         |

Lo que **no** se ejecutó: las suites Playwright (`pnpm --filter @nova/web test:e2e:ui`), porque requieren
Postgres 17 + Redis y datos de seed. El valor por defecto sigue siendo `es`, así que sus aserciones de texto
no cambian; la vista previa del chrome en portugués no se revisó en navegador, sólo por servidor y `curl`.

## 6. Criterios de aceptación de la ficha

| Criterio                                                            | Estado               | Evidencia                                                                                               |
| ------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------- |
| Capa de i18n con `pt-BR` y `es` preparados                          | `IMPLEMENTADO`       | `apps/web/src/lib/i18n/*`; `tsc` obliga a traducir toda clave                                           |
| `pt-BR` prioritario para recepción                                  | `PARCIAL`            | Diccionario completo para lo migrado; activable por cookie                                              |
| Etiquetas de navegación, acciones y mensajes compartidos en `pt-BR` | `PROBADO`            | `app-shell`, `ActionDialog`, `ui`, login y offline por diccionario                                      |
| Estados, categorías y prioridades                                   | `PARCIAL`            | `recordStatusLabel(locale, status)` en `format.ts`; el resto de las etiquetas migra con cada pantalla   |
| Validaciones del cliente                                            | `PARCIAL`            | `validateRoomType` acepta `copy` + `labels` del diccionario; los demás validadores siguen en español    |
| Errores y mensajes del backend                                      | `PARCIAL`            | Se muestran tal cual (`CODE`/`message` de la API); el mapeo a `pt-BR` es parte 3                        |
| Sin mezclar idiomas en una pantalla                                 | `PROBADO` (migradas) | Las superficies migradas están 100% en diccionario                                                      |
| Enums y valores persistidos sin traducir                            | `PROBADO`            | Sólo se traduce la etiqueta; `types.ts` y DTOs intactos                                                 |
| Parser `pt-br-notes-v1` versionado                                  | `PROBADO`            | No se tocó                                                                                              |
| Prueba de idioma por rutas críticas                                 | `PARCIAL`            | `/login`, `/offline` y la pantalla piloto `/inventory/room-types` migradas; rutas de negocio pendientes |

## 7. Trabajo restante (partes 2–4)

1. **Parte 2 — etiquetas de dominio y validaciones.** Migrar `format.ts` (estados, housekeeping,
   categorías de consumos, prioridades, documentos, caja, cierres) a funciones dependientes del locale y
   `validation.ts` a mensajes por diccionario; ajustar `formatDateTime`/`formatMoney` a `INTL_LOCALE`.
2. **Parte 3 — pantallas de recepción.** `front-office` (2.249 líneas, incluye `check-in-wizard`),
   `reservations`, `folios` + `folios/[id]`, `cashier`, `guests`, `calendar`, `inventory/rooms`,
   `catalog` y los paneles de documentos/instrucciones/party. `inventory/room-types` ya está migrada
   y sirve de patrón (ver sección 9).
3. **Parte 4 — administración y cierre.** `dashboard`, `reports`, `imports`, `audit`, `admin`, `account`,
   `settings`, `pilot`, `health-status`; al terminar, `DEFAULT_LOCALE = 'pt-BR'` y actualización de las
   aserciones Playwright al texto portugués.
4. **Mapeo de errores de API** a `pt-BR` (hoy se muestran en inglés/español tal como llegan).

## 8. Limitaciones y decisiones abiertas

- Con `DEFAULT_LOCALE = 'es'`, activar `pt-BR` produce una vista previa con chrome portugués y pantallas
  aún en español: es QA, no entrega. La fase cierra con la migración completa y el cambio de defecto.
- `formatMoney`/`formatDateTime` siguen formateando con `es-AR` hasta la parte 2; `INTL_LOCALE` ya expone
  el locale correcto para ese cambio.
- No se agregó selector de idioma en la UI ni persistencia por usuario (decisión abierta en ADR-058).
- Glosario pendiente de validación con el hotel piloto: `UH` vs `Apartamento`, `Conta` vs `Folio`.
- No se tradujeron los nombres de roles que llegan de la API ni los mensajes de error del backend.

## 9. Parte 2 — pantalla piloto migrada (`/inventory/room-types`)

Primera ruta usable de punta a punta en `pt-BR`: no queda ningún literal en español en el archivo,
incluidas las validaciones y la etiqueta de estado, que vienen de otros módulos.

| Pieza                                     | Cambio                                                                                                                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app/(app)/inventory/room-types/page.tsx` | Todo el texto visible sale de `useI18n()`: header, filtros, contador (singular/plural), tabla, estados, modal de alta/edición, ayudas de campo, toasts y `ActionDialog` de deshabilitación |
| `lib/validation.ts`                       | `validateRoomType` acepta `copy` y `labels` opcionales; sin ellos devuelve exactamente el texto español anterior, así las demás pantallas no cambian y las reglas siguen en un solo lugar  |
| `lib/format.ts`                           | `RECORD_STATUS_LABELS` pasa a derivarse del diccionario `es` y se agrega `recordStatusLabel(locale, status)` para las pantallas migradas                                                   |
| `lib/i18n/es.ts` y `pt-BR.ts`             | 51 claves nuevas en paralelo por locale: `roomTypes.*`, `validation.*`, `status.record.*`, `common.cancel`/`common.save`                                                                   |

**Por qué esta pantalla:** es autocontenida (sin fechas ni importes), ya usa `ActionDialog` y cubre los
tres casos que la fase exige: etiquetas de enum, validaciones y confirmación crítica.

### Verificación de la parte 2

| Comando                                      | Resultado                                                                                                                                                     |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @nova/web typecheck`          | OK — ambos diccionarios tienen 130 claves, sin faltantes                                                                                                      |
| `pnpm --filter @nova/web lint`               | OK                                                                                                                                                            |
| `pnpm --filter @nova/web build`              | OK                                                                                                                                                            |
| `grep` de literales españoles en la pantalla | Sin resultados                                                                                                                                                |
| `ts-node` sobre `translate()`                | `pt-BR`: «Desabilitar “Suíte Master” (SUI)…», «A capacidade de adultos deve estar entre 1 e 50.», «3 tipos carregados», «UHs»; `es`: idéntico al texto previo |

**Textos de `es` sin cambios** (`Nuevo tipo`, `Guardar`, `El código debe tener 1–24…`, `Tipo de habitación creado`),
por lo que `apps/web/e2e/inventory-validation.spec.ts` sigue siendo válido sin editarlo.

**No ejecutado:** Playwright (requiere Postgres 17 + Redis, hoy apagados en esta máquina) y revisión en
navegador de la ruta autenticada en `pt-BR`. La verificación es de tipos, lint, build y diccionario; el
texto renderizado de la ruta no se vio en un navegador.

### Patrón para migrar la próxima pantalla

1. Agregar las claves a `es` y `pt-BR` en el mismo cambio (el tipado falla si falta una).
2. Reemplazar literales por `t('…')`; los plurales se resuelven con dos claves (`countOne`/`countOther`).
3. Si la pantalla usa un validador compartido, pasarle `copy`/`labels` como aquí en vez de duplicar reglas.
4. Si usa mapas de etiquetas de `format.ts`, sumar un helper `xxxLabel(locale, value)` y dejar el mapa
   español para las pantallas aún no migradas.

## 10. Metadata por ruta

El `<title>` de la pestaña dejó de ser fijo. `apps/web/src/lib/i18n/metadata.ts` expone
`segmentMetadata(titleKey)`, que devuelve el `generateMetadata` del segmento: resuelve el mismo cookie
`nova_locale` que la UI y traduce la clave. Se importa directo del módulo (nunca del barrel, que arrastra
el provider cliente y `next/headers`).

Como las páginas son componentes cliente, `generateMetadata` no puede vivir en el `page.tsx`. Next resuelve
la metadata por segmento, así que cada uno necesita su propio `layout.tsx`; no hay forma de declarar el
título de 18 rutas desde un único archivo parental. Lo que sí se eliminó es el cuerpo repetido: cada layout
son cuatro líneas, con `segmentMetadata(...)` como `generateMetadata` y el componente compartido
`components/route-shell.tsx` (`return children`) como default export.

```tsx
import RouteShell from '@/components/route-shell';
import { segmentMetadata } from '@/lib/i18n/metadata';

export const generateMetadata = segmentMetadata('app.metadata.audit');
export default RouteShell;
```

Claves `app.metadata.<pantalla>` en `es` y `pt-BR`.

| Ruta                    | `es`                           | `pt-BR`                       |
| ----------------------- | ------------------------------ | ----------------------------- |
| `/dashboard`            | Panel — NOVA PMS               | Painel — NOVA PMS             |
| `/reservations`         | Reservas — NOVA PMS            | Reservas — NOVA PMS           |
| `/cashier`              | Caja y cierre — NOVA PMS       | Caixa e fechamento — NOVA PMS |
| `/guests`               | Huéspedes — NOVA PMS           | Hóspedes — NOVA PMS           |
| `/front-office`         | Front Office — NOVA PMS        | Front Office — NOVA PMS       |
| `/folios`               | Folios — NOVA PMS              | Contas — NOVA PMS             |
| `/inventory/rooms`      | Habitaciones — NOVA PMS        | UHs — NOVA PMS                |
| `/inventory/room-types` | Tipos de habitación — NOVA PMS | Tipos de UH — NOVA PMS        |
| `/catalog`              | Catálogo — NOVA PMS            | Catálogo — NOVA PMS           |
| `/audit`                | Auditoría — NOVA PMS           | Auditoria — NOVA PMS          |
| `/settings`             | Propiedad — NOVA PMS           | Propriedade — NOVA PMS        |
| `/calendar`             | Calendario — NOVA PMS          | Calendário — NOVA PMS         |
| `/reports`              | Reportes — NOVA PMS            | Relatórios — NOVA PMS         |
| `/imports`              | Importaciones — NOVA PMS       | Importações — NOVA PMS        |
| `/pilot`                | Piloto — NOVA PMS              | Piloto — NOVA PMS             |
| `/admin`                | Administración — NOVA PMS      | Administração — NOVA PMS      |
| `/account`              | Mi cuenta — NOVA PMS           | Minha conta — NOVA PMS        |
| `/folios/[id]`          | Detalle de folio — NOVA PMS    | Detalhe da conta — NOVA PMS   |

Verificado con el build servido y `curl`: las 18 rutas devuelven 200 y el `<title>` correcto en ambos
idiomas. Los títulos siguen las etiquetas de navegación existentes, así la pestaña coincide con la barra
lateral. Ninguna ruta de la aplicación muestra ya el título raíz `NOVA PMS` como título de pestaña,
salvo el detalle de folio, que usa un título genérico porque el número de folio no está disponible en el
`layout` del segmento dinámico sin una consulta adicional.

## 11. Parte 3 — pantalla `/reservations` migrada

Ruta completa en diccionario: listado, filtros, alta/edición de reserva, alta y edición de huésped,
diálogo de cancelación, drawer de detalle, historial y los tres paneles que éste renderiza
(`ReservationParty`, `ReservationInstructions`, `ReservationDocuments`).

### Qué se migró

| Superficie                       | Claves                                                                                                                                                      |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/reservations` (página)         | `reservations.*` (listado, filtros, alta/edición, detalle, toasts, acciones del historial, mensajes de validación de la pantalla)                           |
| Panel de huéspedes de la reserva | `party.*` (roles, edad, FNRH, supervisión, errores del alta de menor, comodidad del modal)                                                                  |
| Panel de notas e instrucciones   | `instructions.*` + `instruction.*` (categoría, prioridad, estado, acción, momento, visibilidad, eventos)                                                    |
| Panel de documentos              | `documents.*` + `document.*` (`type`, `status`)                                                                                                             |
| Validaciones compartidas         | `validation.*` (plantillas nuevas: `minLength`, `date`, `dateOrder`, `nights`, `code`, `emailRequired`, `emailInvalid`, `phoneInvalid`, etiquetas de campo) |
| Etiquetas de estado              | `reservation.status.*`, `documentType.*`, `document.type.*`, `document.status.*`, `instruction.*`                                                           |

Las reglas de validación no se duplicaron: `calendarDateField`, `dateRangeField`, `intField`,
`optionalText`, `reservationCodeField`, `reasonField`, `validateGuest` y `requiredText` aceptan un `copy`
opcional y devuelven el texto histórico en español cuando se omite (ADR-059). Las etiquetas de enums
usan helpers de `format.ts` por `locale`, y los mapas `*_LABEL_ES` que quedan en español se derivan de
`translate('es', …)` para que no existan dos fuentes.

### Compatibilidad del texto en español

El texto de `es` se mantiene salvo dos mejoras deliberadas: el contador del listado usa singular para 1
(`1 reserva cargada`) y el resumen de cancelación usa comillas tipográficas “ ”, iguales a las del
resto de la UI. Ninguna suite e2e afirma esos textos (`inventory-validation.spec.ts` sólo usa
`Nueva reserva`, intacto).

### Verificación de la parte 3

| Comprobación                        | Resultado                                                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @nova/web typecheck` | OK                                                                                                                              |
| `pnpm --filter @nova/web lint`      | OK, sin warnings                                                                                                                |
| `pnpm test`                         | 20 suites / 115 tests OK                                                                                                        |
| `pnpm --filter @nova/web build`     | ✓ Compiled successfully                                                                                                         |
| Paridad de diccionarios             | 537 claves en `es` y 537 en `pt-BR`                                                                                             |
| Barrido de literales                | sin nodos de texto ni atributos en español en la página y en los tres paneles                                                   |
| `translate()` puntual               | interpolación correcta en `pt-BR` y `es` para `reservations.*`, `validation.nights`, `party.*`, `instructions.*`, `documents.*` |

**No ejecutado:** Playwright y render autenticado de la ruta (Postgres 17 + Redis apagados en esta
máquina). La verificación es de tipos, lint, tests, build y ejecución directa del diccionario; la
pantalla no se vio en un navegador.

### Plurales de ocupación

La ocupación se compone con claves `One`/`Other` en vez de una plantilla única:
`reservations.adultsOne/Other`, `reservations.childrenOne/Other`, `party.summary.adultsOne/Other` y
`party.summary.minorsOne/Other`. `reservations.detail.occupancyValue` y `party.summary.declared` pasan a
ser plantillas de unión (`{adults} · {children}`), así `1 menor` / `1 criança` no arrastran el plural.

| Caso                 | `es`                                               | `pt-BR`                  |
| -------------------- | -------------------------------------------------- | ------------------------ |
| 2 adultos, 2 menores | `2 adultos · 2 menores` (idéntico al texto previo) | `2 adultos · 2 crianças` |
| 2 adultos, 1 menor   | `2 adultos · 1 menor`                              | `2 adultos · 1 criança`  |
| 1 adulto, 1 menor    | `1 adulto · 1 menor`                               | `1 adulto · 1 criança`   |

La fila del listado, la línea de ocupación del detalle y la línea «declarado» del panel de huéspedes
comparten esas claves, de modo que no quedan tres criterios distintos para el mismo dato.

## 12. Parte 4 — Front Office completo

`/front-office` era la pantalla más densa pendiente: cinco pestañas (llegadas, huéspedes en casa, salidas,
room rack, incidencias), búsqueda operativa, y cinco modales de operación (check-out, cambio de habitación,
no-show, alta de incidencia, resolución). Se migraron la página y el `CheckInWizard` que abre desde ella,
porque el check-in guiado es parte del flujo de la ruta.

### Etiquetas compartidas

Los mapas de `lib/format.ts` eran español fijo. Se conservaron para las pantallas que aún no migraron y se
agregaron helpers con locale, alimentados por claves nuevas:

| Helper                    | Claves                                                  |
| ------------------------- | ------------------------------------------------------- |
| `housekeepingLabel`       | `housekeeping.dirty/cleaning/clean/inspected`           |
| `roomOperationalLabel`    | `operational.available/outOfOrder/outOfService`         |
| `occupancyLabel`          | `room.occupancy.vacant/occupied`                        |
| `incidentTypeLabel`       | `incident.type.note/maintenance/complaint/safety/other` |
| `incidentStatusLabel`     | `incident.status.open/resolved`                         |
| `incidentSeverityLabel`   | `incident.severity.low/medium/high`                     |
| `checkInBlockReasonLabel` | `checkIn.blockReason.*`                                 |

También se reutilizaron los helpers de instrucciones de la parte 3 y `reservationStatusLabel`.

### Detalles de la migración

- Los mensajes de conflicto del cambio de habitación (`room_occupied`, `room_block_overlap`, …) son ahora
  claves `frontOffice.move.error.*`; la tabla de bloqueos por candidato usa `frontOffice.move.blocker.*`.
- Los plurales de ocupación y noches se resuelven con `common.adultsOne/Other`,
  `common.minorsOne/Other` y `common.nightsOne/Other`, sin plantillas que arrastren el singular.
- Los `<option>` de estado, tipo y severidad se generan recorriendo las claves de los mapas de color, así
  el orden no se duplica en un arreglo aparte.
- El estado de la fiesta en el resumen del wizard se muestra como código del backend (`OK`/`BLOCKED`), no
  como texto: no hay traducción posible sin una tabla de significados que el contrato aún no expone.

### Verificación de la parte 4

| Comprobación                        | Resultado                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------------ |
| `pnpm --filter @nova/web typecheck` | OK                                                                                         |
| `pnpm --filter @nova/web lint`      | OK, sin warnings                                                                           |
| `pnpm test`                         | 20 suites / 115 tests OK                                                                   |
| `pnpm --filter @nova/web build`     | ✓ Compiled successfully                                                                    |
| Paridad de diccionarios             | 862 claves en `es` y 862 en `pt-BR`; 0 faltantes, 0 sobrantes, 0 problemas de placeholders |
| Claves nuevas de esta parte         | 309: 284 de `frontOffice.*`/`checkIn.*` y 25 de etiquetas compartidas, plurales y fecha    |
| Barrido de literales                | sin nodos de texto ni atributos en español en la página ni en el wizard                    |

**No ejecutado:** Playwright y render autenticado (Postgres 17 y Redis apagados, `docker compose` no
disponible). No se vio la pantalla en un navegador: la verificación es de tipos, lint, tests, build,
paridad de diccionarios y barrido de literales.
