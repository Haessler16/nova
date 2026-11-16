# NOVA PMS — FICHA 04
## Especificación técnica de brechas operativas, UX y plan de ejecución para OpenCode

**Documento:** `NOVA_PMS_FICHA_04_OPENCODE_TECHNICAL.md`  
**Versión:** 2.0 — derivada de la auditoría del 2026-11-15  
**Idioma del documento:** español  
**Idioma operativo prioritario del producto:** portugués brasileño (`pt-BR`)  
**Tipo:** especificación ejecutable para ingeniería  
**Estado:** lista para planificación e implementación incremental, sujeta a inspección del repositorio actual antes de cada cambio.

---

# 0. Instrucciones obligatorias para OpenCode

Actúa como ingeniero senior responsable de continuar NOVA PMS. Esta ficha se debe ejecutar sobre el repositorio existente, no como un proyecto nuevo.

## 0.1 Reglas de trabajo

1. **Inspecciona el repositorio antes de editar.** Confirma que los archivos, rutas, modelos, endpoints y migraciones citados en esta ficha siguen existiendo. La auditoría de 2026-11-15 es una línea base, no garantía de que el repositorio no haya cambiado.
2. No reconstruyas módulos que ya funcionan. Amplía los existentes y conserva sus contratos salvo que exista una razón técnica documentada.
3. No sustituyas persistencia/API real por mocks, fixtures o datos hardcodeados en rutas productivas.
4. No marques una tarea como terminada porque exista una pantalla. Debe cumplir persistencia, permisos, validación, errores, auditoría y pruebas acordes al riesgo.
5. No debilites constraints, transacciones, aislamiento multi-tenant ni reglas financieras para facilitar la UI.
6. No realices reset destructivo de bases de datos ni elimines datos locales.
7. Cada migración debe ser aditiva y reversible cuando sea técnicamente posible. Documenta cualquier excepción.
8. Mantén `pnpm typecheck` y `pnpm lint` verdes. Ejecuta las suites API/E2E relevantes y la suite aislada.
9. No inventes contratos de proveedores externos, FNRH, PIX, NFS-e, OTA o pasarelas. Implementa adapters solo después de confirmar documentación, credenciales y alcance.
10. Divide el trabajo en fases pequeñas. Al final de cada fase entrega resumen, archivos cambiados, migraciones, endpoints, pruebas ejecutadas, resultado y riesgos.
11. Si una decisión requiere política del hotel (por ejemplo, si un saldo pendiente impide check-in), deja una configuración/decisión explícita y no inventes una regla universal.
12. No empieces una fase si una dependencia crítica de la fase anterior está rota.

## 0.2 Proceso obligatorio por fase

Antes de cada fase:
- inspeccionar los módulos afectados;
- identificar componentes y servicios reutilizables;
- actualizar una matriz `existente / falta / se modifica`;
- proponer cambios de modelo/API/UI;
- señalar riesgos de compatibilidad y seguridad.

Después:
- implementar;
- añadir/actualizar pruebas;
- ejecutar typecheck, lint y pruebas focalizadas;
- ejecutar pruebas E2E aisladas relevantes;
- revisar diff para detectar cambios ajenos al alcance;
- actualizar documentación y estado de aceptación.

**No hacer un rediseño global ni refactor transversal como parte incidental de estas tareas.**

---

# 1. Contexto del producto y línea base auditada

NOVA PMS es un PMS hotelero modular. La implementación existente incluye API y aplicación web conectadas a backend real. La auditoría `AUDIT_2026-11-15.md` revisó 52 requisitos:

| Estado de auditoría | Cantidad |
|---|---:|
| `PROBADO` | 28 |
| `IMPLEMENTADO` | 6 |
| `PARCIAL` | 12 |
| `NO INICIADO` | 6 |

Pruebas ejecutadas en esa auditoría:
- API: 17 suites / 89 tests OK.
- `pnpm typecheck`: OK en API y web.
- `pnpm lint`: OK en API y web.
- E2E aislado de instrucciones: 12/12 OK.
- E2E aislado ampliado: 110/111 tests OK, 13/14 suites. El fallo H-01 corresponde a una expectativa de test desactualizada.
- No se generaron screenshots ni se probó navegador real, tablet, impresora, dos terminales físicas o red hotelera real.
- No se ejecutó `pnpm build` en esa auditoría.

## 1.1 Base existente que se debe preservar

Según la auditoría:
- Multi-tenancy y contexto de organización/propiedad.
- Autenticación, RBAC y permisos backend.
- Auditoría append-only.
- Constraints y transacciones para evitar solapamientos y asignaciones duplicadas.
- Front Office con overview, llegadas, estancias y room rack.
- Búsqueda de huéspedes y reservas en sus respectivas pantallas.
- Check-in, checkout/movimiento de habitación en backend.
- Estados separados de ocupación, housekeeping y estado operativo.
- Folios/caja: cargos, pagos manuales, saldos, voids/cancelaciones y cierre del día operativo.
- Notes & Instructions con parser `pt-br-notes-v1`, confirmación humana y eventos.
- Documentos PDF, reportes y exportaciones.
- Importación CSV con preview y confirmación.
- Service worker limitado a shell/estáticos; las escrituras offline están bloqueadas.

## 1.2 Hallazgos de auditoría relevantes

