# FNRH Digital — Tareas de implementación derivadas del prototipo

- Estado: **implementación parcial verificada en base local autorizada; migración no aplicada en staging ni producción**.
- Fecha: 2026-11-16 (actualización de la corrida local).
- Origen: `prototypes/fnrh-party/index.html` y `prototypes/fnrh-party/README.md`.
- Diseño de referencia: `FNRH_GUEST_UI_FLOW.md`, `FNRH_GUEST_MODEL.md`, `FNRH_GUEST_MODEL_REVIEW.md` y `FNRH_INTEGRATION_PLAN.md`.
- Guía de validación con recepción y registro de hallazgos: `FNRH_PARTY_VALIDATION_SESSION.md`.
- Alcance: convertir los hallazgos validados con recepción en tareas ejecutables, con dependencias de producto y legal explícitas.
- Fuera de alcance: envío real a FNRH, adapter HTTP, credenciales, payloads oficiales y aprobaciones legales.

## 1. Hallazgos validados en el prototipo

| ID   | Hallazgo                                                                                                                                    | Evidencia en el prototipo                                                              | Consecuencia                                                                    |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| H-01 | La fiesta debe verse y editarse desde el detalle de la reserva, no desde el listado global de huéspedes.                                    | Tarjeta “Huéspedes de la reserva”, alta/edición/baja y dependencia indentada.          | La sección de detalle es el punto de entrada; no se crean placeholders.         |
| H-02 | Un adulto puede vincularse a una ficha existente o crearse en la misma reserva.                                                             | Pestañas “Huésped existente” / “Huésped nuevo” y búsqueda por documento.               | Evitar duplicados y reutilizar identidad sin inventar datos.                    |
| H-03 | Los menores se capturan como dependientes de un responsable adulto de la misma reserva.                                                     | Tarjeta “Menor”, responsable visible y supervisión obligatoria.                        | No tienen ficha FNRH propia ni acción de check-in FNRH individual.              |
| H-04 | “Sin autorización registrada” debe bloquear check-in y FNRH; “autorizado sin acompañante” exige referencia.                                 | Escenario rápido “Menor sin autorización” y edición con referencia de autorización.    | El bloqueo legal es distinto de una FNRH incompleta.                            |
| H-05 | La FNRH incompleta no debe impedir el check-in hotelero.                                                                                    | Check-in permitido con estado “FNRH pendiente”.                                        | El backend no puede usar “datos FNRH completos” como precondición del check-in. |
| H-06 | La edad se calcula al check-in y un menor puede convertirse en adulto al cumplir 18 antes de la llegada.                                    | Aviso “Al check-in tendrá 18 años” y acción “Convertir en adulto”.                     | La clasificación debe ser dinámica por fecha de llegada, no por edad actual.    |
| H-07 | La ocupación declarada (`adults`/`children`) no crea personas y puede no coincidir con la fiesta.                                           | Resumen “2 adultos · 1 menor” separado de las tarjetas reales; banner de discrepancia. | La fiesta es la fuente de personas; el conteo sólo es un snapshot operativo.    |
| H-08 | No se puede quitar al principal ni dejar dependientes sin responsable; el prototipo también deshabilita bajas posteriores al check-in/FNRH. | Botones “Quitar” deshabilitados y mensajes de dependencia.                             | La baja requiere reasignar dependientes y respetar estados posteriores.         |
| H-09 | El flujo debe ser operable en móvil, teclado y lector de pantalla.                                                                          | Layout responsive a 390 px, foco visible, `aria-live` y etiquetas textuales.           | La validación visual no reemplaza una prueba de accesibilidad real.             |
| H-10 | Datos sintéticos y estado en memoria son suficientes para validar interacción, no para producción.                                          | Banner “sin backend, sin migraciones y sin datos reales”; recarga reinicia la demo.    | Las pruebas de integración necesitan base migrada y datos sintéticos.           |

## 2. Puertas de decisión

Ninguna tarea que capture datos reales de menores, aplique la migración en producción o envíe datos a FNRH puede cerrarse sin estas puertas.

