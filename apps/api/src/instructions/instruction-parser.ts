import { createHash } from 'node:crypto';

/**
 * Deterministic pt-BR parser for reservation observations.
 *
 * The parser only produces suggestions. It never writes money, payments,
 * pre-authorizations, folio lines, room assignments or tariff changes. Every
 * suggestion requires explicit human confirmation.
 */

export const INSTRUCTION_PARSER_VERSION = 'pt-br-notes-v1';

export type InstructionCategory =
  | 'PAYMENT'
  | 'MEAL'
  | 'BILLING'
  | 'ROOM'
  | 'ARRIVAL'
  | 'IMPORTANT'
  | 'EXTRA'
  | 'CONFIDENTIAL'
  | 'GENERAL';

export type InstructionPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
export type InstructionSuggestionStatus = 'NEW' | 'NEEDS_CLARIFICATION';
export type InstructionActionType =
  | 'PAYMENT_PREAUTHORIZATION'
  | 'VERIFY_PAYMENT'
  | 'BILLING_TASK'
  | 'ARRIVAL_REMINDER';
export type InstructionExecutionMoment = 'PRE_ARRIVAL' | 'CHECK_IN' | 'DURING_STAY' | 'CHECK_OUT';
export type InstructionPaymentMethod = 'CREDIT_CARD' | 'PIX' | 'CASH' | 'BANK_TRANSFER' | 'UNKNOWN';

export interface ParsedInstructionSuggestion {
  category: InstructionCategory;
  title: string;
  body: string;
  priority: InstructionPriority;
  status: InstructionSuggestionStatus;
  sourcePhrase: string;
  confidence: number;
  requiresHumanConfirmation: true;
  actionType?: InstructionActionType;
  executionMoment?: InstructionExecutionMoment;
  paymentMethod?: InstructionPaymentMethod;
  assignedDepartment?: string;
}

export interface ParsedSourceNote {
  originalText: string;
  parserVersion: string;
  suggestions: ParsedInstructionSuggestion[];
  warnings: string[];
  redacted: boolean;
}

interface ParserRule {
  id: string;
  pattern: RegExp;
  build: (phrase: string) => Omit<
    ParsedInstructionSuggestion,
    'sourcePhrase' | 'confidence' | 'requiresHumanConfirmation'
  > & {
    confidence?: number;
  };
}

const PAYMENT_PREAUTH = /\b(?:pgto|pagamento|pgt?o?)\s+direto\s+no\s+hotel\b/i;
const PAYMENT_IN_CASH =
  /\b(?:pgto|pagamento)\b[^\n]{0,80}\b(?:lan[cç]ado|registrado)\s+no\s+caixa\b/i;
const BREAKFAST = /\b(?:rsv|reserva)?\s*(?:com|inclui)\s+caf[eé]\b|\bcaf[eé]\s+inclu[ií]do\b/i;
const EXTRAS_DIRECT = /\bextras?\s+direto\b/i;
const DEBIT_EXTRAS = /\bdebitar\s+(?:di[aá]rias?\s+e\s+)?extras?\b/i;
const INVOICE_DAILY = /\bfaturar\s+(?:di[aá]rias?|hospedagem)\b/i;
const INVOICE_CNPJ = /\bemitir\s+nf\b[^\n]{0,40}\bcnpj\b/i;
const DO_NOT_CANCEL = /\bn[aã]o\s+cancelar\s+(?:rsv|reserva)\b/i;
const ARRIVAL_TIME = /\b(?:pax|h[oó]spede)\s+chegar[aá]\s+(?:[aà]s?\s*)?\d{1,2}(?::\d{2})?\s*h?\b/i;
const WARN_AT_CHECKIN = /\bavisar\s+(?:no|na)\s+check[\s-]?in\b/i;
const UPGRADE_SUBJECT = /\b(?:up|upgrade)\s+por\s+dispo(?:nibilidade)?\b/i;
// The confirmed example uses a bare category ("LUXO CASAL"), while channel
// messages also prefix it with "APTO". Both forms are informational only.
const ROOM_CATEGORY =
  /\b(?:(?:apto|apartamento|quarto)\s+)?(?:luxo|deluxe|standard|superior|executivo)\s+(?:casal|solteiro|triplo|duplo)\b|\b(?:apto|apartamento|quarto)\s+(?:luxo|deluxe|standard|superior|executivo|casal|solteiro|triplo|duplo)\b/i;