| ID | Hallazgo | Estado auditado | Trabajo requerido |
|---|---|---|---|
| B-03 | Búsquedas separadas de huésped y reserva; no hay búsqueda global unificada | `PROBADO` para las búsquedas existentes | Añadir búsqueda operativa integrada en Front Desk y criterios requeridos |
| R-01 | Room rack sin filtros por piso/tipo/estado | `PARCIAL` | Añadir filtros y búsqueda |
| R-02 | Ocupación, housekeeping y estado operativo separados | `PROBADO` | Preservar separación |
| R-03 | No hay drawer contextual de habitación | `NO INICIADO` | Implementar |
| R-04 | No existe lease temporal de asignación para UX | `NO INICIADO` | Implementar lease TTL; constraint sigue siendo autoridad |
| R-05/R-06 | Transacción/constraint y prueba de concurrencia de confirmación | `PROBADO` | Preservar y extender tests |
| H-04 | Perfil de huésped sin historial ni reservas vinculadas | `PARCIAL` / hallazgo | Implementar detalle e historial |
| P-01 | Folios/caja internos probados | `PROBADO` | Ampliar UI y catálogo de consumos |
| P-02/P-04 | Sin proveedor de pagos ni preautorización real | `PARCIAL` | Mantener como integración separada y no simular autorización |
| T-01/T-02 | Offline de shell; sin outbox/Edge | `PARCIAL` / `NO INICIADO` | Discovery y diseño separado; no prometer offline |
| T-04 | Importación CSV con preview | `PARCIAL` | OCR/PDF/imagen fuera del primer incremento |
| H-02/N-07 | NSU/authcode no se redactan explícitamente | Riesgo P1 | Corregir antes de procesar más notas |
| H-01 | Expectativa E2E desactualizada | Deuda de test P1 | Corregir test sin cambiar lógica funcional |

**Importante:** los requisitos CPF/CEP, perfil internacional, catálogo de minibar/consumos, detalle visual de Caixa y flujo UX de checkout descritos abajo son requisitos nuevos del usuario; no deben presentarse como funcionalidades existentes.

---

# 2. Objetivos y resultados esperados

Esta ficha persigue seis resultados operativos:

1. Que recepción pueda localizar una reserva/huésped desde Front Desk por nombre, fechas, estado, UH o número de reserva.
2. Que el operador pueda inspeccionar y administrar habitaciones desde una sección Room Rack/Governança completa, sin confundir ocupación con limpieza.
3. Que el check-in sea un flujo guiado desde la búsqueda hasta la confirmación, con habitación disponible y limpia, datos de huésped y validaciones.
4. Que el perfil del huésped incluya contacto, documentos brasileños/internacionales y dirección adaptativa.
5. Que Caixa/checkout permita revisar consumos, registrar cargos y pagos, cerrar cuentas y liberar habitación mediante operaciones consistentes.
6. Que las acciones de alto impacto tengan confirmaciones y mensajes que se entiendan rápidamente en un entorno de recepción.

---

# 3. Alcance y orden de ejecución

## Fase 0 — Cierre de riesgos y validación técnica

**Prioridad:** P0/P1.

**No requiere rediseño visual.**

**Estado:** ejecutada el 2026-11-16 — evidencia en `docs/v4/FASE_0_REPORT.md`.

Tareas:
- [x] Hacer una inspección actual del repositorio y confirmar la línea base.
- [x] Corregir H-01: actualizar `guests-reservations.e2e-spec.ts` para afirmar que la habitación bloqueada `ROOM_DLX_201` no aparece y que `ROOM_DLX_202` sí puede aparecer si cumple las reglas. No modificar lógica de disponibilidad salvo decisión de producto documentada. _(Ya estaba corregido en `1a836bd`; se verificó con la suite aislada sin cambiar el test ni la lógica.)_
- [x] Corregir H-02/N-07: ampliar `redactSensitiveCardData` para detectar/redactar NSU y authorization code etiquetados y formatos conocidos.
- [x] Añadir tests positivos y negativos para PAN, CVV, NSU, authcode y referencias de proveedor.
- [x] Mantener hash del texto fuente para trazabilidad sin conservar el secreto redactado.
- [x] Definir si la redacción ocurre antes de persistir `ReservationSourceNote.text`; confirmar que ninguna ruta alternativa conserva el valor original sensible. _(Redacción previa a persistir; única ruta de escritura en `InstructionsService.parseSource`.)_
- [x] Añadir prueba de regresión que confirme que el parser no crea pagos, cargos ni preautorizaciones reales. _(Conteos de `Payment`, `Folio` y `FolioLine` sin cambios.)_

**Aceptación:**
- E2E aislado vuelve a 14/14 suites verdes, o cualquier suite ajena al alcance se reporta separadamente con evidencia.
- No se persiste NSU/authcode detectado en texto fuente.
- No se alteran reglas de disponibilidad para hacer pasar el test.
- Typecheck y lint verdes.

## Fase 1 — Front Desk: búsqueda operativa y flujo de check-in

**Prioridad:** P1.

**Módulo existente:** `apps/web/src/app/(app)/front-office/page.tsx`; servicios de reservas/huéspedes/Front Office existentes.

**Estado:** ejecutada el 2026-11-16 — evidencia en `docs/v4/FASE_1_REPORT.md`.

### 1.1 Buscador visible en Front Desk

Implementar un buscador principal en la parte superior de Front Desk.

**Criterios de búsqueda principales:**
- Nombre y apellido del huésped.
- Número/código de reserva.
- Número de habitación/UH.
- Fecha de llegada.
- Fecha de salida.
- Estado de reserva.

