# FNRH Digital — Plan de integración PMS

- Estado: **plan aprobable; integración externa no implementada**.
- Fecha de este corte: 2026-11-13.
- Objetivo: integrar NOVA PMS con la Plataforma FNRH Digital mediante un adapter aislado, con homologación previa y sin inventar contrato, credenciales ni obligaciones fiscales.
- Sustituye al documento de discovery como fuente de planificación. El discovery histórico queda resumido en `FNRH_DISCOVERY.md`.
- Fuente de verdad técnica: documentación oficial vigente listada en la sección 2. Cualquier cambio de versión obliga a revisar este plan.

## 1. Decisión de arquitectura

La integración se hará como un **módulo de infraestructura aislado** dentro del monolito NestJS, no como llamadas dispersas desde reservas, Front Office o la UI.

Reglas no negociables:

1. Ningún controller o componente web llama a FNRH directamente.
2. La UI sólo conoce el estado local de la integración; nunca recibe credenciales ni payloads completos de FNRH.
3. El adapter recibe el `TenantContext` ya validado y una `Property`; no acepta `organizationId`/`propertyId` arbitrarios del cliente.
4. Cada operación externa se registra en un ledger local antes de enviarse y se audita después.
5. No se implementa un cliente real hasta completar la puerta de homologación de la sección 9.
6. La ficha interna de NOVA no se presenta como FNRH ni como contingencia legal.

### Límite propuesto

```
Reservation / FrontOffice / Guests
            │  eventos de dominio
            ▼
   FnrhApplicationService  ──►  FnrhOperationRepository (PostgreSQL)
            │                              │
            ▼                              ▼
      FnrhProvider (port)           outbox / reconciliación
            │
            ▼
   FnrhHttpProvider (sólo tras homologación)
            │
            ▼
   API FNRH v2 (homologación o producción)
```

El puerto `FnrhProvider` es interno. Sus nombres describen intenciones de dominio; los paths oficiales viven únicamente en `FnrhHttpProvider` y en el mapeo revisado contra el manual.

## 2. Línea base oficial verificada

Consulta realizada el 2026-11-13. La página oficial indica última modificación **20/08/2026**.