const RATE_TEXT = /\b(?:trf|tarifa|di[aá]ria)\b[^\n]{0,60}\bR\$\s*[\d.,]+/i;
const NF_CNPJ_TEXT = /\bcnpj\b/i;
const CONFIDENTIAL_TEXT = /\b(?:confidencial|sigiloso|n[aã]o\s+divulgar)\b/i;

const RULES: ParserRule[] = [
  {
    id: 'payment-preauth',
    pattern: PAYMENT_PREAUTH,
    build: () => ({
      category: 'PAYMENT',
      title: 'Realizar preautorização de cartão no check-in',
      body: 'Pendente de preautorização com cartão de crédito no check-in. O parser não inicia a pré-autorização: o operador deve confirmar o valor conforme a política do hotel no módulo de pagamentos. Não é pagamento realizado nem autorização obtida.',
      priority: 'HIGH',
      status: 'NEW',
      actionType: 'PAYMENT_PREAUTHORIZATION',
      executionMoment: 'CHECK_IN',
      paymentMethod: 'CREDIT_CARD',
      assignedDepartment: 'FRONT_DESK',
      confidence: 0.97,
    }),
  },
  {
    id: 'payment-ledger-check',
    pattern: PAYMENT_IN_CASH,
    build: () => ({
      category: 'PAYMENT',
      title: 'Verificar pagamento no caixa',
      body: 'O texto afirma que o pagamento foi lançado no caixa. Verificar contra o ledger e o folio antes de qualquer conclusão. O parser não cria pagamento nem altera saldo.',
      priority: 'HIGH',
      status: 'NEEDS_CLARIFICATION',
      actionType: 'VERIFY_PAYMENT',
      executionMoment: 'CHECK_IN',
      paymentMethod: 'UNKNOWN',
      assignedDepartment: 'FINANCE',
      confidence: 0.9,
    }),
  },
  {
    id: 'invoice-cnpj',
    pattern: INVOICE_CNPJ,
    build: () => ({
      category: 'BILLING',
      title: 'Revisar emissão de NF no CNPJ',
      body: 'Solicitação de nota fiscal com CNPJ. Extrair os dados de faturamento e validar com o setor responsável. O parser não emite NF e não grava dados fiscais inventados.',
      priority: 'HIGH',
      status: 'NEEDS_CLARIFICATION',
      actionType: 'BILLING_TASK',
      executionMoment: 'CHECK_OUT',
      assignedDepartment: 'FINANCE',
      confidence: 0.85,
    }),
  },
  {
    id: 'invoice-daily',
    pattern: INVOICE_DAILY,
    build: () => ({
      category: 'BILLING',
      title: 'Revisar faturamento da hospedagem',
      body: 'Solicitação de faturamento das diárias. Requer validação das regras de folio e faturamento; nenhum valor é alterado automaticamente.',
      priority: 'NORMAL',
      status: 'NEW',
      actionType: 'BILLING_TASK',
      executionMoment: 'CHECK_OUT',
      assignedDepartment: 'FINANCE',
      confidence: 0.82,
    }),
  },
  {
    id: 'debit-extras',
    pattern: DEBIT_EXTRAS,
    build: () => ({
      category: 'BILLING',
      title: 'Revisar roteamento de diárias e extras',
      body: 'Pedido de débito de diárias/extras. Verificar as regras de folio e roteamento antes de lançar qualquer cargo. O parser não cria cargos.',
      priority: 'NORMAL',
      status: 'NEW',
      actionType: 'BILLING_TASK',
      executionMoment: 'CHECK_OUT',
      assignedDepartment: 'FINANCE',
      confidence: 0.8,
    }),
  },
  {
    id: 'extras-direct',
    pattern: EXTRAS_DIRECT,
    build: () => ({
      category: 'EXTRA',
      title: 'Extras cobrados diretamente ao hóspede',
      body: 'Informação de que os extras são cobrados diretamente ao hóspede. Não criar cargo automaticamente; confirmar com o operador.',
      priority: 'NORMAL',
      status: 'NEW',
      executionMoment: 'DURING_STAY',
      confidence: 0.78,
    }),
  },
  {
    id: 'breakfast',
    pattern: BREAKFAST,
    build: () => ({
      category: 'MEAL',
      title: 'Desayuno incluido — conciliar con el plano de tarifa',
      body: 'O texto indica café da manhã incluído. Reconciliar com o RatePlan para não duplicar o benefício. O parser não altera a tarifa.',
      priority: 'NORMAL',
      status: 'NEW',
      executionMoment: 'DURING_STAY',
      assignedDepartment: 'RESERVATIONS',
      confidence: 0.9,
    }),
  },
  {
    id: 'do-not-cancel',
    pattern: DO_NOT_CANCEL,
    build: () => ({
      category: 'IMPORTANT',
      title: 'No cancelar la reserva sin autorización',
      body: 'Alerta crítica: a reserva não deve ser cancelada sem autorização excepcional registrada. Respeitar o fluxo de exceção; o parser nunca cancela.',
      priority: 'CRITICAL',
      status: 'NEW',
      assignedDepartment: 'RESERVATIONS',
      confidence: 0.96,
    }),
  },
  {
    id: 'arrival-time',
    pattern: ARRIVAL_TIME,
    build: () => ({
      category: 'ARRIVAL',
      title: 'Confirmar llegada anticipada',
      body: 'Hóspede informa horário previsto de chegada. Tratar como recordatório; não prometer disponibilidade imediata nem alterar datas.',
      priority: 'HIGH',
      status: 'NEEDS_CLARIFICATION',
      actionType: 'ARRIVAL_REMINDER',
      executionMoment: 'PRE_ARRIVAL',
      assignedDepartment: 'FRONT_DESK',
      confidence: 0.8,
    }),
  },
  {
    id: 'warn-at-checkin',
    pattern: WARN_AT_CHECKIN,
    build: () => ({
      category: 'IMPORTANT',
      title: 'Avisar no check-in',
      body: 'Recordatório operacional para avisar no check-in. Exibir ao recepcionista no resumo do check-in.',
      priority: 'HIGH',
      status: 'NEW',
      actionType: 'ARRIVAL_REMINDER',
      executionMoment: 'CHECK_IN',
      assignedDepartment: 'FRONT_DESK',
      confidence: 0.88,
    }),
  },
  {
    id: 'upgrade-subject',
    pattern: UPGRADE_SUBJECT,
    build: () => ({
      category: 'ROOM',
      title: 'Upgrade sujeito à disponibilidade',
      body: 'Upgrade condicionado à disponibilidade. Não prometer nem alterar a habitação automaticamente; avaliar no check-in.',
      priority: 'NORMAL',
      status: 'NEW',
      executionMoment: 'CHECK_IN',
      assignedDepartment: 'FRONT_DESK',
      confidence: 0.85,
    }),
  },
  {
    id: 'room-category',
    pattern: ROOM_CATEGORY,
    build: (phrase) => ({
      category: 'ROOM',
      title: 'Categoria de habitação informada',
      body: `Categoria mencionada no texto: "${phrase}". Reconciliar com o RoomType da reserva; o parser não atribui habitação nem altera a categoria.`,
      priority: 'LOW',
      status: 'NEW',
      confidence: 0.72,
    }),
  },
  {
    id: 'rate-text',
    pattern: RATE_TEXT,
    build: (phrase) => ({
      category: 'BILLING',
      title: 'Tarifa mencionada — validar sem sobrescrever',
      body: `Trecho de tarifa encontrado: "${phrase}". Tratar como informação. Não alterar preço oficial, folio ou caixa e não inferir o valor da preautorização.`,
      priority: 'NORMAL',
      status: 'NEEDS_CLARIFICATION',
      executionMoment: 'CHECK_IN',
      assignedDepartment: 'FINANCE',
      confidence: 0.7,
    }),
  },
  {
    id: 'confidential',
    pattern: CONFIDENTIAL_TEXT,
    build: () => ({
      category: 'CONFIDENTIAL',
      title: 'Informação confidencial',
      body: 'Texto marcado como confidencial ou sigiloso. Restringir a leitura aos perfis autorizados.',
      priority: 'HIGH',
      status: 'NEW',
      confidence: 0.8,
    }),
  },
  {
    id: 'invoice-cnpj-mention',
    pattern: NF_CNPJ_TEXT,
    build: () => ({
      category: 'BILLING',
      title: 'Dados de faturamento CNPJ mencionados',
      body: 'O texto menciona CNPJ. Validar se há solicitação de faturamento e registrar os dados na entidade fiscal adequada, não na nota.',
      priority: 'NORMAL',
      status: 'NEEDS_CLARIFICATION',
      actionType: 'BILLING_TASK',
      executionMoment: 'CHECK_OUT',
      assignedDepartment: 'FINANCE',
      confidence: 0.6,
    }),
  },
];

