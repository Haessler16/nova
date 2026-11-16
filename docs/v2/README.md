# NOVA PMS — Documents & Reports v1

Pacote de especificação para OpenCode. Inclui PRD, arquitetura, contratos API, backlog, QA, prompt, rascunho Prisma e interfaces TypeScript.

## Como usar

1. Copie `docs/`, `prisma-drafts/` e `src-starters/` para a raiz do NOVA PMS.
2. Abra OpenCode no repositório.
3. Execute `docs/OPEN_CODE_EXECUTION_PROMPT.md`.
4. Exija inspeção do schema, RBAC, auditoria, storage, timezone/HotelDay e bibliotecas existentes antes de editar.
5. Implemente primeiro Documents & Print, depois Reports. FNRH tem baseline oficial e plano de integração; o cliente HTTP continua bloqueado até a homologação.

## Decisões

- Light SaaS, balanced, modais híbridas.
- PDF A4 e impressão via navegador na v1.
- Ficha interna e termos do hotel NÃO substituem FNRH Digital.
- V1 suporta assinatura física no papel e registro de recebimento; não cria assinatura eletrônica própria.
- Relatórios v1: ocupação, chegadas, saídas, reservas e caixa diário.
- PDF e CSV primeiro; XLSX após validar biblioteca e necessidade.
- Isolamento por organização e propriedade em toda operação.

## Referências oficiais FNRH

- Portaria MTur 41/2025: https://www.gov.br/turismo/pt-br/centrais-de-conteudo-/publicacoes/atos-normativos-2/2025/portaria-mtur-no-41-de-14-de-novembro-de-2025
- Integração PMS/API: https://www.gov.br/turismo/pt-br/acesso-a-informacao/acoes-e-programas/programas-projetos-acoes-obras-e-atividades/ficha-nacional-de-registro-de-hospedes/modulo-meio-de-hospedagem/meios-de-hospedagem-com-pms
- Plano de integração: `docs/FNRH_INTEGRATION_PLAN.md`
- Modelo de huéspedes/acompañantes/menores: `docs/FNRH_GUEST_MODEL.md`
- Revisión de producto/legal: `docs/FNRH_GUEST_MODEL_REVIEW.md`
- Flujo de UI de huéspedes/acompañantes/menores: `docs/FNRH_GUEST_UI_FLOW.md`
- Tareas de implementación derivadas del prototipo y puertas de producto/legal: `docs/FNRH_PARTY_IMPLEMENTATION_TASKS.md`
- Guía de sesión de validación con recepción y registro de hallazgos: `docs/FNRH_PARTY_VALIDATION_SESSION.md`
- Manual do usuário: https://www.gov.br/turismo/pt-br/acesso-a-informacao/acoes-e-programas/programas-projetos-acoes-obras-e-atividades/ficha-nacional-de-registro-de-hospedes/manuais/manual-do-usario/manual-do-usuario
- Manual API 2.4.2: https://www.gov.br/turismo/pt-br/acesso-a-informacao/acoes-e-programas/programas-projetos-acoes-obras-e-atividades/ficha-nacional-de-registro-de-hospedes/modulo-meio-de-hospedagem/meios-de-hospedagem-com-pms/documentacao-api-v2-4-2.pdf/@@display-file/file

A página oficial de integração confirmou API 2.4.2 na consulta de 13/11/2026. O manual 2.4.2 está enlazado; as contradições e a porta de homologação estão no plano. Não inventar endpoints, credenciais ou payloads.