**Estados mínimos a representar**, mapeados a los enums reales del dominio:
- Confirmada.
- Check-in / huésped alojado.
- Checkout / finalizada.
- Cancelada.
- No-show.
- Pendiente u otros estados existentes.

No inventar enums paralelos si ya existen estados canónicos. Mostrar etiquetas pt-BR en UI y conservar valores de dominio.

**Comportamiento:**
- La búsqueda por texto debe aceptar nombre, apellido, código de reserva y UH cuando sea razonable.
- Debe poder combinar texto + rango de fechas + estado.
- Debe permitir limpiar filtros.
- Los filtros frecuentes deben estar visibles; los secundarios pueden estar dentro de un panel desplegable.
- El estado de filtros debe conservarse en query string cuando sea compatible con el patrón actual.
- Debe haber estados loading, error, empty y resultados.
- Debe ser tolerante a mayúsculas/minúsculas y acentos para nombres, sin hacer matching inseguro de documentos.
- No mostrar PII ni saldos a roles sin permiso.

**Columnas/atributos recomendados de resultados:**
- Huésped principal.
- Código de reserva.
- UH o “sin habitación”.
- Fecha/hora de llegada y salida.
- Estado de reserva/estancia.
- Tipo de habitación.
- Indicador de cuenta pendiente, solo con permiso y si la API lo soporta.

**Acciones contextuales:**
- Abrir reserva.
- Abrir perfil de huésped.
- Iniciar/continuar check-in si el estado lo permite.
- Abrir folio/Caixa si el usuario tiene permiso.

No ejecutar acciones críticas directamente desde una fila sin confirmación/validación de backend.

### 1.2 Contrato de búsqueda

Inspeccionar primero `GET /api/v1/reservations` y `GET /api/v1/guests`. Reutilizar query params existentes:
`search`, `status`, `fromDate`, `toDate`, y cualquier filtro ya soportado.

Si hace falta búsqueda por UH o una búsqueda combinada, extender el contrato actual de forma compatible o crear un endpoint específico de Front Desk. No crear un endpoint duplicado sin justificación.

Propuesta conceptual si el backend necesita endpoint transversal:
- `GET /api/v1/front-office/search`
- Query params propuestos: `q`, `fromDate`, `toDate`, `status`, `roomNumber`, `reservationCode`, `page`, `pageSize`.
- Respuesta paginada con tipo de resultado (`reservation`/`guest`), datos mínimos necesarios y enlaces/IDs autorizados.
- El endpoint debe aplicar tenant context y permisos en backend.

Esta ruta es una propuesta, no un endpoint existente confirmado.

### 1.3 Flujo guiado de check-in

Secuencia UX:
1. Buscar huésped/reserva.
2. Abrir detalle de reserva.
3. Revisar fechas, ocupantes, tarifa, alimentación, instrucciones, pagos/folio y solicitudes.
4. Confirmar si existe UH asignada.
5. Si no existe, elegir habitación compatible, disponible, limpia y habilitada.
6. Completar/verificar contacto y documento de cada huésped requerido.
7. Revisar checklist de pendientes y advertencias.
8. Confirmar check-in.
9. Mostrar confirmación solo después de respuesta exitosa del backend.

Reglas:
- No asignar habitaciones ocupadas, sucias, bloqueadas, fuera de servicio o en mantenimiento para check-in normal.
- Inspección pendiente debe seguir la política de la propiedad.
- Revalidar en backend al confirmar.
- Conservar idempotencia del check-in.
- La política de saldo/preautorización pendiente es configurable/decisión del hotel piloto; no bloquear universalmente sin definición.
- Mostrar instrucciones pendientes y no marcarlas completadas automáticamente.

**Aceptación Fase 1:**
- [x] Recepción encuentra una reserva por cualquiera de los criterios principales. _(texto, UH, fechas y estado sobre `GET /reservations`; acentos resueltos con `unaccent`)_
- [x] Puede combinar fecha y estado. _(filtros combinables y conservados en query string)_
- [x] Puede abrir la reserva correcta y continuar el check-in. _(acciones Abrir/Huésped/Check-in; wizard de 4 pasos)_
- [x] La habitación destino se revalida en backend. _(`check-in-readiness` de solo lectura + revalidación transaccional en `POST /check-in`)_
- [x] Pruebas de permisos, tenant, paginación, estados vacíos y errores. _(E2E aislado 15/15 suites, 130/130 tests)_
- [x] Pruebas UI de interacción y navegación, sin mocks en producción. _(Playwright `front-office-checkin.spec.ts` 1/1 contra API y web reales)_

---

# 4. Fase 2 — Room Rack y Governança (Habitaciones)

**Prioridad:** P1.  
**Módulo existente:** tab `rack` de `front-office/page.tsx`, `front-office.service.ts`, `inventory/room-state.service.ts`.

## 4.1 Principio de dominio

Mantener tres dimensiones distintas:

1. **Ocupación:** libre/vago, ocupada u otros estados derivados del dominio.
2. **Housekeeping:** limpia, sucia, en limpieza, inspección, inspeccionada/lista si el dominio lo soporta.
3. **Estado operativo/restricción:** disponible, mantenimiento, bloqueada, fuera de servicio y otras restricciones.

`Não perturbe / DND` debe modelarse como preferencia/restricción de acceso, no como un estado de limpieza ni de ocupación.

No introducir un único enum que mezcle estas dimensiones.

## 4.2 Pantalla de habitaciones

Crear o ampliar una sección navegable “Habitaciones / Governança”.

