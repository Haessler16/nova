# Fase 0 — Cierre de riesgos y validación técnica

**Ficha de referencia:** `docs/v4/NOVA_PMS_FICHA_04_OPENCODE_TECHNICAL.md`
**Fecha de ejecución:** 2026-11-16
**Rama:** `main`
**Alcance ejecutado:** Fase 0 únicamente. No se modificaron lógica de disponibilidad, contratos públicos de la API ni persistencia.

## 1. Inspección del repositorio (línea base actual)

| Elemento citado en la ficha                         | Estado verificado                                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `apps/api/test/guests-reservations.e2e-spec.ts`     | Existe; la expectativa H-01 ya estaba corregida en `1a836bd`.                               |
| `apps/api/src/instructions/instruction-parser.ts`   | Existe; `redactSensitiveCardData` cubría PAN y CVV.                                         |
| `apps/api/src/instructions/instructions.service.ts` | Existe; única ruta que persiste `ReservationSourceNote`.                                    |
| `apps/api/test/instructions.e2e-spec.ts`            | Existe; cubría PAN/CVV y ausencia de side effects financieros.                              |
| `prisma/schema.prisma` → `ReservationSourceNote`    | Existe; `sourceTextOriginal`, `sourceTextHash`, `contentHash`, `parserVersion`, `redacted`. |
| PostgreSQL / Redis locales                          | Activos (`nova-postgres`, `nova-redis` healthy).                                            |
| Migraciones                                         | 16 migraciones aplican desde esquema vacío en la corrida aislada.                           |

### Matriz existente / falta / se modifica

| Requisito Fase 0                             | Existente                                   | Falta                                                    | Se modifica                                              |
| -------------------------------------------- | ------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------- |
| H-01 expectativa E2E de habitación bloqueada | Sí (ya corregida)                           | —                                                        | Nada (solo verificación)                                 |
| H-02/N-07 redacción de NSU/authcode          | PAN y CVV                                   | NSU, códigos de autorización y referencias de proveedor  | `instruction-parser.ts`                                  |
| Tests positivos/negativos de secretos        | PAN/CVV                                     | NSU/authcode/referencias y falsos positivos              | `instruction-parser.spec.ts`, `instructions.e2e-spec.ts` |
| Hash del texto fuente                        | `sourceTextHash` (SHA-256 del texto exacto) | Prueba de que el digest corresponde al texto con secreto | Unit test + E2E                                          |
| Redacción antes de persistir                 | `parseSource` guarda `parsed.originalText`  | Confirmación documentada de que no hay ruta alternativa  | Documentación                                            |
| Regresión sin pagos/cargos/preautorizaciones | Conteo de `Payment` y `Folio`               | Conteo de `FolioLine`                                    | `instructions.e2e-spec.ts`                               |

## 2. H-01 — Expectativa E2E desactualizada

El test ya afirmaba el comportamiento correcto antes de esta ejecución:

- `ROOM_DLX_201` (bloqueada con `OUT_OF_ORDER`) no aparece en disponibilidad;
- `ROOM_DLX_202` sí aparece porque el bloqueo es por habitación y no por tipo.

No se cambió lógica de disponibilidad ni el test. Se verificó con la suite aislada completa.

## 3. H-02/N-07 — NSU, códigos de autorización y referencias de proveedor

`redactSensitiveCardData` ahora redacta, además de PAN y CVV:

| Dato                    | Etiquetas reconocidas                                                                                                 | Placeholder               |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| NSU                     | `NSU`, `número sequencial`, `número sequencial único`                                                                 | `[NSU_REDACTED]`          |
| Código de autorización  | `AUT`, `auth`, `auth code`, `authorization code`, `código de autorização/autorización`, `autorização`, `autorización` | `[AUTH_CODE_REDACTED]`    |
| Referencia de proveedor | `TID`, `transaction id`, `id da transação`, `referência do pagamento/provedor/transação`                              | `[PROVIDER_REF_REDACTED]` |

Reglas aplicadas para evitar sobre-redacción:

- Solo se redacta un valor **etiquetado**; a diferencia del PAN, NSU/authcode no tienen checksum.
- El valor debe parecer un código de referencia (4–32 caracteres `[A-Za-z0-9._-]`, al menos 2 dígitos).
- La palabra aislada (`O NSU é obrigatório`, `a autorização deve ser obtida`) se conserva.
- Números de reserva y documentos sin etiqueta de pago no se redactan.
- El mensaje de advertencia del parser menciona cartão, CVV, NSU y código de autorização.

