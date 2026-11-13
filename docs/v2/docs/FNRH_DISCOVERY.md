# FNRH Digital — Discovery y límites de integración

- Estado: discovery abierto. No hay integración externa implementada.
- Fecha de este corte: 2026-11-13.
- Alcance: entender qué falta para integrar NOVA PMS con la FNRH Digital sin inventar endpoints, credenciales, reglas fiscales ni comportamiento de proveedores.
- Fuente normativa de referencia: Portaria MTur 41/2025 y la documentación oficial de integração/API publicada por el Ministerio de Turismo. La consulta interna de `docs/v2/docs/TECHNICAL_DESIGN.md` menciona API 2.4.2 en la página oficial al 2026-11-10; **ese dato no se verificó descargando el manual vigente en este workspace**.

## 1. Qué está confirmado y qué no

| Tema                                                                  | Estado                                      | Evidencia / límite                                                                                                               |
| --------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| La FNRH Digital sustituye la ficha física con contingencias previstas | Confirmado a nivel normativo general        | Portaria MTur 41/2025, según el resumen del `TECHNICAL_DESIGN`; leer el texto íntegro antes de afirmar una contingencia concreta |
| Existe una API de integración PMS                                     | Confirmado por la documentación de producto | Página oficial de integración citada en el diseño técnico                                                                        |
| Versión vigente del manual/API                                        | **No confirmado**                           | La referencia a 2.4.2 es una consulta histórica, no un manual descargado ni un changelog validado                                |
| Autenticación, credenciales por establecimiento y homologación        | **No confirmado en detalle**                | Requiere manual y alta en homologación                                                                                           |
| Endpoints, payloads, códigos de error, límites y rate limits          | **No confirmado**                           | No se debe programar contra nombres inventados                                                                                   |
| Idempotencia, retry y reconciliación                                  | **No confirmado**                           | Debe surgir del contrato oficial                                                                                                 |
| Datos obligatorios de huéspedes/dependientes y retención              | **No confirmado**                           | Requiere texto normativo y definición legal del piloto                                                                           |
| Contingencia legal mediante PDF interno                               | **No confirmado**                           | No declarar que el paquete Documents v1 sustituye la FNRH                                                                        |
| Modelo de auditoría exigido al PMS                                    | **No confirmado en detalle**                | El diseño asume trazabilidad, pero el formato lo define el contrato oficial                                                      |

La regla operativa es simple: **si un dato no está en esta tabla como confirmado, no se implementa como si lo estuviera**.

## 2. Fuera de alcance de este corte

- Llamadas reales a la API de FNRH, incluso en homologación.
- Guardar tokens, certificados o credenciales del establecimiento.
- Crear endpoints, DTOs o payloads “oficiales” a partir de nombres internos.
- Declarar cumplimiento fiscal, validez legal o sustitución de la ficha física.
- Scraping, automatización de portales o ingeniería inversa del proveedor.
- Enviar datos reales de huéspedes a cualquier entorno externo.

## 3. Mapa de datos candidato (para discutir, no contrato)

| Dominio NOVA                | Datos que probablemente se necesiten                                     | Observaciones                                                                |
| --------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `Organization` / `Property` | Establecimiento, CNPJ/identificador, dirección, credencial por propiedad | Confirmar qué identificador exige FNRH y cómo se relaciona con la credencial |
| `Guest`                     | Nombre, documento, nacionalidad, fecha de nacimiento, contacto           | Minimizar; no asumir que todos los campos son obligatorios                   |
| `Reservation`               | Código, fechas, cantidad de huéspedes, estado                            | Confirmar mapeo de estados y cancelaciones                                   |
| `Stay`                      | Check-in/check-out reales, habitación, acompañantes                      | Confirmar si FNRH usa fechas/horas locales o instantes                       |
| `User` / actor              | Operador que confirma una operación                                      | No enviar credenciales; la auditoría local sigue siendo necesaria            |
| Documents                   | Ficha interna, términos y PDF                                            | No equivalen automáticamente a FNRH ni a una contingencia aceptada           |

## 4. Flujo propuesto, sujeto a contrato oficial