| Puerta | Responsable            | Qué debe aprobar                                                                                                                                              | Estado    |
| ------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| G-01   | Product owner          | Ratificar P-01 a P-06 de `FNRH_GUEST_MODEL_REVIEW.md`, incluido el alcance de la primera versión y el flujo de recepción.                                     | Pendiente |
| G-02   | DPO / Legal            | Aprobar L-01 a L-06: base legal, menores/incapaces, retención, autorizaciones, `cpf_solicitante` y controles de acceso.                                       | Pendiente |
| G-03   | Seguridad / Ingeniería | Aprobar acceso restringido, enmascaramiento, auditoría específica y retención del perfil FNRH y datos de menores.                                             | Pendiente |
| G-04   | Serpro / Integración   | Confirmar URL base, credencial por establecimiento, paginación, `cpf_solicitante`, documento de menores y contrato de homologación.                           | Pendiente |
| G-05   | Operaciones / Piloto   | Validar el flujo con recepción siguiendo `FNRH_PARTY_VALIDATION_SESSION.md`, incluyendo el caso de menor sin autorización y la corrección antes del check-in. | Pendiente |

## 3. Tareas

Las tareas `T-05` a `T-09` tienen una primera implementación en el repositorio. `T-05`, `T-06`, `T-07` y `T-08` fueron verificadas el 2026-11-16 contra la base local autorizada; no se aplicó la migración en staging ni producción, y `T-09` sigue parcial.

### 3.1 Habilitadores de producto y legal

| ID   | Tarea                                                                                                           | Depende de | Criterio de aceptación                                                                                     | Estado     |
| ---- | --------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------- | ---------- |
| T-01 | Ratificar las decisiones P-01 a P-06 y registrar la firma del product owner.                                    | —          | Matriz de firma de `FNRH_GUEST_MODEL_REVIEW.md` completa; no quedan decisiones de alcance abiertas.        | Pendiente  |
| T-02 | Cerrar L-01 a L-06 con DPO/legal, incluida la política de autorizaciones de menores y retención local.          | —          | Documento legal aprobado; tareas de captura y retención pueden implementarse sin supuestos.                | Bloqueante |
| T-03 | Aprobar controles de acceso y auditoría para `GuestFnrhProfile`, menores e incapaces.                           | T-02       | Permiso específico, alcance por rol, eventos de lectura/edición y enmascaramiento aprobados por seguridad. | Pendiente  |
| T-04 | Confirmar con Serpro el contrato de homologación y el tratamiento de `cpf_solicitante` y documentos de menores. | G-04       | Respuestas escritas sobre URL, credencial, paginación, documento de menores y usuario de integración.      | Bloqueante |

### 3.2 Persistencia y API

| ID   | Tarea                                                                                                               | Depende de       | Criterio de aceptación                                                                                         | Estado                                      |
| ---- | ------------------------------------------------------------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| T-05 | Aplicar la migración `20261115120000_phase10_reservation_party` en un entorno autorizado y verificar el backfill.   | T-01, T-02       | Migración aplicada; una fila `PRIMARY` por reserva; `ageGroup=UNKNOWN` en legacy; sin acompañantes inventados. | Aplicada y verificada en local (2026-11-16) |
| T-06 | Probar la API de fiesta: lectura, alta de adulto existente/nuevo, alta de menor, edición, baja, capacidad y tenant. | T-05             | E2E con datos sintéticos; cross-tenant y permisos denegados; auditoría append-only; sin PII en logs.           | E2E 8/8 en local (2026-11-16)               |
| T-07 | Bloquear el check-in sólo por códigos legales de la fiesta y mantener la FNRH como estado separado.                 | T-05, T-06       | Check-in con FNRH incompleta permitido; menor sin autorización rechazado; error tipado y auditable.            | Implementado; E2E 8/8 en local              |
| T-08 | Crear y mantener sincronizada la fila `PRIMARY` al crear o cambiar `Reservation.guestId`.                           | T-05             | Alta de reserva crea principal; cambio de huésped no duplica ni deja principal huérfano; colisión rechazada.   | Implementado; E2E 8/8 en local              |
| T-09 | Resolver el conteo declarado vs. fiesta sin crear huéspedes automáticamente.                                        | T-01, T-05       | Discrepancia visible; ningún placeholder; la política de edición de `adults`/`children` queda aprobada.        | Parcial: readiness implementado             |
| T-10 | Implementar la política de bajas después del check-in o de un envío FNRH.                                           | T-01, T-02, T-04 | Baja bloqueada o sujeta a flujo auditado; dependientes reasignados; no se promete corrección posterior libre.  | Pendiente                                   |

### 3.3 Experiencia de la reserva

