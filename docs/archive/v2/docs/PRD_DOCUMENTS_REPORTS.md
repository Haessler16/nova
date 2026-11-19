# PRD — NOVA Documents & Reports v1

Status: pronto para refinamento técnico. Escopo: extensão transversal do MVP Front Office.

## 1. Problema e objetivos

Recepção precisa gerar documentos com dados já cadastrados, entregar formulários para assinatura física quando aplicável, registrar recebimento e produzir relatórios confiáveis. O sistema deve reduzir redigitação, inconsistências e relatórios manuais.

**Documents & Print:** templates por propriedade, preview, PDF, impressão, histórico, versões, reimpressões e registro de assinatura física recebida.

**Reports:** relatórios operacionais/financeiros básicos, filtros, paginação, preview, impressão e exportação.

## 2. Não objetivos v1

- Substituir FNRH Digital.
- Assinatura eletrônica avançada/qualificada própria.
- Envio automático por WhatsApp/e-mail.
- Editor visual livre de templates.
- BI avançado, revenue management, relatórios fiscais oficiais.
- Impressão térmica/ESC-POS.
- Agendamento de relatórios.

## 3. Perfis

- Recepcionista: gerar/imprimir documentos de hóspede/reserva/estadia; relatórios operacionais autorizados.
- Supervisor: histórico, reimpressão e relatórios da propriedade.
- Gerente/Admin: templates, permissões e relatórios gerenciais/financeiros.
- Auditor: leitura restrita e trilha de auditoria.
  Usar RBAC existente; não criar permissões paralelas.

## 4. Catálogo inicial

| Código                          | Documento                                      | Prioridade |
| ------------------------------- | ---------------------------------------------- | ---------- |
| GUEST_REGISTRATION              | Ficha interna de registro/estadia              | Must       |
| LODGING_TERMS                   | Termos e condições do hotel                    | Must       |
| CHECKIN_SUMMARY                 | Resumo de check-in                             | Must       |
| PAYMENT_RECEIPT_INTERNAL        | Comprovante interno de recebimento, não fiscal | Should     |
| FOLIO_STATEMENT                 | Extrato do folio                               | Should     |
| CHECKOUT_SUMMARY                | Resumo de checkout                             | Should     |
| ARRIVALS_LIST / DEPARTURES_LIST | Listas operacionais                            | Should     |
| ROOM_STATUS_LIST                | Situação dos quartos                           | Could      |

## 5. Fluxo documental

1. Usuário abre reserva/hóspede/estadia/folio.
2. Escolhe Documentos → Gerar.
3. Backend valida RBAC e escopo tenant/property.
4. Resolve template publicada e versão.
5. Monta snapshot mínimo de dados autorizados.
6. Renderiza preview A4 e PDF.
7. Usuário imprime ou baixa.
8. Sistema registra geração e evento de impressão/ download.
9. Se houver assinatura em papel, operador registra depois o recebimento assinado.
10. Reimpressões são eventos novos; documento original não muda.

Estados: GENERATED, PRINT_DIALOG_OPENED, SIGNED_PHYSICAL_RECEIVED, VOIDED. Não marcar PRINTED só porque abriu a caixa de diálogo do browser.

## 6. Campos da ficha interna

Configurar conforme finalidade: identidade do hotel, código/versão/data do documento, hóspede principal, acompanhantes quando aplicável, reserva, datas, quarto, número de hóspedes, contatos necessários, termos e campos de assinatura. Minimizar dados; mascarar documentos quando possível. Não imprimir identificadores completos sem justificativa.

## 7. Templates

- Global padrão com override por propriedade.
- Versionamento imutável; publicar nova versão em vez de editar template já usada.
- pt-BR primeiro; estrutura preparada para es-ES e en.
- Preview e PDF compartilham base HTML/CSS.
- Sanitizar conteúdo variável; não aceitar HTML arbitrário não confiável.

## 8. Reports v1

| Relatório              | Conteúdo                                            | Prioridade |
| ---------------------- | --------------------------------------------------- | ---------- |
| Ocupação               | quartos ocupados/disponíveis/fora de serviço e taxa | Must       |
| Chegadas               | previstas, realizadas, pendentes                    | Must       |
| Saídas                 | previstas e concluídas                              | Must       |
| Reservas               | novas, confirmadas, canceladas, no-show             | Must       |
| Caixa diário           | entradas, saídas, meios de pagamento, diferenças    | Must       |
| Produção por período   | diárias/receita conforme regras                     | Should     |
| Housekeeping/Auditoria | status e eventos por usuário                        | Later      |

Todo relatório mostra propriedade, período, timezone, geração e filtros. Caixa usa HotelDay/data operacional e ledger existentes. Não confundir folio com dinheiro recebido. Definir fórmula de ocupação (inventário vendável, quartos fora de serviço/bloqueados) com validação do hotel piloto. Canceladas/no-show não contam como hospedagem realizada.

## 9. UX

Documents: ação contextual em hóspede/reserva/check-in/folio/checkout; modal média para template; preview ampla/página dedicada; drawer para histórico; ações imprimir/baixar; estados loading/error/empty; aviso de dados pessoais.

Reports: página própria com categorias, filtros, KPIs, tabelas/gráficos, imprimir, PDF e CSV; paginação, totais, estado vazio/erro/sem permissão. XLSX depois da validação.

## 10. Segurança e LGPD

RBAC no backend; isolamento tenant/property; storage privado e URLs temporárias; logs sem CPF/passaporte/token/payload integral; retenção por finalidade e política; audit log para gerar/ver/baixar/reimprimir/exportar/alterar template; dados fictícios em testes. Limitar tamanho/tempo/linhas de relatórios.

## 11. Métricas

- Ficha gerada sem redigitação.
- Preview e PDF A4 legíveis e consistentes.
- Reimpressão e recebimento assinados auditáveis.
- Relatórios reconciliados com registros operacionais.
- Zero acesso cross-tenant em testes.