**Vista inicial:**
- Resumen por contadores: libres, ocupadas, limpias, sucias, en limpieza, inspección y fuera de servicio.
- Tabla densa y legible como vista operativa principal.
- Evaluar vista por piso como segunda presentación si el patrón existente lo permite.
- Leyenda persistente y accesible.

**Filtros:**
- UH/número de habitación.
- Piso.
- Ala.
- Bloque/localización.
- Tipo/clase/especie de habitación.
- Capacidad.
- Ocupación.
- Estado de housekeeping.
- Estado operativo/restricción.
- Reserva asociada o fecha prevista, cuando aplique.

Los filtros deben poder combinarse y limpiarse. Preferir filtros server-side para inventarios grandes; si el backend devuelve un inventario acotado y estable, client-side puede ser aceptable. Justificar la decisión.

**Columnas mínimas:**
- UH.
- Tipo de habitación.
- Capacidad.
- Ocupación.
- Housekeeping.
- Estado operativo/restricción.
- Reserva/estancia asociada.
- Llegada/salida prevista si aplica.
- Última modificación y usuario.
- Observación breve.

## 4.3 Drawer de detalle de habitación (R-03)

Implementar un drawer contextual al seleccionar una habitación.

Debe mostrar:
- UH y tipo.
- Ocupación y estancia actual.
- Reserva asociada.
- Fechas de llegada/salida.
- Estado de housekeeping.
- Estado operativo y bloqueos activos.
- DND/restricciones relevantes.
- Última modificación y autor.
- Historial/timeline de cambios.
- Observaciones.

Acciones según permisos:
- Actualizar estado de housekeeping.
- Registrar observación/incidencia.
- Solicitar inspección o marcar inspección.
- Consultar bloqueo y, si está autorizado, crear/liberar bloqueo.
- Abrir reserva/estancia asociada.
- Iniciar cambio de habitación cuando corresponda.

Todas las mutaciones deben usar API real, validar permisos y generar auditoría.

## 4.4 Lease temporal de asignación (R-04)

El backend actual ya protege la asignación final mediante transacción/locks y constraints. No reemplazarlo.

Añadir un lease temporal para mejorar coordinación de UX:
- Al comenzar la selección/asignación, el cliente solicita lease para `roomId` y contexto de reserva.
- Lease tiene propietario (usuario/sesión), `createdAt`, `expiresAt`, estado.
- TTL configurable y renovable mientras el usuario mantenga la operación activa.
- Liberar al cancelar, completar, expirar o cerrar sesión cuando sea posible.
- La expiración debe funcionar aunque el cliente desaparezca.
- Otros usuarios ven “En selección por [usuario]” y no pueden iniciar una asignación conflictiva mientras el lease esté activo, salvo política explícita de override con permiso.
- Nunca considerar el lease como garantía de disponibilidad final.
- Al confirmar, ejecutar la transacción y constraint existentes. Si otro proceso ganó la carrera, rechazar y refrescar estado.
- Evitar que un lease huérfano bloquee habitación indefinidamente.

Contrato API conceptual (adaptar al estilo actual):
- `POST /api/v1/inventory/rooms/:roomId/assignment-leases`
- `POST /api/v1/inventory/rooms/:roomId/assignment-leases/:leaseId/renew`
- `DELETE /api/v1/inventory/rooms/:roomId/assignment-leases/:leaseId`
- Respuesta: leaseId, ownerDisplayName, expiresAt, status.
Estos endpoints son propuestas, no contratos existentes.

**Aceptación Fase 2:**
- Filtrar habitaciones por UH, piso, tipo, ocupación y housekeeping.
- Drawer muestra contexto correcto y acciones autorizadas.
- Cambios de housekeeping quedan auditados.
- Dos sesiones ven el lease en tiempo real o mediante polling controlado.
- Un lease expirado se libera.
- Dos usuarios no pueden confirmar la misma habitación; la constraint existente sigue siendo la autoridad.
- Tests para carrera, expiración, cancelación, desconexión y permisos.

---

# 5. Fase 3 — Perfil completo del huésped y documentos dinámicos

**Prioridad:** P1.  
**Base existente:** `apps/web/src/app/(app)/guests/page.tsx`, `apps/api/src/guests/guests.service.ts`, modelo Guest y party de reserva.

## 5.1 Perfil/detalle de huésped

Crear ruta de detalle según convenciones actuales, por ejemplo `/guests/[id]`.

Secciones:
1. Identificación.
2. Contacto.
3. Dirección.
4. Reservas vinculadas.
5. Historial de estancias.
6. Notas autorizadas.
7. Documentos y estado de documentación, según permisos.

Datos de contacto:
- Email.
- Teléfono con código de país.
- Nacionalidad.
- Dirección.
- Fecha de nacimiento solo cuando sea necesaria para la operación/normativa.
- Nombre completo.

Mostrar historial con fecha, propiedad, reserva, habitación si corresponde y estado; respetar tenant/property scoping.

## 5.2 CPF y pasaporte

Formulario dinámico según tipo de documento.

**CPF (Brasil):**
- Tipo de documento `CPF`.
- Entrada con o sin puntuación; normalizar para persistencia.
- Validación de formato y dígitos verificadores.
- No asumir que todos los huéspedes tienen CPF.
- No exponer CPF completo en tablas o listados si no es necesario; aplicar máscara según permisos.

**Pasaporte:**
- Número de pasaporte.
- País emisor.
- Fecha de vencimiento solo si la política/flujo la requiere.
- Nacionalidad/país de residencia como campos separados.
- No validar pasaporte extranjero con reglas de CPF.