| ID   | Tarea                                                                                         | Depende de | Criterio de aceptación                                                                                                 | Estado                            |
| ---- | --------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| T-11 | Integrar la sección “Huéspedes de la reserva” en el detalle real y conectarla a la API.       | T-05, T-06 | Alta/edición/baja visibles; estados loading/empty/error; principal destacado; menores indentados; permisos respetados. | Implementado; E2E UI 2/2 en local |
| T-12 | Implementar la conversión de menor a adulto al cumplir 18 al check-in.                        | T-11, T-06 | El formulario de adulto se abre para el menor convertido; al guardar se limpian supervisión y responsable; auditoría.  | Implementado; E2E UI 3/3 en local |
| T-13 | Implementar el checklist de llegada en Front Office con resumen de fiesta y advertencia FNRH. | T-11, T-01 | Recepción ve fiesta, bloqueo legal y FNRH pendiente sin confundir ambos estados; no hay envío FNRH.                    | Pendiente                         |
| T-14 | Verificar accesibilidad y responsive del flujo real.                                          | T-11       | Navegación por teclado, foco, lectores, contraste y ancho móvil; sin overflow; probado por una persona.                | Pendiente                         |
| T-15 | Definir y probar el comportamiento de huéspedes legacy sin `birthDate` o sin fila de fiesta.  | T-05, T-06 | Legacy puede hacer check-in; FNRH queda incompleta; no se inventa edad ni documento; se muestra tarea de corrección.   | Parcial: readiness y backfill     |

### 3.4 Integración FNRH (fuera de esta implementación)

| ID   | Tarea                                                                              | Depende de             | Criterio de aceptación                                                                                              | Estado     |
| ---- | ---------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------- |
| T-16 | Implementar el adapter aislado y el ledger de operaciones FNRH.                    | T-02, T-03, T-04, T-01 | Contrato confirmado, credenciales fuera del código, reintentos/reconciliación, errores tipados y pruebas con mocks. | Bloqueante |
| T-17 | Ejecutar homologación con datos sintéticos y aceptar el lote completo.             | T-16, T-06             | Lote completo o fallo completo; sin envío parcial silencioso; conciliación y evidencia de auditoría.                | Bloqueante |
| T-18 | Implementar retención, anonimización y borrado del perfil FNRH y datos de menores. | T-02, T-03             | Jobs y procedimientos aprobados; evidencia de borrado; derechos del titular atendibles.                             | Bloqueante |

### 3.5 Dependencias por área

| Área                 | Dependencia cerrada                                                                  | Tareas que desbloquea  |
| -------------------- | ------------------------------------------------------------------------------------ | ---------------------- |
| Producto             | P-01 a P-06 ratificadas por el product owner; alcance de la primera versión acordado | T-05, T-09, T-10, T-13 |
| Legal / DPO          | L-01 a L-06 aprobadas; retención y autorizaciones de menores definidas               | T-05, T-10, T-18       |
| Seguridad            | Acceso, enmascaramiento, auditoría y retención aprobados                             | T-06, T-10, T-16, T-18 |
| Serpro / Integración | URL, credencial, paginación y `cpf_solicitante` confirmados                          | T-04, T-16, T-17       |
| Operaciones / Piloto | Flujo validado con recepción y corrección antes del check-in                         | T-13, T-14             |

### 3.6 Ejecución de las pruebas E2E de fiesta (API y UI)

El archivo `apps/api/test/reservation-party.e2e-spec.ts` contiene los casos de T-06, T-07 y T-08. Requiere una base local/staging con la migración `20261115120000_phase10_reservation_party` aplicada y el seed sintético cargado.

```bash
pnpm --filter @nova/api test:e2e -- reservation-party.e2e-spec.ts
```

El suite falla de forma explícita si faltan `ReservationGuest` o `GuestFnrhProfile`; no aplica la migración ni usa datos reales. No ejecutarlo contra una base compartida sin autorización. Crea un huésped sintético nuevo por reserva para no contaminar el huésped demo y no hace limpieza automática.

El archivo `apps/web/e2e/reservation-party.spec.ts` contiene las pruebas de UI de T-11 y del alta de menores. Playwright inicia sesión como recepción, crea una reserva sintética por API y recorre el detalle real: alta de adulto, alta de menor con responsable y supervisión, y bloqueo legal al marcar un menor sin autorización. No usa datos reales ni crea menores en el seed.

Precondiciones: API y web levantados; migración aplicada; seed sintético cargado. El test no arranca servidores ni aplica migraciones.

