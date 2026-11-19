# Fase 4 — Caixa, consumos y checkout

**Fecha:** 2026-11-17
**Ficha:** `docs/v4/NOVA_PMS_FICHA_04_OPENCODE_TECHNICAL.md`, sección «Fase 4 — Caixa, consumos y checkout».
**Estado:** ejecutada. Backend, migración, UI, pruebas y documentación en el mismo cambio.
**Rama:** `main`.

---

## 1. Resumen

Caixa deja de ser sólo cargos manuales. La propiedad tiene ahora un catálogo de consumos
(`FolioProduct`) con SKU, categoría, unidad y precio decimal; recepción carga consumos desde el
folio y el backend resuelve el precio en PostgreSQL en lugar de aceptar el importe del cliente.
Cada línea de folio guarda el precio aplicado (`unitAmount`, `unit`, `quantity`, `source`), por lo
que editar el catálogo nunca reescribe una cuenta emitida.

El checkout dejó de ser una acción aislada sobre la estancia: `POST /front-office/stays/:id/check-out`
cierra las cuentas activas, marca la estancia y la reserva como `CHECKED_OUT`, pasa la habitación a
`DIRTY` y audita cada paso **dentro de una sola transacción**. Si el cierre de cuenta falla, la
habitación no se libera. Un nuevo `GET /front-office/stays/:id/checkout-readiness` permite revisar
cuenta, saldo y housekeeping antes de confirmar.

No se creó un endpoint paralelo de caja: se extendieron `POST /folios/:id/charges`,
`POST /front-office/stays/:id/check-out` y `GET /folios`, que ya aplican tenant, permisos,
idempotencia y auditoría.

---

## 2. Existente / falta / se modifica

| Requisito de la ficha                   | Antes                                                                            | Ahora                                                                                                                            |
| --------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Catálogo de productos/servicios         | No existía                                                                       | `FolioProduct` por propiedad + `GET/POST/PATCH /products` + pantalla `/catalog`                                                  |
| Consumo de habitación (minibar y otros) | Sólo cargo manual con texto y precio libres                                      | Cargo por `productId` + `quantity` con precio resuelto en servidor y snapshot en la línea                                        |
| Cargo manual autorizado                 | Existía                                                                          | Se conserva; exige `description` + `amount` y admite `source`                                                                    |
| Origen del cargo                        | No se registraba                                                                 | `FolioLine.source` (`MANUAL`, `MINIBAR`, `FRONT_DESK`, `PARKING`, `SERVICE`, `INTEGRATION`) derivado de la categoría o explícito |
| Snapshot de precio                      | No aplicaba                                                                      | `unitAmount`, `unit`, `quantity`, `description` guardados en la línea                                                            |
| Void con motivo y auditoría             | Existía                                                                          | Se conserva (sin cambios de contrato)                                                                                            |
| Búsqueda de Caixa por UH                | Sólo número de folio, código de reserva y huésped                                | Se agrega UH por `stay.room.number` y `reservation.room.number`                                                                  |
| UI de cuenta (cargos, pagos, saldo)     | Existía                                                                          | Se agrega consumo desde catálogo y detalle `cantidad × precio · origen` por línea                                                |
| Checkout coordinado                     | Marcaba estancia/reserva y liberaba habitación; no tocaba cuenta ni housekeeping | Cierra cuentas + estancia + housekeeping en una transacción, con revisión previa                                                 |
| Falla de cierre no libera habitación    | No estaba garantizado (el checkout no intentaba cerrar la cuenta)                | Garantizado por transacción única; cubierto por E2E                                                                              |
| Política de saldo pendiente             | Inexistente                                                                      | Default reversible: bloquea; excepción explícita por operación con motivo auditado (ADR-055)                                     |

---

## 3. Modelo y migración

`prisma/migrations/20261117120000_phase4_catalog_consumptions/migration.sql` — aditiva y reversible:

- `enum FolioProductCategory` (`MINIBAR`, `FOOD_BEVERAGE`, `PARKING`, `LAUNDRY`, `SERVICE`, `OTHER`).
- `enum FolioLineSource` (`MANUAL`, `MINIBAR`, `FRONT_DESK`, `PARKING`, `SERVICE`, `INTEGRATION`).
- Tabla `FolioProduct`: `sku` único por propiedad, nombre, descripción opcional, categoría, unidad,
  `unitAmount DECIMAL(10,2)`, `currencyCode`, `isActive`, autor de creación/edición, timestamps,
  FK a `Organization`/`Property`/`User` y dos índices de consulta.