No asumir que el país emisor es el país de residencia.

## 5.3 CEP y dirección internacional

**Cuando el tipo de dirección sea Brasil:**
- Campo CEP.
- Al completar CEP, consultar un proveedor de CEP configurado.
- Sugerir logradouro, bairro, cidade y UF/estado.
- Mostrar estado de consulta: buscando, encontrado, no encontrado, servicio indisponible.
- Permitir edición manual de todos los campos.
- No borrar valores escritos por el usuario sin confirmación si una nueva consulta cambia el resultado.

**Cuando la dirección sea internacional:**
- País.
- Ciudad.
- Región/estado/provincia cuando aplique.
- Código postal opcional.
- Dirección/línea de dirección.
- No mostrar CEP como obligatorio.

La consulta CEP debe pasar por un adapter de backend o servicio configurado; no codificar una dependencia externa directamente en el componente. Confirmar proveedor, límites y política de privacidad antes de elegir. No inventar resultados.

## 5.4 API y persistencia

Inspeccionar el modelo Guest actual antes de añadir campos. Reutilizar columnas existentes cuando sean semánticamente correctas. Evitar guardar CPF/pasaporte duplicados en Guest y ReservationParty sin regla clara.

Si se requiere:
- migración aditiva;
- DTOs con validación;
- normalización;
- índices únicos scoped por organización/propiedad solo después de decidir política de duplicados;
- permisos `guests.read` / `guests.update` existentes o equivalentes.

**Aceptación Fase 3:**
- El perfil muestra contacto, documento, dirección, reservas e historial.
- Cambiar CPF/pasaporte adapta campos y validaciones.
- CEP sugiere dirección brasileña y los campos son editables.
- Dirección internacional puede guardarse sin CEP.
- Duplicados ambiguos se presentan para revisión; no fusionar automáticamente.
- Pruebas de permisos, aislamiento tenant, validación y protección de PII.

---

# 6. Fase 4 — Caixa, consumos y checkout

**Prioridad:** P1/P2.  
**Base existente:** `apps/api/src/folio/*`, `apps/web/src/app/(app)/folios/*`, `cashier/page.tsx`. Los folios/cargos/pagos manuales y cierre operativo están probados. No existe catálogo de servicios/productos y no hay proveedor de pagos integrado.

## 6.1 Objetivo de producto

Caixa debe ser un módulo operacional completo, no solo un botón de checkout. Debe centralizar folios/cuentas, consumos, cargos, pagos, saldo, estornos y cierre.

## 6.2 Catálogo de productos/servicios

Crear dominio de catálogo solo después de revisar el modelo actual y definir el alcance mínimo del piloto.

Campos mínimos propuestos:
- Código/SKU interno.
- Nombre y descripción.
- Categoría: minibar, alimento/bebida, estacionamiento, lavandería, servicio, otros.
- Unidad.
- Precio vigente.
- Moneda.
- Estado activo/inactivo.
- Aplicabilidad por propiedad.
- Tratamiento fiscal/configuración fiscal futura, sin inventar reglas tributarias.

No almacenar stock si no existe un requisito de inventario confirmado. Si el hotel necesita inventario, diseñarlo como módulo separado.

## 6.3 Registro de consumo/cargo

Permitir registrar:
- Consumo de habitación (agua, chocolate y otros productos).
- Estacionamiento.
- Servicios adicionales.
- Cargos manuales autorizados.

Cada cargo debe tener:
- Folio/cuenta destino.
- Producto/servicio o descripción manual permitida.
- Cantidad.
- Precio unitario y total.
- Fecha/hora.
- Usuario que registró.
- Origen (minibar, recepción, estacionamiento, integración, manual).
- Estado y referencia de reverso cuando aplique.

Reglas:
- No inferir ni crear cargos a partir de notas libres.
- Capturar precio aplicado al momento del cargo como snapshot.
- No permitir edición destructiva de movimientos contabilizados; usar void/reversal con motivo y auditoría según reglas actuales.
- Respetar idempotencia y transacciones.
- Validar que el folio pertenezca a la propiedad y reserva correctas.

## 6.4 UX de Caixa

Vista de cuenta con:
- Huésped y reserva.
- Habitación/UH.
- Estado de la cuenta.
- Lista de cargos/consumos.
- Pagos recibidos.
- Saldo pendiente o crédito.
- Acciones permitidas por rol.

Acciones:
- Adicionar consumo.
- Adicionar cargo/servicio.
- Registrar pago manual cuando esté permitido.
- Dividir o transferir cargos solo si el modelo/reglas existentes lo permiten y con auditoría.
- Ver detalle de movimiento.
- Estornar/cancelar con motivo y permiso.
- Imprimir/descargar extracto usando módulo de documentos existente.

La búsqueda de Caixa debe permitir localizar por UH, huésped, código de reserva y folio, con permisos.

## 6.5 Flujo de checkout

1. Localizar cuenta por UH, huésped o reserva.
2. Verificar huésped, estancia y folios activos.
3. Revisar consumos de habitación/minibar y otros servicios.
4. Adicionar cargos pendientes confirmados por el operador.
5. Revisar pagos, saldo y crédito.
6. Registrar el pago o indicar saldo pendiente conforme a política del hotel.
7. Mostrar resumen final y advertencias.
8. Confirmar cierre de folio/cuenta.
9. Confirmar checkout de estancia.
10. Actualizar ocupación y estado de housekeeping (normalmente pasa a sucia, salvo política/flujo específico).
11. Registrar auditoría y liberar la habitación solo tras éxito de las operaciones requeridas.

