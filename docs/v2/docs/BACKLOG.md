# Backlog — Documents & Reports v1

## EPIC A — Discovery (P0)

- [x] Inspecionar estrutura, schema, entidades, RBAC, audit, storage, HotelDay, timezone e testes.
- [x] Mapear Guest, Reservation, Stay, Room, Folio, Payment, CashRegister, Organization, Property e User reais.
- [x] Confirmar padrão de API, validação, UI e bibliotecas.
- [x] ADR para PDF renderer, storage e export.

## EPIC B — Templates (P0/P1)

- [x] Modelar DocumentTemplate e versões imutáveis.
- [x] Contexto tipado por tipo documental.
- [x] Ficha interna pt-BR e termos do hotel.
- [ ] Cabeçalho e rodapé por propriedade implementados; logo por propriedade sigue pendiente (no hay storage/asset de logo en Property).
- [x] Preview seguro e testes de sanitização/campos ausentes.
- [x] Preparar es-ES/en: locale y contratos listos; sólo hay plantillas pt-BR publicadas.

## EPIC C — PDF e impressão (P0/P1)

- [x] PDF A4 server-side e storage privado (bytes en PostgreSQL, descarga autenticada; ADR-043).
- [x] GeneratedDocument com snapshot mínimo, versão, hash.
- [x] Preview A4, download e print dialog.
- [x] Registrar PRINT_DIALOG_OPENED, sem afirmar impressão física.
- [x] Registrar recebimento físico assinado.
- [x] Histórico e reimpressões.
- [ ] Testar margens, quebras, fontes, acentos e impressora real.

## EPIC D — UX contextual (P1)

- [x] Ação Documentos em hóspede: selector de reserva dentro del mismo modal, con reservas canceladas/no-show excluidas.
- [x] Ação Documentos em reserva, check-in, check-out e folio.
- [x] Modal seletora de template, preview ampla e histórico dentro del modal.
- [x] Estados loading/empty/error/denied.
- [ ] Responsive e acessibilidade.

## EPIC E — Reports (P0/P1)

- [x] Catálogo ReportDefinition com permissões e schemas de filtro.
- [x] Chegadas, saídas, ocupação, reservas/cancelamentos/no-show, caixa diário.
- [x] Filtros e paginação.
- [x] PDF e CSV seguro; XLSX depois.
- [x] Histórico de execuções/exportações (derivado do audit log; sem re-download de artefatos).
- [x] Conciliação com ledger e regras HotelDay.

> Cerrado el 2026-11-13 con los límites del ADR-044: ejecución síncrona, 62 días, 5000 filas, historial sin tabla propia y artefactos no persistidos.

## EPIC F — Segurança (P0)

- [x] RBAC backend em todas as operações.
- [x] Tenant/property isolation em list/get/preview/generate/download/export.
- [x] Audit events para visualizar, gerar, baixar, reimprimir e exportar; não há edição de template na v1.
- [x] Storage privado, minimização e mascaramento; download autenticado sem URL pública (ADR-043).
- [x] Testes cross-tenant e privilege escalation.

## EPIC G — FNRH discovery (P0 discovery, P2 integration)

- [x] Baixar manual API 2.4.2, changelog, clave e instruções de homologação.
- [x] Confirmar versão, auth, endpoints principais, formatos e códigos de erro; contradições registradas.
- [x] Mapear Guest/Reservation/Stay/dependentes (mapa candidato, não contrato).
- [x] ADR-045/046 para credenciais, retry, reconciliação e logs.
- [x] Plan de integração, adapter, homologação e critérios de aceite em `FNRH_INTEGRATION_PLAN.md`.
- [x] Desenho do modelo/migração de hóspedes, acompanhantes e menores em `FNRH_GUEST_MODEL.md`; não implementado.
- [x] Revisão oficial e matriz de firmas de produto/legal em `FNRH_GUEST_MODEL_REVIEW.md`; aprovações pendentes.
- [x] Decisões de produto P-01 a P-06 registradas para planejamento; ratificação humana e decisões legais pendentes.
- [x] Fluxo de UI de acompanhantes/menores em `FNRH_GUEST_UI_FLOW.md`; primeira integração implementada em código, migração não aplicada.
- [x] Protótipo navegável da festa da reserva em `prototypes/fnrh-party/index.html`; dados sintéticos, sem backend.
- [x] Guia da sessão de validação com recepção e registro inicial de achados em `FNRH_PARTY_VALIDATION_SESSION.md`; sessão não executada.
- [ ] Executar o plano de tarefas derivado do protótipo em `FNRH_PARTY_IMPLEMENTATION_TASKS.md`, após as portas de produto, legal/DPO, segurança e Serpro.
- [ ] Resolver URL base, formato de credencial, paginação e `cpf_solicitante` com Serpro/legal.
- [ ] Adapter + mocks somente após contrato confirmado.
- [ ] Homologação com dados sintéticos; pilot por feature flag; produção após validação.

> Baseline oficial y plan documentados el 2026-11-13 en `FNRH_DISCOVERY.md` y `FNRH_INTEGRATION_PLAN.md`, con ADR-045/046. El manual 2.4.2 está descargado y enlazado, pero no hay credenciales de homologación ni se implementaron llamadas. La integración sigue bloqueada por la puerta de aceptación del plan, no por falta de discovery.

## Ordem recomendada

1. A discovery.
2. B templates.
3. C PDF/print.
4. D UX contextual.
5. F segurança antes de usuários reais.
6. E reports.
7. G discovery em paralelo; integração externa somente depois.

## Definition of Done

Backend RBAC e tenant scope; loading/empty/error/success; testes; auditoria; docs atualizadas; screenshots desktop/mobile; sem dados reais em fixtures; segurança e regressão aprovadas.
