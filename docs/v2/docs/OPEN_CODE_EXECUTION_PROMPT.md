# Prompt para OpenCode

Leia todos os arquivos deste pacote antes de implementar.

## Etapa 0 — Inspecionar
Antes de editar, inspecione repositório, schema real, entidades, RBAC, audit log, storage, timezone/HotelDay, UI library, API conventions, validação e testes. Entregue mapa do projeto, entidades existentes, bibliotecas PDF/export, plano por arquivos/migrations e riscos. Não substitua arquitetura ou dependências sem justificativa.

Não aplique diretamente o fragmento Prisma; adapte relações, IDs, enums, índices e convenções. Pare e peça aprovação para migrations destrutivas, serviço externo ou mudança ampla.

## Etapa 1 — Documents
Implementar templates versionadas e imutáveis, contexto tipado, ficha interna pt-BR, termos do hotel, preview seguro, PDF A4 server-side, storage privado, URL temporária, snapshot/hash, histórico/reimpressão, auditoria e ação para registrar recebimento de assinatura física. Comece com fluxo contextual em reserva/hóspede/check-in. Não criar assinatura eletrônica própria. Não afirmar que o browser confirmou impressão física.

## Etapa 2 — Reports
Implementar chegadas, saídas, ocupação, reservas/cancelamentos/no-show e caixa diário. Definir fórmula de ocupação, timezone e data operacional. Conciliar caixa com ledger. Adicionar filtros, paginação, PDF e CSV com formula injection neutralizada. Não aceitar SQL do cliente.

## Etapa 3 — FNRH discovery
Ler Portaria, manual de usuário, manual API e changelog oficiais vigentes. Confirmar auth, homologação, credenciais, endpoints, payloads, limites, erros e idempotência. Escrever ADR. Não fazer chamadas reais até contrato confirmado e aprovação.

## Regras
- RBAC e tenant/property scope no backend em todas as operações.
- Ficha interna não substitui FNRH Digital.
- Sem PII real em fixtures.
- Preservar arquitetura e contratos existentes.
- Rodar lint, typecheck, testes e build.
- Capturar screenshots desktop/mobile.
- Reportar migrations, comandos, resultados, limitações e pendências.
- Commits pequenos e revisáveis.

Execute Etapa 0 primeiro e apresente o plano. Depois implemente Documents, depois Reports. FNRH discovery pode ocorrer em paralelo, mas sem integração externa real.