**Separación obligatoria:** cierre de cuenta, checkout de estancia y estado de limpieza son conceptos relacionados pero distintos. No ejecutar una liberación silenciosa si el cierre falla.

No bloquear checkout por saldo automáticamente sin política explícita. El sistema debe mostrar saldo y aplicar la política de la propiedad.

## 6.6 Pagos y preautorización

- Mantener pagos manuales actuales.
- No afirmar que existe pago con tarjeta integrado.
- `PGTO DIRETO NO HOTEL` sigue siendo instrucción pendiente, no pago.
- Preautorización debe ser dominio separado de captura/pago.
- No persistir PAN/CVV.
- Seleccionar proveedor y revisar contrato antes de implementar tokenización/webhooks/reversos.
- No simular autorización real con un estado local.

**Aceptación Fase 4:**
- Crear/administrar catálogo inicial.
- Registrar consumos y verlos en el folio.
- Registrar pagos manuales con idempotencia y permisos.
- Calcular saldo correctamente.
- Estornar con motivo y auditoría.
- Checkout ejecuta pasos con consistencia y errores recuperables.
- Una falla de cierre no libera habitación.
- Pruebas API/E2E y pruebas UI del flujo completo.

---

# 7. Fase 5 — Cambio de habitación

**Prioridad:** P1. El endpoint y las pruebas de movimiento existen según auditoría; la tarea es principalmente completar y validar UX, además de revalidar reglas.

## 7.1 Interfaz

Crear flujo guiado:
1. Mostrar reserva/estancia y habitación actual.
2. Listar habitaciones destino candidatas.
3. Filtros por tipo, capacidad, piso/ala y estado.
4. Excluir habitaciones no elegibles para el movimiento normal.
5. Mostrar diferencias y advertencias.
6. Solicitar motivo cuando aplique.
7. Confirmar.
8. Mostrar resultado y habitación nueva.

Mostrar claramente:
- UH actual.
- UH destino.
- Tipo/capacidad.
- Estado de ocupación.
- Housekeeping.
- Bloqueos/mantenimiento.
- Fechas y restricciones de la reserva.

## 7.2 Reglas

- Reutilizar `POST /api/v1/front-office/stays/:id/room-move` si el contrato actual es adecuado.
- No crear un endpoint paralelo sin necesidad.
- Revalidar destino en backend dentro de transacción.
- Mantener constraints y locks actuales.
- Actualizar room rack y reserva/estancia de forma consistente.
- Auditar actor, fecha/hora, origen, destino y motivo.
- Si otro usuario tomó la habitación, explicar el conflicto y refrescar alternativas.

**Aceptación:** movimiento exitoso, movimiento rechazado por conflicto, permisos y auditoría cubiertos por tests; UX validada con prueba de usuario.

---

# 8. Fase 6 — Sistema de mensajes, modales y confirmaciones

**Prioridad:** P1 UX.  
**Base existente:** componentes Chakra Modal/Drawer, `QueryFeedback`, toasts y estados de carga/error.

## 8.1 Sistema de patrones

Crear/normalizar componentes reutilizables para:
- `InfoDialog` / información.
- `WarningDialog` / advertencia.
- `ConfirmDialog` / confirmación.
- `CriticalActionDialog` / acción irreversible.
- Toast/banner para notificaciones no bloqueantes.
- Inline validation para errores de campos.

Usar nombres reales que sigan la convención del repositorio.

## 8.2 Jerarquía visual

Cada mensaje debe incluir:
- Título corto y específico.
- Icono semántico.
- Color semántico con contraste suficiente; el color nunca será el único indicador.
- Resumen de una o dos frases.
- Detalles adicionales plegables si son extensos.
- Acción primaria con verbo concreto.
- Acción secundaria claramente diferenciada.
- En operaciones críticas, explicar consecuencia y objeto afectado.

Ejemplos de texto en `pt-BR`:
- Informação: “O hóspede possui café da manhã incluído.”
- Atenção: “Este quarto ainda não está marcado como limpo.”
- Confirmação: “Deseja encerrar a conta e concluir o checkout?”
- Conflito: “Este quarto foi atribuído por outro usuário. Atualize a disponibilidade e escolha outro quarto.”

## 8.3 Reglas de interacción y accesibilidad

- Foco inicial apropiado y retorno del foco al cerrar.
- Escape solo cuando la operación lo permita.
- No permitir cerrar accidentalmente un modal de operación crítica sin una decisión clara.
- Botones con estados loading/disabled para evitar doble submit.
- Teclado y lectores de pantalla.
- No usar modal para todo; avisos simples deben ser toast/banner.
- Guardar cambios no confirmados y advertir antes de descartarlos.
- Evitar párrafos largos; presentar primero la decisión y luego el detalle.

**Aceptación:** tests de componente para foco, teclado, cierre, doble submit y estados de error; revisión de contraste y legibilidad.

---

# 9. Fase 7 — Internacionalización operativa pt-BR

**Prioridad:** transversal, incorporar desde cada fase y no dejar para el final.

- `pt-BR` es idioma prioritario de la interfaz de recepción.
- Traducir labels, estados, categorías, prioridades, acciones, validaciones, errores y mensajes.
- Usar terminología hotelera natural en Brasil: `UH`, `Governança`, `Caixa`, `Check-in`, `Checkout`, `Hóspede`, `Reserva`, `Apartamento` cuando corresponda al vocabulario de la propiedad.
- No traducir nombres internos de enums ni cambiar valores persistidos por traducciones.
- Mantener i18n preparado para `es` y `en` si ya existe.
- No mezclar portugués/español en la misma pantalla.
- Parser de notas `pt-br-notes-v1` debe seguir versionado; cambios del diccionario requieren tests y compatibilidad.

