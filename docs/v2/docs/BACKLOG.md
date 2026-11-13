# Backlog — Documents & Reports v1

## EPIC A — Discovery (P0)
- [ ] Inspecionar estrutura, schema, entidades, RBAC, audit, storage, HotelDay, timezone e testes.
- [ ] Mapear Guest, Reservation, Stay, Room, Folio, Payment, CashRegister, Organization, Property e User reais.
- [ ] Confirmar padrão de API, validação, UI e bibliotecas.
- [ ] ADR para PDF renderer, storage e export.

## EPIC B — Templates (P0/P1)
- [ ] Modelar DocumentTemplate e versões imutáveis.
- [ ] Contexto tipado por tipo documental.
- [ ] Ficha interna pt-BR e termos do hotel.
- [ ] Cabeçalho/logo/rodapé por propriedade.
- [ ] Preview seguro e testes de sanitização/campos ausentes.
- [ ] Preparar es-ES/en.

## EPIC C — PDF e impressão (P0/P1)
- [ ] PDF A4 server-side e storage privado.
- [ ] GeneratedDocument com snapshot mínimo, versão, hash.
- [ ] Preview A4, download e print dialog.
- [ ] Registrar PRINT_DIALOG_OPENED, sem afirmar impressão física.
- [ ] Registrar recebimento físico assinado.
- [ ] Histórico e reimpressões.
- [ ] Testar margens, quebras, fontes, acentos e impressora real.

## EPIC D — UX contextual (P1)
- [ ] Ação Documentos em hóspede/reserva/check-in/folio/checkout.
- [ ] Modal seletora de template, preview ampla/página e drawer de histórico.
- [ ] Estados loading/empty/error/denied.
- [ ] Responsive e acessibilidade.

## EPIC E — Reports (P0/P1)
- [ ] Catálogo ReportDefinition com permissões e schemas de filtro.
- [ ] Chegadas, saídas, ocupação, reservas/cancelamentos/no-show, caixa diário.
- [ ] Filtros e paginação.
- [ ] PDF e CSV seguro; XLSX depois.
- [ ] Histórico de execuções/exportações.
- [ ] Conciliação com ledger e regras HotelDay.

## EPIC F — Segurança (P0)
- [ ] RBAC backend em todas as operações.
- [ ] Tenant/property isolation em list/get/preview/generate/download/export.
- [ ] Audit events para visualizar, gerar, baixar, reimprimir, exportar e alterar template.
- [ ] Storage privado, URL temporária, minimização e mascaramento.
- [ ] Testes cross-tenant e privilege escalation.

## EPIC G — FNRH discovery (P0 discovery, P2 integration)
- [ ] Baixar manual API e changelog oficial vigente.
- [ ] Confirmar versão, auth, homologação, endpoints, payloads, erros, limites, idempotência.
- [ ] Mapear Guest/Reservation/Stay/dependentes.
- [ ] ADR para credenciais, retry, reconciliação e logs.
- [ ] Adapter + mocks somente após contrato confirmado.
- [ ] Homologação com dados sintéticos; pilot por feature flag; produção após validação.

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