- `FolioLine`: `productId` (FK opcional), `quantity DECIMAL(10,2) DEFAULT 1`, `unitAmount`, `unit`,
  `source DEFAULT 'MANUAL'`. Todas las columnas tienen default, así que las filas existentes quedan
  como cargos manuales con cantidad 1.

No hay campos de stock ni fiscales: crear cualquiera de ellos requiere un módulo separado con
requisitos confirmados (ADR-054).

---

## 4. API

| Método | Ruta                                                | Permiso                                                   | Notas                                                                                    |
| ------ | --------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| GET    | `/api/v1/products`                                  | `folio.read`                                              | Filtros `search`, `category`, `isActive`                                                 |
| POST   | `/api/v1/products`                                  | `folio.manage`                                            | SKU único por propiedad (`409 product_sku_exists`); moneda = moneda de la propiedad      |
| PATCH  | `/api/v1/products/:id`                              | `folio.manage`                                            | Precio, nombre, categoría, unidad, `isActive`; SKU inmutable; audita sólo cambios reales |
| POST   | `/api/v1/folios/:id/charges`                        | `folio.manage`                                            | `productId`+`quantity` **o** `description`+`amount`                                      |
| GET    | `/api/v1/front-office/stays/:id/checkout-readiness` | `front_office.read` + `folio.read`                        | Resumen de cuentas, saldo, housekeeping objetivo y advertencias                          |
| POST   | `/api/v1/front-office/stays/:id/check-out`          | `front_office.manage` (+`folio.manage` si cierra cuentas) | Transaccional; añade `checkout` a la respuesta                                           |

Reglas financieras aplicadas:

- Importe de consumo = `unitAmount × quantity`, `HALF_UP` a 2 decimales; un `amount` del cliente se
  ignora en modo catálogo.
- Moneda explícita: producto y folio deben coincidir (`400 currency_mismatch`).
- Producto inactivo `409 product_inactive`; producto de otra propiedad `404 product_not_found`.
- Un cargo sin `productId` exige `description` y `amount` (`400 charge_payload_required`).
- La regla de saldo vive en `apps/api/src/folio/folio-totals.ts` y la comparten folio y checkout.
- Idempotencia por `idempotencyKey` conservada, incluyendo producto y cantidad en la comparación de replay.

---

## 5. UI

- `/catalog` — «Catálogo de consumos»: filtros por texto, categoría y estado; alta/edición en modal;
  activar/desactivar; muestra precio, unidad y última actualización. Entrada de menú en Operación.
- `/folios/[id]` — nuevo formulario «Registrar consumo» (producto activo + cantidad, con precio
  vigente visible) antes del cargo manual; cada línea muestra `origen · cantidad × precio unitario`.
- `/front-office` — el modal de check-out consulta `checkout-readiness` y muestra cargos, pagos,
  saldo, housekeeping actual → objetivo y advertencias. Si hay saldo, ofrece la autorización
  explícita con motivo obligatorio; el backend vuelve a validarla.

Los textos nuevos están en español, igual que el resto de la aplicación actual; la traducción
transversal a `pt-BR` sigue en la Fase 7 de la ficha.

---

## 6. Pruebas

Nueva suite `apps/api/test/catalog-checkout.e2e-spec.ts` (8 casos):

1. Alta de catálogo, SKU duplicado, moneda distinta, permiso denegado a housekeeping y aislamiento por propiedad/organización.
2. Edición de precio, desactivación, SKU inmutable y `404` al editar desde otra propiedad.
3. Reserva + check-in con habitación limpia dedicada y apertura de folio.
4. Consumo con snapshot (`3 × 8.00 = 24.00`), `amount` del cliente ignorado, replay idempotente.
5. Rechazo de producto inactivo, producto de otra propiedad y cargo sin payload; cargo manual con `source`.
6. `checkout-readiness` con totales, advertencia de saldo y housekeeping objetivo; `403` sin `folio.read`.
7. Checkout rechazado por saldo: estancia sigue `IN_HOUSE`, habitación sigue `CLEAN`, folio sigue `OPEN`;
   `allowOutstandingBalance` sin motivo responde `400 balance_reason_required`.