**Aceptación:** prueba de idioma por rutas críticas; ningún texto nuevo visible al usuario queda hardcodeado en idioma incorrecto.

---

# 10. Fases fuera del primer ciclo de implementación

No ejecutar automáticamente junto con las fases anteriores:

## 10.1 NOVA Edge / offline multi-terminal
La auditoría confirma que solo hay cache del shell y escrituras bloqueadas offline. No hay outbox ni Edge.

Antes de implementar:
- discovery de operaciones realmente necesarias durante caída WAN;
- matriz de operaciones permitidas/prohibidas offline;
- outbox idempotente;
- estrategia de conflicto y reconciliación;
- Edge LAN, seguridad y despliegue;
- recuperación tras pérdida de energía;
- pruebas con varios terminales físicos;
- recomendación de UPS para router/switch/Edge/terminales.

No afirmar que PWA permite operar multi-terminal offline. No marcar un movimiento financiero/reserva como confirmado hasta sincronización y validación del servidor.

## 10.2 OCR/PDF/imágenes
La importación CSV actual debe preservarse. OCR y extracción de imágenes/PDF se implementarán en fase separada, con revisión humana, detección de duplicados y trazabilidad del archivo.

## 10.3 NOVA Academy
El demo actual no equivale a Academy. Diseñar un sandbox aislado con datos ficticios y ejercicios, sin conexión a propiedades reales.

## 10.4 LGPD operativa
Fase separada para:
- retención por categoría de datos;
- anonimización/eliminación;
- exportación de datos del titular;
- auditoría de acceso a PII/documentos;
- política de retención documental;
- permisos y aprobación.

## 10.5 Integraciones
FNRH Digital, PIX, NFS-e, OTA y proveedores de pago requieren discovery contractual/legal/técnico, credenciales y sandbox oficial. No inventar endpoints.

---

# 11. Plan de pruebas y criterios de calidad

## 11.1 Obligatorio por backend
- Unit tests de reglas.
- E2E de endpoints.
- Aislamiento multi-tenant.
- RBAC por rol/propiedad.
- Validación DTO.
- Idempotencia en mutaciones.
- Transacciones y concurrencia.
- Auditoría append-only.
- Migraciones desde esquema vacío.
- No regresión de módulos existentes.

## 11.2 Obligatorio por frontend
- Pruebas de loading/error/empty/success.
- Navegación y deep links.
- Formularios y validaciones.
- Prevención de doble submit.
- Modal/drawer: foco, Escape y teclado.
- Cambios sin guardar.
- Responsive desktop y tablet.
- Sin mocks en rutas productivas.

## 11.3 Escenarios E2E críticos

1. Buscar por nombre y abrir reserva correcta.
2. Buscar por código de reserva.
3. Buscar por UH y abrir folio correcto.
4. Combinar fecha + estado.
5. Check-in sin habitación: seleccionar habitación limpia y disponible.
6. Dos usuarios intentan seleccionar la misma UH: lease visible y constraint final protege.
7. Habitación libre/sucia no elegible para check-in normal.
8. Cambiar habitación a destino válido.
9. Cambiar habitación a destino tomado por otro usuario: rechazo claro.
10. CPF: validar, guardar y enmascarar.
11. Pasaporte: guardar país emisor y dirección internacional sin CEP.
12. CEP: sugerencia, edición manual y error de proveedor.
13. Agregar consumo de minibar a folio.
14. Registrar pago manual y verificar saldo.
15. Estornar cargo con motivo y verificar auditoría.
16. Checkout: revisar cuenta, cerrar folio, finalizar estancia y pasar habitación a sucia.
17. Fallo durante checkout: no liberar habitación ni mostrar éxito.
18. Notas: redacción de PAN/CVV/NSU/authcode y no side effects financieros.
19. Usuario sin permisos intenta leer/editar documentos o cuenta.
20. Usuario de otra organización intenta acceder al recurso.

## 11.4 Evidencia visual
La auditoría anterior no incluyó screenshots. Para cada fase con UI:
- capturas de desktop de recepción;
- capturas de tablet/responsive;
- estados empty/loading/error;
- modal/drawer;
- flujo completo con datos sintéticos;
- lista de resoluciones probadas.

No incluir PII real en screenshots.

---

# 12. Criterios de aceptación globales

La ficha no se considera completada hasta que:

- [ ] Front Desk permite buscar por nombre, fecha, estado, UH y código de reserva.
- [ ] Check-in guía al operador y valida habitación limpia/disponible en backend.
- [ ] Room Rack permite filtrar, abrir drawer y administrar housekeeping.
- [ ] Ocupación, housekeeping y estado operativo siguen separados.
- [ ] Lease temporal mejora la coordinación, pero no reemplaza constraints.
- [ ] Perfil de huésped muestra contacto, documentos, dirección e historial.
- [ ] CPF y pasaporte tienen formularios y validaciones diferentes.
- [ ] CEP sugiere dirección brasileña y permite corrección.
- [ ] Dirección internacional no exige CEP.
- [ ] Caixa permite registrar consumos/cargos y revisar pagos/saldo.
- [ ] Checkout coordina cuenta, estancia y housekeeping sin liberación prematura.
- [ ] Cambio de habitación tiene UX guiada y revalidación.
- [ ] Mensajes de información/advertencia/confirmación son claros, accesibles y consistentes.
- [ ] La interfaz nueva está localizada en pt-BR.
- [ ] Permisos, tenant isolation, auditoría e idempotencia siguen vigentes.
- [ ] Typecheck, lint y suites relevantes pasan.
- [ ] Hay evidencia visual y pruebas de navegador para los flujos críticos.