1. Habilitar la integración por propiedad mediante feature flag y credencial cifrada.
2. Validar el establecimiento contra el entorno de homologación.
3. Mapear y validar los datos mínimos de la reserva/huésped antes de enviar.
4. Enviar la operación con una clave de idempotencia definida por el contrato oficial.
5. Persistir localmente un registro de intento, referencia externa, estado y errores seguros.
6. Ante timeout, consultar estado o reintentar **solo** si el contrato lo permite; nunca crear un segundo registro por un timeout.
7. Reconciliar estados y mostrar al operador pendientes/errores sin exponer tokens ni PII innecesaria.
8. Mantener la auditoría local append-only, separando el evento interno del acuse externo.

Este flujo no se implementa hasta confirmar cada paso con el manual y la homologación.

## 5. Seguridad y LGPD

- Credenciales por establecimiento en un secret manager/KMS; nunca en frontend, logs, auditoría, capturas ni repositorio. `credentialRef` es una referencia, no el token.
- Separar homologación y producción; no reutilizar credenciales ni datos.
- No registrar payloads completos, documentos de identidad ni tokens. Loguear como máximo referencia externa, código seguro y conteos.
- Aplicar minimización: enviar solo los campos exigidos y durante la finalidad de hospedaje.
- Definir retención, derecho de acceso/rectificación y borrado antes de producción.
- Rate limiting, timeout, circuit breaker y alertas de errores; la cola/outbox, si se adopta, debe ser idempotente.
- Validar que un error del proveedor no convierta una operación local en “cumplida” sin acuse.

## 6. Preguntas abiertas para producto, legal y hotel piloto

1. ¿Cuál es el manual/changelog oficial vigente y cuál es la versión contractual que el piloto debe usar?
2. ¿Cómo se obtiene la homologación y qué credencial corresponde a cada establecimiento?
3. ¿Qué operaciones son obligatorias: pre-check-in, check-in, checkout, cancelación, no-show y correcciones?
4. ¿Qué identificadores de persona y documento son obligatorios, y cómo se tratan acompañantes y menores?
5. ¿Qué reglas aplican a huéspedes extranjeros, documentos no brasileños y datos faltantes?
6. ¿FNRH usa fecha calendario, hora local del establecimiento o un instante con offset?
7. ¿Cuál es la semántica oficial de idempotencia, timeout, retry y reconciliación?
8. ¿Qué errores son recuperables y cuáles requieren intervención humana?
9. ¿Qué auditoría y retención exige el proveedor, y qué evidencia debe conservar NOVA?
10. ¿Qué contingencia permite la norma cuando el establecimiento no tiene conectividad?
11. ¿Un PDF interno puede usarse como contingencia? ¿Con qué texto, firma y plazo?
12. ¿Qué datos pueden mostrarse en reportes internos sin ampliar la finalidad del tratamiento?

## 7. Puerta de aceptación para empezar a codificar

No se abre un PR de integración hasta cumplir todos estos puntos:

- [ ] Manual oficial vigente descargado y versionado como referencia interna (sin secretos).
- [ ] Changelog y versión de API confirmados.
- [ ] Entorno de homologación y credencial de prueba disponibles por canal seguro.
- [ ] Contrato de autenticación, endpoints, payloads, errores, límites e idempotencia revisado.
- [ ] Mapa de datos aprobado por producto/legal, con campos obligatorios y minimización.
- [ ] Diseño de timeout/retry/reconciliación aprobado.
- [ ] Política de logs, retención y feature flag aprobada.
- [ ] Casos de prueba con datos sintéticos y criterios de rollback definidos.
- [ ] Confirmación explícita de que Documents v1 no se presenta como FNRH ni como contingencia legal.

## 8. Relación con el código actual

`docs/v2/src-starters/fnrh-adapter.interface.ts` es un puerto interno de intención. Nombres como `healthCheck`, `synchronizeReservation` o `submitPreCheckIn` **no** son endpoints oficiales. El paquete de documentos actual genera PDFs internos con snapshot y auditoría; no se conecta a FNRH y no debe describirse como integración fiscal.