### Redacción antes de persistir

Verificado por búsqueda en el repositorio: `sourceTextOriginal` solo se escribe en
`InstructionsService.parseSource`, con `parsed.originalText`, que es el texto ya redactado.
Títulos y cuerpos de instrucciones, sugerencias confirmadas y notas de huésped también pasan
por `redactSensitiveCardData`. `sourceTextHash` conserva el SHA-256 del texto exacto recibido,
por lo que la trazabilidad no depende de guardar el secreto.

## 4. Pruebas añadidas

`apps/api/src/instructions/instruction-parser.spec.ts`

- Redacción de NSU, auth code (inglés), código de autorização/autorización y referencia de proveedor.
- Conservación de vocabulario de pago y de números no etiquetados (reserva, CPF).
- Digest del texto exacto distinto del digest del texto redactado.

`apps/api/test/instructions.e2e-spec.ts`

- `POST /source-notes/parse` con NSU/authcode/TID: no persiste los valores, sí los placeholders,
  y `sourceTextHash` coincide con el SHA-256 del texto crudo.
- Lectura directa en base de datos del registro persistido.
- Instrucción manual con NSU/authcode: el cuerpo guardado queda redactado.
- Regresión: el parseo no altera conteos de `Payment`, `Folio` ni `FolioLine`.

## 5. Comandos ejecutados y resultados

| Comando                                                                                                 | Resultado                      |
| ------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `pnpm --filter @nova/api typecheck`                                                                     | OK                             |
| `pnpm --filter @nova/api lint`                                                                          | OK                             |
| `pnpm --filter @nova/api exec jest --config jest.config.js src/instructions/instruction-parser.spec.ts` | 18/18 tests OK                 |
| `pnpm test:e2e:isolated`                                                                                | 15/15 suites, 126/126 tests OK |

La corrida aislada crea un schema temporal, aplica las 16 migraciones, ejecuta el seed sintético y
lo elimina al final. No se usaron datos reales ni se reseteó la base de desarrollo.

## 6. Estado de aceptación Fase 0

| Criterio                                       | Estado    | Evidencia                                       |
| ---------------------------------------------- | --------- | ----------------------------------------------- |
| Inspección actual y línea base                 | `PROBADO` | Sección 1                                       |
| E2E aislado sin suites rojas                   | `PROBADO` | 15/15 suites                                    |
| No se persiste NSU/authcode                    | `PROBADO` | E2E + lectura directa en BD                     |
| No se alteró disponibilidad para pasar el test | `PROBADO` | H-01 ya estaba corregido; sin cambios de lógica |
| Typecheck y lint verdes                        | `PROBADO` | Sección 5                                       |
| Regresión sin side effects financieros         | `PROBADO` | Conteos Payment/Folio/FolioLine                 |

## 7. Limitaciones

- Fase 0 no tiene UI nueva; no hay screenshots ni pruebas de navegador que aportar.
- No se ejecutó `pnpm build` completo (no requerido por la fase; typecheck de API y web no se ve afectado por este cambio).
- La redacción de NSU/authcode es determinista y basada en etiquetas: un valor sin etiqueta no se detecta. Es una limitación aceptada porque estos identificadores no tienen checksum y redactar todo número corto rompería notas legítimas.

## 8. Brecha verificada para Fase 1 (Front Desk)

| Pieza                                    | Estado actual                                                                                                                            |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/reservations`               | Soporta `search` (código y nombre del huésped), `status`, `fromDate`, `toDate`, `roomId`, `roomTypeId`, `guestId`, cursor y límite.      |
| Búsqueda por UH/número de habitación     | No existe filtro por número de UH (`roomNumber`); solo por `roomId`.                                                                     |
| Búsqueda en Front Desk                   | No hay buscador en `front-office/page.tsx`; la vista es un overview por tabs.                                                            |
| Check-in                                 | Existe acción con modal de confirmación y resumen de instrucciones, pero no un flujo guiado búsqueda → revisión → habitación → check-in. |
| Habitación limpia/disponible en check-in | El backend revalida al confirmar; falta exponer la elegibilidad y el estado de housekeeping en el flujo.                                 |

Ninguna decisión pendiente de la sección 16 de la ficha bloquea la Fase 1.

## 9. Siguiente paso recomendado

Ejecutar Fase 1 como cambio separado: buscador operativo en Front Desk (texto + fechas + estado,
conservado en query string) y flujo guiado de check-in, reutilizando `GET /reservations` y
extendiendo el contrato solo para búsqueda por número de UH.