---

# 13. Entregables que OpenCode debe producir

## Entregable A — Plan técnico de fase
- resumen de arquitectura existente;
- archivos y módulos a modificar;
- cambios de modelo/migraciones;
- contratos API;
- componentes UI;
- riesgos y dependencias;
- plan de pruebas.

## Entregable B — Implementación por fase
- código funcional;
- migraciones;
- pruebas;
- documentación;
- screenshots;
- changelog.

## Entregable C — Informe de aceptación
Para cada requisito, usar:
- `NO INICIADO`
- `PARCIAL`
- `IMPLEMENTADO`
- `PROBADO`

Cada estado debe incluir:
- evidencia (archivo/ruta/endpoint/migración/test);
- qué es real vs demo;
- limitación restante;
- cómo reproducir la prueba.

## Entregable D — Informe de cierre
- comandos ejecutados y resultados;
- suites y número de tests;
- screenshots y resoluciones;
- migraciones aplicadas;
- riesgos abiertos;
- decisiones que necesita el usuario/hotel piloto;
- siguiente fase recomendada.

---

# 14. Secuencia de ejecución recomendada

Ejecutar en este orden, sin mezclar todas las fases en un solo cambio:

1. **Fase 0:** H-01 y H-02; cerrar riesgos y dejar baseline verde.
2. **Fase 1:** Front Desk search + flujo check-in.
3. **Fase 2:** Room Rack/Governança + drawer + lease TTL.
4. **Fase 3:** Perfil de huésped + CPF/passaporte/CEP.
5. **Fase 4:** catálogo de consumos + Caixa + checkout.
6. **Fase 5:** UX de cambio de habitación.
7. **Fase 6:** sistema consistente de mensajes y confirmaciones.
8. **Fase 7:** completar i18n pt-BR transversalmente desde el inicio.
9. Discovery independiente: LGPD, offline/Edge, OCR, Academy e integraciones externas.

**Regla de prioridad:** si la inspección actual revela que alguna funcionalidad ya fue implementada después de la auditoría, no repetirla. Ejecutar solo pruebas y completar las brechas verificadas.

---

# 15. Referencias de repositorio identificadas por la auditoría

Verificar rutas actuales antes de usarlas:

- `apps/web/src/app/(app)/front-office/page.tsx`
- `apps/web/src/app/(app)/guests/page.tsx`
- `apps/web/src/app/(app)/reservations/page.tsx`
- `apps/web/src/app/(app)/folios/`
- `apps/web/src/app/(app)/cashier/page.tsx`
- `apps/web/src/components/app-shell.tsx`
- `apps/web/src/components/ui.tsx`
- `apps/web/src/components/connection-status.tsx`
- `apps/web/src/lib/api.ts`
- `apps/api/src/front-office/front-office.service.ts`
- `apps/api/src/reservations/reservations.service.ts`
- `apps/api/src/guests/guests.service.ts`
- `apps/api/src/inventory/room-state.service.ts`
- `apps/api/src/inventory/room-block*`
- `apps/api/src/folio/`
- `apps/api/src/instructions/instruction-parser.ts`
- `apps/api/src/instructions/instructions.service.ts`
- `apps/api/test/guests-reservations.e2e-spec.ts`
- `apps/api/test/front-office.e2e-spec.ts`
- `apps/api/test/folio.e2e-spec.ts`
- `apps/api/test/instructions.e2e-spec.ts`
- `prisma/schema.prisma`
- `docs/DESIGN_SYSTEM.md`
- `docs/SECURITY.md`
- `docs/audit/NOVA_PMS_OpenCode_Audit_Checklist.md`

---

# 16. Decisiones pendientes — no asumir

OpenCode debe reportar estas decisiones como bloqueos o preguntas, no inventar respuestas:

1. ¿Qué política aplica si el huésped llega con saldo pendiente o sin preautorización?
2. ¿Qué proveedor de pago/tokenización utilizará el piloto?
3. ¿Qué catálogo inicial de minibar/servicios necesita el hotel y quién administra precios?
4. ¿Qué estados exactos de Governança utiliza el hotel piloto y cuáles son configurables?
5. ¿Qué estados de housekeeping permiten check-in? ¿Inspección pendiente bloquea o solo advierte?
6. ¿Qué proveedor de CEP se aprobará?
7. ¿Qué campos de documento son obligatorios para cada tipo de huésped según operación y normativa vigente?
8. ¿Se necesita firma electrónica o basta el registro de recepción de firma física?
9. ¿Qué operaciones deben ser soportadas durante una caída de WAN?
10. ¿Qué roles pueden estornar cargos, mover habitaciones, cambiar estados o liberar bloqueos?

No detener las fases que no dependan de estas decisiones. Usar configuración o dejar el comportamiento pendiente cuando corresponda.

---

**Fin de la Ficha 04 técnica.**  
Este documento es una especificación de ejecución para OpenCode. La auditoría del 2026-11-15 es evidencia histórica; el estado actual debe reconfirmarse en el repositorio antes de cada fase.
