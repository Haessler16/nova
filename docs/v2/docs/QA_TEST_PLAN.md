# QA Test Plan

## Documents

- Gerar ficha com hóspede/reserva válida, com e sem acompanhantes.
- Campos ausentes, nomes acentuados, endereços longos.
- Preview e PDF iguais; uma e várias páginas; A4, margens, rodapé.
- Alterar dados atuais não altera snapshot antigo.
- Reimprimir mantém conteúdo/hash e gera novo evento.
- Abrir print dialog registra somente PRINT_DIALOG_OPENED.
- Recebimento assinado usa user/time do servidor.
- Sem permissão não visualiza/baixa; URL expirada falha.
- Cross-tenant/property negado.
- Template publicada não é editada in-place.
- HTML malicioso não executa.

## Reports

- Ocupação: quartos fora de serviço, bloqueados e uso interno.
- Chegadas/saídas previstas vs realizadas.
- Canceladas/no-show não contam como hospedagem.
- Caixa concilia entradas, saídas, estornos, saldo e ledger.
- Fechamento após meia-noite usa HotelDay.
- Timezone, filtros inválidos, ranges excessivos, paginação.
- PDF/CSV reproduzem filtros/totais; CSV formula injection neutralizada.
- Sem permissão financeira nega exportação.
- Cross-tenant isolation e carga realista.

## FNRH

- Confirmar manual 2.4.2/changelog e a versão pinada no plano.
- Confirmar homologação/credenciais e URL base antes de qualquer chamada.
- Nunca logar token ou payload PII.
- Timeout/5xx não duplica reserva, persona ou check-in; operação ambígua fica `UNKNOWN` e é reconciliada por código/documento.
- Testar 401/403, documento inválido, clave rotada, cancelamento em estado inválido e cross-tenant.
- Dados sintéticos apenas em homologação.
- PDF interno não é apresentado como FNRH nem como contingência legal.

## Pilot

- Testar impressora A4, Chrome/Edge e SO da recepção.
- Validar logo, dados do hotel, idioma e política de assinatura.
- Confirmar relatórios com PMS atual e reconciliar caixa/ocupação.