8. Checkout con autorización: folio `SETTLED` con `closedAt`, habitación `DIRTY` con historial de
   housekeeping, reserva `CHECKED_OUT`, auditoría `folio.closed_at_checkout` con motivo y replay idempotente
   sin duplicar auditoría.

### Comandos ejecutados

| Comando                                                 | Resultado                                                                |
| ------------------------------------------------------- | ------------------------------------------------------------------------ |
| `pnpm exec prisma format` + `pnpm exec prisma generate` | OK                                                                       |
| `pnpm exec prisma migrate deploy`                       | OK — 19 migraciones, aplica `20261117120000_phase4_catalog_consumptions` |
| `pnpm --filter @nova/api typecheck`                     | OK                                                                       |
| `pnpm --filter @nova/api lint`                          | OK                                                                       |
| `pnpm --filter @nova/api test`                          | 20 suites / 115 tests OK                                                 |
| `pnpm test:e2e:isolated`                                | 17 suites / 152 tests OK (schema temporal creado y eliminado)            |
| `pnpm --filter @nova/web typecheck`                     | OK                                                                       |
| `pnpm --filter @nova/web lint`                          | OK                                                                       |

No se ejecutó `pnpm build` completo, la suite Playwright de navegador ni capturas: no hubo
verificación visual de las pantallas nuevas (ver limitaciones).

---

## 7. Estado de aceptación (Fase 4)

| Criterio de la ficha                                   | Estado        | Evidencia                                                     |
| ------------------------------------------------------ | ------------- | ------------------------------------------------------------- |
| Crear/administrar catálogo inicial                     | `PROBADO`     | `/products`, `/catalog`, E2E 1–2                              |
| Registrar consumos y verlos en el folio                | `PROBADO`     | E2E 4–5, formulario en `/folios/[id]`                         |
| Registrar pagos manuales con idempotencia y permisos   | `PROBADO`     | `folio.e2e-spec.ts` (existente) + `/folios/[id]`              |
| Calcular saldo correctamente                           | `PROBADO`     | `folio-totals.ts`, E2E de totales y readiness                 |
| Estornar con motivo y auditoría                        | `PROBADO`     | `folio.e2e-spec.ts` (sin cambios de contrato)                 |
| Checkout con pasos consistentes y errores recuperables | `PROBADO`     | E2E 7–8                                                       |
| Una falla de cierre no libera habitación               | `PROBADO`     | E2E 7 (estancia, habitación y folio sin cambios)              |
| Pruebas API/E2E                                        | `PROBADO`     | 17 suites / 152 tests                                         |
| Pruebas UI del flujo completo en navegador             | `NO INICIADO` | Requiere Playwright y servidores; no ejecutado en esta sesión |
| Evidencia visual (desktop/tablet/estados)              | `NO INICIADO` | Sin capturas                                                  |

---

## 8. Limitaciones y decisiones abiertas

- **Política de saldo al checkout**: el default bloquea; la excepción es por operación con motivo
  auditado, no configuración por propiedad. Si el piloto exige bloqueo absoluto o autorización por rol,
  se ajusta en `DECISIONS.md` (ADR-055).
- **Housekeeping tras la salida**: siempre `DIRTY` cuando cambia; no existe flujo de «salida sin limpieza».
- **Sin stock, recetas ni impuestos**: no se inventan reglas fiscales brasileñas ni control de inventario.
- **Precio cero**: no se admiten productos de cortesía; requieren cargo manual con importe válido.
- **Pagos**: sólo medios manuales; no hay tokenización, preautorización ni captura real. `referenceId`
  debe ser un identificador tokenizado, nunca PAN/CVV.
- **UI**: sin verificación en navegador ni capturas en esta sesión; textos en español (traducción
  transversal `pt-BR` pendiente de la Fase 7).
- **Catálogo**: los permisos se apoyan en `folio.read` / `folio.manage`; si el hotel necesita separar
  «quién define precios» de «quién cobra», hará falta un permiso propio.

---

## 9. Siguiente paso recomendado

Fase 5 (UX guiada de cambio de habitación) reutilizando `POST /front-office/stays/:id/room-move`,
que ya revalida tipo, bloqueo, ocupación y solapamiento dentro de la transacción. Antes de comenzar,
conviene definir con el piloto la política de saldo al checkout y el surtido real del catálogo.