const AMBIGUOUS_DATE = /\b\d{1,2}\s*[-–]\s*\d{1,2}\/\d{1,2}\b/;
const EXPLICIT_YEAR_DATE = /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/;
const CARD_LABEL =
  /\b(?:cart[aã]o|card|pan)\s*(?:n[oº°]?|n[uú]mero|number)?\s*[:=]?\s*[\d][\d -]{11,21}\b/gi;
const CVV_LABEL =
  /\b(?:cvv|cvc|cod(?:igo)?\.?\s*(?:de\s*)?seg(?:uran[cç]a)?)\s*[:=]?\s*\d{3,4}\b/gi;

// NSU, authorization code and provider references are opaque payment
// identifiers: unlike a PAN they have no checksum, so only a labelled value is
// redacted. The value must look like a reference code (>= 2 digits) to avoid
// redacting ordinary prose such as "o NSU é obrigatório".
const NSU_LABEL =
  /\b(?:nsu|n[uú]mero\s+sequencial(?:\s+[uú]nico)?)\b\s*(?:n[oº°]?\.?|[:=#])?\s*([A-Za-z0-9][A-Za-z0-9._-]{3,31})(?![A-Za-z0-9._-])/gi;
const AUTH_CODE_LABEL =
  /\b(?:auth(?:orization)?\s*(?:code|c[oó]digo)?|c[oó]d(?:igo)?\s*(?:de\s*)?autoriza[cç][aã]o|autoriza[cç][aã]o|aut\.?)\b\s*(?:n[oº°]?\.?|[:=#])?\s*([A-Za-z0-9][A-Za-z0-9._-]{3,31})(?![A-Za-z0-9._-])/gi;
const PROVIDER_REF_LABEL =
  /\b(?:tid|transaction\s*id|id\s*da\s*transa[cç][aã]o|refer[eê]ncia\s+(?:do\s+)?(?:pagamento|provedor|transa[cç][aã]o))\b\s*(?:n[oº°]?\.?|[:=#])?\s*([A-Za-z0-9][A-Za-z0-9._-]{3,31})(?![A-Za-z0-9._-])/gi;

function normalizeWhitespace(value: string): string {
  return value.replace(/\r\n/g, '\n').trim();
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function luhnValid(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (double) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
    double = !double;
  }
  return sum > 0 && sum % 10 === 0;
}

function looksLikeReferenceCode(value: string): boolean {
  return value.replace(/\D/g, '').length >= 2;
}

/**
 * Removes card numbers, CVV, NSU, authorization codes and provider references
 * from free text. The digest of the exact received text is kept separately, so
 * redaction does not erase traceability while avoiding payment secrets at rest.
 */
export function redactSensitiveCardData(input: string): { text: string; redacted: boolean } {
  let redacted = false;
  let text = input;

  const redactLabelledReference = (pattern: RegExp, placeholder: string): void => {
    text = text.replace(pattern, (match: string, value: string) => {
      if (!looksLikeReferenceCode(value)) {
        return match;
      }
      redacted = true;
      return `${match.slice(0, match.length - value.length)}${placeholder}`;
    });
  };

  redactLabelledReference(AUTH_CODE_LABEL, '[AUTH_CODE_REDACTED]');
  redactLabelledReference(NSU_LABEL, '[NSU_REDACTED]');
  redactLabelledReference(PROVIDER_REF_LABEL, '[PROVIDER_REF_REDACTED]');

  text = text.replace(CVV_LABEL, () => {
    redacted = true;
    return '[CVV_REDACTED]';
  });
  text = text.replace(CARD_LABEL, (match) => {
    const digits = match.replace(/\D/g, '');
    // Labels can match non-card identifiers such as document numbers. Only
    // redact when the digit sequence looks like a PAN or the label is explicit.
    if (digits.length >= 13 && digits.length <= 19 && luhnValid(digits)) {
      redacted = true;
      return '[CARD_REDACTED]';
    }
    if (/\b(?:pan|cart[aã]o|card)\b/i.test(match) && digits.length >= 13) {
      redacted = true;
      return '[CARD_REDACTED]';
    }
    return match;
  });
  // Bare PANs without a label (13-19 digits, optional separators, Luhn valid).
  text = text.replace(/\b(?:\d[ -]?){13,19}\b/g, (match) => {
    const digits = match.replace(/\D/g, '');
    if (digits.length >= 13 && digits.length <= 19 && luhnValid(digits)) {
      redacted = true;
      return '[CARD_REDACTED]';
    }
    return match;
  });
  return { text, redacted };
}

function phraseFor(text: string, pattern: RegExp): string | null {
  const match = pattern.exec(text);
  return match === null ? null : match[0].trim();
}

export function parseSourceNote(input: string): ParsedSourceNote {
  const raw = normalizeWhitespace(input);
  const redaction = redactSensitiveCardData(raw);
  const text = redaction.text;
  const warnings: string[] = [];
  const suggestions: ParsedInstructionSuggestion[] = [];
  const seen = new Set<string>();

  if (text.length === 0) {
    warnings.push('O texto está vazio.');
    return {
      originalText: '',
      parserVersion: INSTRUCTION_PARSER_VERSION,
      suggestions,
      warnings,
      redacted: redaction.redacted,
    };
  }

  if (AMBIGUOUS_DATE.test(text) && !EXPLICIT_YEAR_DATE.test(text)) {
    warnings.push(
      'O texto contém uma data sem ano (por exemplo, 12-15/11). Resolver com o contexto da reserva e confirmar com revisão humana.',
    );
  }

  if (redaction.redacted) {
    warnings.push(
      'Dados sensíveis de pagamento (cartão, CVV, NSU ou código de autorização) foram redigidos antes de salvar o texto original. Não armazene esses valores.',
    );
  }

  if (/\bR\$\s*[\d.,]+/.test(text)) {
    warnings.push(
      'O texto menciona valores monetários. O parser não altera tarifa, folio nem caixa e não infere o valor da preautorização.',
    );
  }

  for (const rule of RULES) {
    const phrase = phraseFor(text, rule.pattern);
    if (phrase === null) {
      continue;
    }
    const key = `${rule.id}:${phrase.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const built = rule.build(phrase);
    const { confidence, ...rest } = built;
    suggestions.push({
      ...rest,
      sourcePhrase: phrase,
      confidence: confidence ?? 0.75,
      requiresHumanConfirmation: true,
    });
  }

  if (suggestions.length === 0) {
    warnings.push(
      'Nenhuma instrução conhecida foi detectada. O texto original foi preservado para revisão manual.',
    );
  }

  return {
    originalText: text,
    parserVersion: INSTRUCTION_PARSER_VERSION,
    suggestions,
    warnings,
    redacted: redaction.redacted,
  };
}

export function hashSourceText(text: string): string {
  return sha256(text);
}

export function hashContent(text: string): string {
  return sha256(normalizeWhitespace(text).replace(/\s+/g, ' ').toLowerCase());
}

export function hashSuggestion(suggestion: {
  category: string;
  title: string;
  body: string;
  actionType?: string;
  executionMoment?: string;
}): string {
  return sha256(
    [
      suggestion.category,
      suggestion.title.trim().toLowerCase(),
      suggestion.body.trim().replace(/\s+/g, ' ').toLowerCase(),
      suggestion.actionType ?? '',
      suggestion.executionMoment ?? '',
    ].join('|'),
  );
}