```bash
pnpm --filter @nova/web exec playwright install chromium   # una sola vez
PLAYWRIGHT_BASE_URL=http://localhost:3000 PLAYWRIGHT_API_URL=http://localhost:3001 \
  pnpm --filter @nova/web test:e2e:ui
```

El test cubre tanto `AUTH_MODE=local-session` como `dev-header`; se omite con `AUTH_MODE=disabled`. Deja la reserva sintética creada para inspección y no hace limpieza automática.

### 3.7 Resultado de la corrida local (2026-11-16)

Base local PostgreSQL autorizada, `AUTH_MODE=dev-header`, datos sintéticos. No se ejecutó reset ni se borraron datos; no se aplicó la migración en staging ni producción.

- `pnpm prisma migrate status`: esquema al día, 16 migraciones aplicadas.
- `ReservationGuest` y `GuestFnrhProfile` existen; antes de las corridas había 14 reservas, cada una con su fila `PRIMARY`.
- API E2E `apps/api/test/reservation-party.e2e-spec.ts`: **8/8 pasan**. Cubre alta de adulto existente y nuevo, menor con responsable y supervisión, duplicados, capacidad, bloqueo/desbloqueo legal del check-in, FNRH incompleta, sincronización del principal, permisos y tenant. El caso de conversión mueve la fecha de llegada al cumpleaños 18, verifica que el huésped queda `ADULT` sin supervisión ni responsable y comprueba el `AuditEvent` `reservation.guest_updated` con el actor y los metadatos del huésped.
- Unit tests `reservation-dates.spec.ts`: **6/6 pasan**, incluido el guard de reserva pasada con la fecha calendario de la propiedad.
- UI E2E `apps/web/e2e/reservation-party.spec.ts`: **3/3 pasan**. Detalle real, alta de adulto + menor con bloqueo legal visible, y conversión de menor a adulto al cumplir 18. La conversión se prueba moviendo la fecha de llegada más allá del cumpleaños: la UI abre el editor de adulto, guarda sin responsable ni supervisión y la API confirma `ageGroup=ADULT` con ambos campos en `null`. No se ejecuta el POST de check-in porque la fecha de llegada es futura; se valida la clasificación a la fecha de check-in.
- Typecheck y lint de API y web, y Prettier sobre los archivos tocados: pasan.

Correcciones de producto encontradas por las pruebas (no cambios en los tests):

- El guard de “reserva en el pasado” usa la fecha calendario en la timezone de la propiedad, no UTC.
- Al agregar o editar un menor, el snapshot en memoria del huésped incluye el perfil FNRH recién guardado; antes provocaba un falso `party_exceeds_room_capacity`.
- Email, teléfono y documento vacíos se normalizan a `null`; evita la violación del índice único de email y el `null.trim()` al limpiar un documento.
- El bloque de búsqueda de huésped y el mensaje de error de la UI quedaron dentro de un contexto de formulario válido.

Limitaciones: no se ejecutó el POST de check-in en el E2E de conversión (la llegada es futura y sólo se valida la clasificación a esa fecha); no se probaron accesibilidad ni responsive (T-14); los E2E dejan reservas y habitaciones sintéticas; no se verificó staging ni producción; el envío FNRH real sigue fuera de alcance.

## 4. Orden de ejecución recomendado

1. **T-01, T-02 y T-03** en paralelo: producto ratifica alcance; legal/DPO y seguridad definen qué datos pueden capturarse y cómo.
2. **T-04** con Serpro, sin bloquear la captura interna ni el check-in hotelero.
3. **T-05 y T-06** en un entorno autorizado con datos sintéticos; aplicar la migración sólo después de las aprobaciones.
4. **T-07, T-08, T-11 y T-12**: cerrar la integración interna y sus pruebas.
5. **T-09, T-10, T-13, T-14 y T-15**: completar reglas de conteo, bajas, Front Office y accesibilidad.
6. **T-16 a T-18**: sólo después de G-02, G-03 y G-04; el envío real no forma parte de la primera entrega.

## 5. Criterio de cierre de la primera entrega

La primera entrega interna puede cerrarse cuando:

- la migración está aplicada en un entorno autorizado y el backfill quedó verificado;
- la API y la UI pasan typecheck, lint, build y pruebas de integración con datos sintéticos;
- el check-in hotelero se bloquea sólo por el bloqueo legal de menores;
- la FNRH permanece explícitamente pendiente y no se envía nada;
- las limitaciones de producto, legales y de Serpro están registradas y no se presentan como resueltas.
