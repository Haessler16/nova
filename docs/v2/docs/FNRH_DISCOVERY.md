# FNRH Digital — Discovery y baseline oficial

- Estado: **discovery cerrado; plan de integración definido; integración externa no implementada**.
- Fecha de este corte: 2026-11-13.
- Plan ejecutable: `docs/v2/docs/FNRH_INTEGRATION_PLAN.md`.
- Decisión: ADR-045 y ADR-046 en `docs/DECISIONS.md`.

## 1. Qué quedó confirmado

La consulta oficial del 2026-11-13 encontró la página **Meios de Hospedagem com PMS** del Ministerio de Turismo, actualizada el 20/08/2026, con la documentación vigente:

- [Manual API 2.4.2](https://www.gov.br/turismo/pt-br/acesso-a-informacao/acoes-e-programas/programas-projetos-acoes-obras-e-atividades/ficha-nacional-de-registro-de-hospedes/modulo-meio-de-hospedagem/meios-de-hospedagem-com-pms/documentacao-api-v2-4-2.pdf/@@display-file/file), publicado el 20/08/2026; el PDF se titula “Versão 2.4 de 19/06/2026”.
- [Changelog 2.4.2](https://www.gov.br/turismo/pt-br/acesso-a-informacao/acoes-e-programas/programas-projetos-acoes-obras-e-atividades/ficha-nacional-de-registro-de-hospedes/modulo-meio-de-hospedagem/meios-de-hospedagem-com-pms/changelog-api-v2-4-2.pdf/@@display-file/file), del 03/08/2026. No cambia endpoints, auth ni reglas; agrega Email/Teléfono al retorno de `GET /pessoas/documento/{tipo}/{numero}`.
- [Generación de clave API](https://www.gov.br/turismo/pt-br/acesso-a-informacao/acoes-e-programas/programas-projetos-acoes-obras-e-atividades/ficha-nacional-de-registro-de-hospedes/modulo-meio-de-hospedagem/meios-de-hospedagem-com-pms/chave_api.pdf/@@display-file/file): login gov.br con responsable/supervisor, menú “Chaves de API”, generación y rotación. Una clave nueva invalida la anterior.
- [Ambiente de homologación](https://www.gov.br/turismo/pt-br/acesso-a-informacao/acoes-e-programas/programas-projetos-acoes-obras-e-atividades/ficha-nacional-de-registro-de-hospedes/modulo-meio-de-hospedagem/meios-de-hospedagem-com-pms/AmbienteHomologaoOrientao.pdf/@@display-file/file): instrucciones de acceso al staging de gov.br.
- [Portaria MTur 41/2025](https://www.in.gov.br/web/dou/-/portaria-mtur-n-41-de-14-de-novembro-de-2025-670238654): FNRH digital, Cadastur, credencial por establecimiento, pre-check-in/check-in/checkout, menores, LGPD, logs y contingencia. La [Portaria MTur 4/2026](https://www.in.gov.br/web/dou/-/portaria-mtur-n-4-de-18-de-fevereiro-de-2026-687612871) fijó su vigencia en 150 días; rige desde el 20/04/2026.
- [Soporte Serpro](https://form.omni.serpro.gov.br/geral?codigo=3490) para dudas de integración y homologación.

Hechos técnicos confirmados:

- API REST v2, JSON UTF-8, HTTPS/TLS 1.2+, versionado en la URL.
- Autenticación HTTP Basic: `Authorization: Basic base64(usuario:senha)`.
- Endpoints oficiales para dominios, reservas, huéspedes, personas, hospedaje completo y fichas.
- Fechas calendario `YYYY-MM-DD`; fecha/hora ISO 8601 UTC con `Z`.
- `numero_reserva` es único en FNRH.
- `cpf_solicitante` es obligatorio en operaciones de personas y en `POST /hospedagem/registrar`.
- La documentación menciona logs de errores de API en el portal para diagnóstico.

## 2. Contradicciones que siguen abiertas

No se resuelven por suposición; están bloqueadas en la puerta de aceptación del plan:

1. **URL base:** el manual declara `fnrh.turismo.serpro.gov.br/FNRH_API/rest/v2`, pero sus ejemplos usan `api.fnrh.gov.br`. Debe confirmarse con Serpro.
2. **Credencial:** la Portaria habla de identificador + clave/token; el manual usa Basic usuario:senha. No asumir que el usuario es el identificador.
3. **Paginación:** el manual dice que la primera página es 1, pero un ejemplo usa `page_number=0`.
4. **Campos obligatorios:** el Swagger no marca required en varios DTO; el manual y la Portaria exigen más datos.
5. **`cpf_solicitante`:** no existe en NOVA; hay que definir de quién es, con qué finalidad y base legal.
6. **Idempotencia y rate limits:** no se encontró un contrato explícito en manual, changelog ni Swagger revisados. No se enviará una clave de idempotencia inventada.

## 3. Brecha de datos de NOVA

La integración no puede empezar sólo con el modelo actual:

- `Guest` no tiene nombre social, nacionalidad, país de residencia, fecha de nacimiento, género, raza/etnia, discapacidad ni dirección.
- `GuestDocumentType` no distingue CPF de RG; `NATIONAL_ID` no se puede asumir como CPF.
- La reserva guarda conteos de adultos/menores, pero no huéspedes individuales ni responsables de menores.
- `Stay` tiene un solo `guestId`; FNRH requiere una ficha por huésped.
- No hay identificadores externos de FNRH, configuración por establecimiento, credencial cifrada ni ledger de operaciones.
- `Property` no tiene Cadastur/CNPJ/dirección; parte de eso se gestiona en el portal, no necesariamente en el payload, pero debe resolverse en el onboarding.

Cualquier campo nuevo de PII requiere finalidad, base legal, retención y control de acceso aprobados antes de migrar.

El diseño detallado de la fiesta de reserva, acompañantes, menores, perfil FNRH y migración aditiva está en `FNRH_GUEST_MODEL.md`; la revisión oficial y las firmas pendientes están en `FNRH_GUEST_MODEL_REVIEW.md`. La primera implementación interna ya existe en código y su migración está aplicada/verificada sólo en la base local autorizada; no se aplicó en staging ni producción.

## 4. Límites que se mantienen

- No hay llamadas reales a FNRH, ni siquiera en homologación, hasta completar la puerta de aceptación.
- No se guardan credenciales en el repositorio, frontend, logs ni auditoría.
- No se declara la ficha interna de NOVA como FNRH ni como contingencia legal.
- No se implementan endpoints, payloads o headers “oficiales” sin validarlos contra el manual y la homologación.
- No se envían datos reales de huéspedes a staging.

## 5. Siguiente paso

El plan `FNRH_INTEGRATION_PLAN.md` define:

1. baseline oficial y contradicciones;
2. brecha de datos;
3. módulo `integrations/fnrh` y puerto interno;
4. ledger de operaciones y reconciliación sin idempotencia inventada;
5. mapeo de eventos de reserva, huésped, check-in, checkout, no-show y cancelación;
6. fases de homologación, pruebas, rollout y rollback;
7. puerta de aceptación antes de escribir el cliente HTTP.

La integración externa con FNRH sigue **no implementada** y sin fecha comprometida hasta resolver los puntos abiertos y obtener credenciales de homologación.