| Documento                                                                                                                                                                                                                                                                                     | Versión / fecha                                                                                                                                                                            | Uso en el plan                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| [Meios de Hospedagem com PMS](https://www.gov.br/turismo/pt-br/acesso-a-informacao/acoes-e-programas/programas-projetos-acoes-obras-e-atividades/ficha-nacional-de-registro-de-hospedes/modulo-meio-de-hospedagem/meios-de-hospedagem-com-pms)                                                | Actualizada 20/08/2026                                                                                                                                                                     | Página índice: API, changelog, clave, homologación y soporte                              |
| [Manual API 2.4.2](https://www.gov.br/turismo/pt-br/acesso-a-informacao/acoes-e-programas/programas-projetos-acoes-obras-e-atividades/ficha-nacional-de-registro-de-hospedes/modulo-meio-de-hospedagem/meios-de-hospedagem-com-pms/documentacao-api-v2-4-2.pdf/@@display-file/file)           | Documento “Versão 2.4” de 19/06/2026; publicado 20/08/2026                                                                                                                                 | Contrato funcional, auth, endpoints y campos                                              |
| [Changelog API 2.4.2](https://www.gov.br/turismo/pt-br/acesso-a-informacao/acoes-e-programas/programas-projetos-acoes-obras-e-atividades/ficha-nacional-de-registro-de-hospedes/modulo-meio-de-hospedagem/meios-de-hospedagem-com-pms/changelog-api-v2-4-2.pdf/@@display-file/file)           | 03/08/2026; producción 02/04/2026                                                                                                                                                          | Sin cambios funcionales; agrega Email/Teléfono a `GET /pessoas/documento/{tipo}/{numero}` |
| [Generación de clave API](https://www.gov.br/turismo/pt-br/acesso-a-informacao/acoes-e-programas/programas-projetos-acoes-obras-e-atividades/ficha-nacional-de-registro-de-hospedes/modulo-meio-de-hospedagem/meios-de-hospedagem-com-pms/chave_api.pdf/@@display-file/file)                  | Sin versión visible                                                                                                                                                                        | Login gov.br, menú “Chaves de API”, generación y rotación                                 |
| [Ambiente de homologación](https://www.gov.br/turismo/pt-br/acesso-a-informacao/acoes-e-programas/programas-projetos-acoes-obras-e-atividades/ficha-nacional-de-registro-de-hospedes/modulo-meio-de-hospedagem/meios-de-hospedagem-com-pms/AmbienteHomologaoOrientao.pdf/@@display-file/file) | Sin versión visible                                                                                                                                                                        | Acceso al staging de gov.br; no detalla por sí solo el alta de credenciales de API        |
| [Portaria MTur 41/2025](https://www.in.gov.br/web/dou/-/portaria-mtur-n-41-de-14-de-novembro-de-2025-670238654)                                                                                                                                                                               | Publicada 21/11/2025; vigencia de 150 días por la [Portaria MTur 4/2026](https://www.in.gov.br/web/dou/-/portaria-mtur-n-4-de-18-de-fevereiro-de-2026-687612871), vigente desde 20/04/2026 | Obligaciones, credencial por establecimiento, Cadastur, LGPD y logs                       |
| [Canal de soporte Serpro](https://form.omni.serpro.gov.br/geral?codigo=3490)                                                                                                                                                                                                                  | —                                                                                                                                                                                          | Consultas de integración y alta de homologación                                           |

Hechos confirmados que importan para el diseño:

- La API es REST, JSON UTF-8, HTTPS/TLS 1.2+, versionada en la URL (`/v2`).
- Autenticación declarada por el manual: **HTTP Basic** con `Authorization: Basic base64(usuario:senha)`.
- Cada establecimiento tiene su propia credencial. La Portaria la describe como identificador de usuario + clave/token; la clave anterior se invalida al generar una nueva.
- La cuenta del establecimiento se gestiona con gov.br; el alta requiere Cadastur regular y un responsable/supervisor con permiso para generar la clave.
- El manual y la Portaria mencionan logs de errores de API para diagnóstico; no son opcionales desde el punto de vista operativo.

## 3. Contrato API confirmado (resumen operativo)

Base paths del manual:

- Producción: `https://fnrh.turismo.serpro.gov.br/FNRH_API/rest/v2`
- Homologación: `https://hom-lowcode.serpro.gov.br/FNRH_API/rest/v2`

El manual también muestra ejemplos con `https://api.fnrh.gov.br/...`. **No hardcodear ninguna base URL**: el adapter debe recibirla por configuración de entorno y la homologación debe confirmar cuál es la vigente.

Headers generales:

```
Authorization: Basic <base64(usuario:senha)>
Content-Type: application/json
Accept: application/json
```

Headers adicionales confirmados:

- `cpf_solicitante` es obligatorio en `POST /pessoas`, `GET /pessoas/documento/{tipo}/{numero}` y `POST /hospedagem/registrar` según el manual. Es un CPF de solicitante y es dato personal: no debe aparecer en logs, auditoría ni frontend.

Formatos:

- Fechas calendario: `YYYY-MM-DD`.
- Fechas/hora: ISO 8601 UTC con `Z`; el manual insiste en enviar string de texto, no objeto JSON, en check-in/check-out.
- Países: ISO 3166-1 alpha-2 / tabla IBGE.
- Ciudades brasileñas: código IBGE de 7 dígitos.
- `numero_reserva`: único en FNRH; se propone usar el código de reserva de NOVA con prefijo de propiedad si hace falta desambiguar.

Endpoints oficiales relevantes (no se implementan aún):

| Área      | Método y path                            | Uso previsto                                                |
| --------- | ---------------------------------------- | ----------------------------------------------------------- |
| Dominios  | `GET /dominios/fnrh/meios_transporte`    | Catálogo de transporte                                      |
| Dominios  | `GET /dominios/fnrh/motivos_viagem`      | Catálogo de motivo de viaje                                 |
| Dominios  | `GET /dominios/hospedes/situacoes`       | Estados de huésped                                          |
| Dominios  | `GET /dominios/reservas/situacoes`       | Estados de reserva                                          |
| Dominios  | `GET /dominios/fichas/situacoes`         | Estados de ficha                                            |
| Dominios  | `GET /dominios/pessoas/tipos_documento`  | Catálogo oficial de tipos de documento                      |
| Reservas  | `POST /reservas`                         | Crear reserva y obtener `reserva_id`/`link_precheckin`      |
| Reservas  | `GET /reservas`                          | Buscar por `codigo_reserva`, fechas o situación             |
| Reservas  | `GET/PUT/DELETE /reservas/{id}`          | Consultar, corregir o eliminar sólo si el estado lo permite |
| Reservas  | `POST /reservas/{id}/cancelar`           | Cancelar reserva en estado permitido                        |
| Reservas  | `GET/POST /reservas/{id}/hospedes`       | Listar o vincular huéspedes                                 |
| Reservas  | `POST /reservas/{id}/checkin`            | Check-in en lote                                            |
| Reservas  | `POST /reservas/{id}/checkout`           | Check-out en lote                                           |
| Reservas  | `POST /reservas/{id}/noshow`             | No-show en lote                                             |
| Huéspedes | `GET /hospedes/{id}`                     | Consultar huésped                                           |
| Huéspedes | `GET /hospedes/pre-checkins`             | Buscar pre-check-ins                                        |
| Huéspedes | `PATCH /hospedes/{id}/checkin`           | Check-in individual                                         |
| Huéspedes | `PATCH /hospedes/{id}/checkout`          | Check-out individual                                        |
| Huéspedes | `PATCH /hospedes/{id}/no-show`           | No-show individual                                          |
| Personas  | `POST /pessoas`                          | Registrar persona                                           |
| Personas  | `GET /pessoas/{id}`                      | Consultar persona                                           |
| Personas  | `GET /pessoas/documento/{tipo}/{numero}` | Detectar persona existente antes de crearla                 |
| Hospedaje | `POST /hospedagem/registrar`             | Alta completa reserva + huéspedes                           |
| Fichas    | `GET /fichas`                            | Consultar estado de fichas                                  |

El Swagger público confirma estos paths y que `page_number` es obligatorio en listados; no declara `security` por operación. Se toma Basic del manual y se valida en homologación.

### Contradicciones que bloquean una implementación ciega

| Tema                      | Diferencia observada                                                                                | Acción                                                                  |
| ------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| URL base                  | Tabla del manual usa `fnrh.turismo.serpro...`; ejemplos usan `api.fnrh.gov.br`                      | URL por configuración; confirmar con Serpro antes de codificar          |
| Credencial                | Portaria: identificador + clave/token; manual: Basic usuario:senha                                  | Confirmar mapeo exacto y si el usuario es el identificador              |
| Paginación                | Manual dice primera página = 1; ejemplos usan `page_number=0`                                       | No asumir; probar ambos en homologación                                 |
| Campos obligatorios       | Swagger no marca required en varios DTO; manual/Portaria exigen documento y otros datos             | Validar contra errores reales de homologación, no sólo Swagger          |
| `cpf_solicitante`         | Obligatorio en endpoints de personas/hospedaje, pero no está modelado en NOVA                       | Definir origen, finalidad y base legal antes de implementar             |
| Idempotencia / rate limit | No se encontró contrato de idempotencia ni límites explícitos en manual/changelog/Swagger revisados | Diseñar ledger y reconciliación; no inventar header ni retry automático |

## 4. Brecha de datos en NOVA

La API FNRH exige un registro por huésped y datos que el modelo actual minimiza deliberadamente.

| Dato FNRH                          | Estado en NOVA                                                              | Decisión de plan                                                                                                                                      |
| ---------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nombre, documento, email, teléfono | Existe en `Guest`                                                           | Reutilizar; enmascarar en logs                                                                                                                        |
| Nombre social                      | No existe                                                                   | Agregar campo opcional con finalidad FNRH                                                                                                             |
| Nacionalidad / país de residencia  | No existe                                                                   | Agregar catálogo ISO; no inferir del documento                                                                                                        |
| Fecha de nacimiento                | No existe                                                                   | Necesaria para menores/responsable; agregar con control de acceso                                                                                     |
| Género, raza/etnia, discapacidad   | No existe                                                                   | Agregar opcionales; revisar base legal y finalidad                                                                                                    |
| Dirección/CEP/ciudad IBGE          | No existe                                                                   | Agregar dirección estructurada o capturarla en el flujo FNRH                                                                                          |
| Tipo de documento                  | `PASSPORT`, `NATIONAL_ID`, `DRIVER_LICENSE`, `OTHER`                        | Mapear explícitamente a CPF/Pasaporte; no asumir que `NATIONAL_ID` es CPF                                                                             |
| Acompañantes/menores               | Reserva sólo tiene conteos `adults`/`children`; estancia tiene un `guestId` | Modelar fiesta por reserva y responsable de menores; el menor se vincula a la FNRH del responsable, sin ficha propia                                  |
| Código de reserva                  | `Reservation.code` único por propiedad                                      | Mapear a `numero_reserva`; persistir ID externo                                                                                                       |
| Origen OTA                         | `Reservation.source` string libre                                           | Mapear `origem_reserva_id` (`MEIOHOSPEDAGEM`/`OTA`; confirmar la variante `MEIO_HOSPEDAGEM` que aparece en otra descripción del Swagger) y código OTA |
| Fechas reales                      | `Stay.checkedInAt`/`checkedOutAt`                                           | Convertir a UTC ISO; no usar reloj del navegador                                                                                                      |
| Credencial por establecimiento     | No existe                                                                   | `FnrhIntegrationConfig` con `credentialRef`, entorno y flag                                                                                           |
| Identificadores externos           | No existen                                                                  | `FnrhReservationLink`, `FnrhGuestLink`                                                                                                                |
| Operaciones/errores                | Sólo audit log genérico                                                     | Ledger de operaciones y estados de reconciliación                                                                                                     |

No se debe agregar PII a `Guest` sin una finalidad, base legal, retención y controles de acceso aprobados. El plan propone capturarla en el flujo de check-in/FNRH, no precargarla masivamente.

El modelo detallado de fiesta de reserva, acompañantes, menores, perfil FNRH y migración aditiva está en `FNRH_GUEST_MODEL.md`. La revisión oficial y las firmas pendientes de producto/legal están en `FNRH_GUEST_MODEL_REVIEW.md`. Esos documentos son diseño; no se ejecutó ninguna migración.

## 5. Diseño del adapter aislado

### Módulo

```
apps/api/src/integrations/fnrh/
  fnrh.module.ts
  fnrh.config.ts                 # entorno, baseUrl, timeout, feature flag
  fnrh.provider.ts               # puerto interno
  fnrh.http-provider.ts          # único lugar con HTTP hacia FNRH
  fnrh.mapper.ts                 # dominio NOVA -> DTOs oficiales
  fnrh.application-service.ts    # casos de uso y estados
  fnrh.repository.ts             # ledger y links externos
  fnrh.errors.ts                 # errores seguros y clasificación
```

No se crea este módulo hasta que la sección 9 esté aprobada. El diseño del puerto puede revisarse en `docs/v2/src-starters/fnrh-adapter.interface.ts`; ese archivo no es contrato oficial.

### Puerto interno (diseño)

```ts
interface FnrhProvider {
  healthCheck(config: FnrhConnectionConfig): Promise<FnrhHealth>;
  createReservation(cmd: CreateFnrhReservation): Promise<FnrhResult<FnrhReservation>>;
  updateReservation(cmd: UpdateFnrhReservation): Promise<FnrhResult<void>>;
  cancelReservation(cmd: CancelFnrhReservation): Promise<FnrhResult<void>>;
  findReservationByCode(cmd: FindFnrhReservation): Promise<FnrhResult<FnrhReservation | null>>;
  getReservation(cmd: GetFnrhReservation): Promise<FnrhResult<FnrhReservation>>;
  createPerson(cmd: CreateFnrhPerson): Promise<FnrhResult<FnrhPerson>>;
  findPersonByDocument(cmd: FindFnrhPerson): Promise<FnrhResult<FnrhPerson | null>>;
  linkGuest(cmd: LinkFnrhGuest): Promise<FnrhResult<FnrhGuest>>;
  checkInReservation(cmd: FnrhTimestampCommand): Promise<FnrhResult<FnrhGuestStatus[]>>;
  checkOutReservation(cmd: FnrhTimestampCommand): Promise<FnrhResult<FnrhGuestStatus[]>>;
  noShowReservation(cmd: FnrhReservationCommand): Promise<FnrhResult<FnrhGuestStatus[]>>;
  listFichas(cmd: ListFnrhFichas): Promise<FnrhResult<FnrhFichaPage>>;
}
```

El HTTP provider traduce estos métodos a los paths oficiales. Los nombres internos no deben filtrarse a la API pública de NOVA.

### Ledger de operaciones

Modelo propuesto (nombres definitivos a validar en migración):

- `FnrhIntegrationConfig`: `organizationId`, `propertyId`, `environment`, `credentialRef`, `requesterCpfRef`, `cutoverDate`, `enabled`, `apiVersion`, `lastValidatedAt`. `requesterCpfRef` apunta a un secreto y nunca se devuelve por API/UI.
- `FnrhOperation`: `organizationId`, `propertyId`, `type`, `localKey`, `status`, `attemptCount`, `requestHash`, `externalId`, `lastErrorCode`, `createdAt`, `updatedAt`.
- `FnrhReservationLink`: `propertyId`, `reservationId`, `externalReservationId`, `externalReservationCode`, `lastKnownStatus`.
- `FnrhGuestLink`: `propertyId`, `guestId`, `externalPersonId`, `externalGuestId`, `lastKnownStatus`.

Estados mínimos: `PENDING`, `SENDING`, `CONFIRMED`, `FAILED_RETRYABLE`, `FAILED_TERMINAL`, `UNKNOWN`.

### Idempotencia y reconciliación

El manual/changelog revisados no documentan una clave de idempotencia oficial. Por eso:

1. Cada operación local tiene una `localKey` única y persistente.
2. Un `POST` ambiguo (timeout/5xx después de enviar) pasa a `UNKNOWN`; no se reintenta a ciegas.
3. Antes de reintentar una creación de reserva, se consulta `GET /reservas?codigo_reserva=...`.
4. Antes de crear una persona, se consulta `GET /pessoas/documento/{tipo}/{numero}`; si existe, se reutiliza.
5. Para check-in/check-out/no-show, se consulta el estado de la reserva/huésped antes de repetir la transición.
6. La política de retry automático queda bloqueada hasta que homologación confirme el comportamiento oficial.

No se enviará un header `Idempotency-Key` inventado.

## 6. Mapeo de eventos NOVA → FNRH

Secuencia recomendada para la primera versión:

1. **Reserva confirmada**: crear o actualizar reserva FNRH con código, fechas, PAX y origen.
2. **Huésped completo**: registrar persona (o reutilizar por documento) y vincularla a la reserva con estado de pre-check-in.
3. **Check-in**: enviar check-in en lote con instante UTC; si falla, la reserva local sigue operativa y la operación queda pendiente.
4. **Check-out**: enviar checkout en lote; no borrar la reserva local.
5. **No-show**: enviar no-show; no cuenta como estada realizada.
6. **Cancelación**: cancelar sólo si FNRH permite el estado; si no, registrar excepción para revisión.
7. **Corrección**: corregir datos antes del check-in según el flujo oficial; después, seguir el manual y no asumir que `PUT` de reserva corrige datos de personas.

`POST /hospedagem/registrar` se evalúa como alternativa sólo después de homologar: reduce llamadas, pero exige todos los campos y vuelve más difícil reconciliar partes. La primera versión prefiere operaciones granulares para aislar fallos.

## 7. Seguridad y LGPD

- `credentialRef` apunta a un secret manager/KMS; nunca se guarda la clave en PostgreSQL, frontend, audit metadata, logs, capturas ni repositorio.
- La rotación de clave invalida la anterior: el adapter debe recargar la configuración y fallar de forma segura, no reintentar con la clave vieja.
- `cpf_solicitante` es PII: no loguear headers, cuerpos completos ni números de documento. Los errores deben guardar código, referencia y conteos, no payload.
- Separar homologación y producción por configuración y credencial; no reutilizar datos ni claves.
- Datos de prueba sintéticos; nunca enviar huéspedes reales a homologación.
- Definir retención, finalidad, base legal, derechos del titular y borrado antes de producción.
- Menores: acceso restringido y responsable legal; no ampliar la finalidad.
- Documentos internos de NOVA no son contingencia FNRH mientras no exista validación legal explícita.

## 8. Homologación

### Prerrequisitos

- Cadastur del establecimiento regular.
- Cuenta gov.br de responsable/supervisor con acceso al módulo de medio de hospedaje.
- Clave de API generada en “Chaves de API” y entregada por canal seguro; no por chat, ticket público ni correo sin cifrar.
- Confirmación de la URL base de homologación y del formato exacto de credencial con Serpro.
- Datos sintéticos y un property de staging dedicado.
- Feature flag `fnrh.enabled` apagada por defecto y limitada a organización/propiedad.

### Fases de homologación

| Fase | Alcance                                                   | Criterio de salida                                  |
| ---- | --------------------------------------------------------- | --------------------------------------------------- |
| H0   | Congelar manual 2.4.2, changelog, URLs y matriz de campos | Documento versionado y contradicciones resueltas    |
| H1   | `healthCheck` + dominios de lectura                       | Respuestas 200, auth válida y base URL confirmada   |
| H2   | Crear/consultar/actualizar/cancelar reserva sintética     | `reserva_id` y `numero_reserva` reconciliables      |
| H3   | Registrar persona y vincular huésped                      | Sin duplicados por reintento; documento enmascarado |
| H4   | Check-in, checkout y no-show                              | Estados y marcas UTC correctos en FNRH              |
| H5   | Timeout, 401/403, 5xx, clave rotada, payload inválido     | Ninguna operación ambigua se reintenta a ciegas     |
| H6   | Volumen y concurrencia controlados                        | Sin doble envío ni fuga de PII; logs útiles         |

Evidencia mínima por prueba: fecha/hora UTC, operación local, endpoint, status HTTP, código de error seguro, referencia externa y resultado de reconciliación. No guardar bodies con PII.

## 9. Puerta de aceptación antes de escribir el cliente HTTP

- [x] Manual oficial 2.4.2 y changelog localizados y enlazados.
- [x] Autenticación, endpoints principales y formato de fechas revisados.
- [x] Brecha de datos y límites legales identificados.
- [x] Plan de adapter, ledger y homologación definido.
- [ ] URL base y formato exacto de credencial confirmados con Serpro.
- [ ] Contradicciones de paginación y campos obligatorios resueltas.
- [ ] Origen y base legal de `cpf_solicitante` aprobados.
- [ ] Modelo de huéspedes/acompañantes/menores aprobado por producto y legal (`FNRH_GUEST_MODEL.md` y `FNRH_GUEST_MODEL_REVIEW.md`).
- [ ] Decisiones de producto P-01 a P-06 ratificadas (edad a check-in, fiesta completa, menores dependientes, sin `StayGuest`, `requesterCpfRef`, cutover).
- [ ] Credencial de homologación entregada por canal seguro.
- [ ] Contrato de idempotencia/retry confirmado o aceptado explícitamente que no existe.
- [ ] Feature flag, retención, logs y rollback aprobados.
- [ ] Criterio explícito de que Documents v1 no es contingencia FNRH.

## 10. Entregables por iteración

1. **Plan y baseline** (este documento): sin código de integración.
2. **Migración de datos FNRH**: campos/links/ledger, detrás de feature flag, con rollback.
3. **Adapter + mocks**: puerto, mapper, errores y tests sin red.
4. **Cliente HTTP**: sólo contra homologación y con feature flag.
5. **Homologación**: ejecutar matriz, corregir y registrar evidencia.
6. **Piloto**: una propiedad, datos sintéticos, monitoreo y kill switch.
7. **Producción**: sólo con aprobación de producto/legal/operaciones y clave de producción separada.

## 11. Riesgos principales

| Riesgo                                  | Mitigación                                                              |
| --------------------------------------- | ----------------------------------------------------------------------- |
| Duplicar reservas/huéspedes por timeout | Ledger, estado `UNKNOWN`, búsqueda por código/documento, no retry ciego |
| Enviar PII a logs o auditoría           | Mapper seguro, prohibición de bodies, tests de logging                  |
| Clave comprometida                      | Secret manager, rotación, alcance por propiedad, alertas                |
| Modelo de datos insuficiente            | Migración y flujo de captura antes del cliente HTTP                     |
| Cambio de versión del manual            | Pin de versión y revisión obligatoria del changelog                     |
| Documento interno tratado como FNRH     | Copy explícito y gate legal                                             |
| Homologación no disponible              | No prometer fecha; soporte Serpro y criterio de salida                  |

## 12. Referencias internas

- `docs/v2/docs/FNRH_DISCOVERY.md` — baseline resumido y límites.
- `docs/v2/docs/FNRH_GUEST_MODEL.md` — modelo y migración de huéspedes, acompañantes y menores.
- `docs/v2/docs/FNRH_GUEST_MODEL_REVIEW.md` — revisión oficial, decisiones pendientes y matriz de firmas.
- `docs/v2/docs/FNRH_GUEST_UI_FLOW.md` — flujo de UI propuesto para la fiesta, menores y check-in.
- `docs/v2/src-starters/fnrh-adapter.interface.ts` — puerto interno ilustrativo, no contrato oficial.
- `docs/DECISIONS.md` — ADR-045 y ADR-046.
- `docs/v2/docs/QA_TEST_PLAN.md` — matriz de pruebas general.
