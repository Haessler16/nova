# Technical Design — Documents, Reports & FNRH

## 1. Arquitetura
Respeitar modular monolith e convenções atuais. Módulos: `documents`, `reports`, `integrations/fnrh`. Reutilizar auth, RBAC, tenant context, audit log, storage e property settings. Não criar microserviços na v1.

## 2. Document service
Pipeline: request → auth/RBAC/tenant guard → domain data loader → template resolver → context validator → HTML renderer → PDF renderer → private storage → GeneratedDocument → audit event.

Inspecionar bibliotecas atuais antes de instalar. Preferir renderer server-side compatível com o projeto (ex. Playwright/Chromium se já disponível). `window.print()` não é o gerador canônico. CSS A4: `@page { size: A4; margin: 14mm; }`. Testar fontes, quebras e acentos. Guardar PDF em storage privado e metadados no banco; download por URL assinada curta.

## 3. Snapshot e integridade
No momento de gerar, guardar templateId/version, tipo, propertyId, generatedBy/At, snapshot JSON mínimo, storageKey, MIME, tamanho, páginas e SHA-256. Documento histórico não deve mudar se os dados atuais forem editados. Reimpressão usa mesmo artefato e cria evento. Política de retenção e minimização deve ser definida.

## 4. Assinatura
V1: linha para assinatura física, nome legível/data; operador marca `SIGNED_PHYSICAL_RECEIVED`, com receivedAt/By e nota opcional. Não declarar assinado só porque foi impresso. Upload de scan é opcional futuro, com ACL, validação de arquivo e retenção. Assinatura eletrônica futura via provider escolhido e avaliação jurídica; imagem desenhada não equivale automaticamente a qualquer modalidade de assinatura.

## 5. Reports
ReportDefinition controla chave, filtros e permissão. Query server-side fixa por relatório; nunca aceitar SQL livre do cliente. Validar filtros, limites e escopo. Paginar tabelas; exportações grandes podem ser jobs. PDF inclui propriedade, período, timezone, geração, filtros, páginas e totais. CSV deve neutralizar formula injection (`=`, `+`, `-`, `@`, tab/CR no início). XLSX posterior.

## 6. Regras
- Ocupação: definir inventário vendável e exclusões; documentar fórmula.
- Chegadas/saídas: timezone local da propriedade; esperado separado de realizado.
- Reservas: distinguir confirmada, cancelada, no-show e hospedagem.
- Caixa: ledger/cash movements como fonte de verdade; distinguir pagamento, estorno, saída, saldo e diferença.
- HotelDay: usar data operacional existente para caixa/fechamento; não usar relógio do browser como fonte.
- Não expor PII em relatórios agregados sem necessidade.

## 7. FNRH Digital
Portaria MTur 41/2025 institui FNRH digital e substituição da ficha física, ressalvadas contingências previstas. A norma prevê integração PMS/API, credencial por estabelecimento, ciclo pré-check-in/check-in/checkout e trilha de auditoria.

A página oficial de integração listava API 2.4.2 na consulta de 10/11/2026. Antes de codificar, baixar manual/changelog vigente e confirmar versão, homologação, auth, endpoints, payloads, erros, limites, idempotência e regras de retry.

Criar adapter interno isolado. Nomes de operações internas como healthCheck, syncReservation, syncGuest, submitPreCheckIn, confirmCheckIn, confirmCheckout são intenções internas, não endpoints oficiais confirmados. Não inventar chamadas, não fazer scraping. Credenciais criptografadas em secret manager/KMS; nunca frontend/logs. Separar homologação e produção. Timeout não deve causar submissão duplicada; consultar status ou usar idempotência conforme contrato oficial. Não presumir que PDF interno é contingência legal válida: confirmar texto integral e manual.

## 8. Segurança
- Cada list/get/preview/generate/download/export verifica property e organization.
- Storage privado; URLs temporárias.
- Auditoria append-only para operações sensíveis.
- Logs sem dados pessoais e secrets.
- Rate limit e limite de range/linhas.
- Testes cross-tenant, privilege escalation e expiração de URL.
