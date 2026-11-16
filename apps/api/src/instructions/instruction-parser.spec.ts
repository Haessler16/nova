import {
  hashContent,
  INSTRUCTION_PARSER_VERSION,
  parseSourceNote,
  redactSensitiveCardData,
} from './instruction-parser';

const EXAMPLE =
  'RSV COM CAFE / TRF DBL R$ 606,00 + 15% / PGTO DIRETO NO HOTEL (12-15/11) / LUXO CASAL';

describe('pt-BR instruction parser', () => {
  it('turns PGTO DIRETO NO HOTEL into a pending check-in card pre-authorization suggestion', () => {
    const parsed = parseSourceNote(EXAMPLE);

    const payment = parsed.suggestions.find(
      (suggestion) => suggestion.actionType === 'PAYMENT_PREAUTHORIZATION',
    );
    expect(payment).toMatchObject({
      category: 'PAYMENT',
      priority: 'HIGH',
      status: 'NEW',
      executionMoment: 'CHECK_IN',
      paymentMethod: 'CREDIT_CARD',
      requiresHumanConfirmation: true,
    });
    expect(payment?.sourcePhrase).toMatch(/PGTO DIRETO NO HOTEL/i);
    expect(payment?.body).toContain('não inicia a pré-autorização');
    expect(payment?.body).not.toContain('pago');
  });

  it('preserves the source phrase and warns about dates without a year', () => {
    const parsed = parseSourceNote(EXAMPLE);

    expect(parsed.parserVersion).toBe(INSTRUCTION_PARSER_VERSION);
    expect(parsed.originalText).toContain('12-15/11');
    expect(parsed.warnings.join(' ')).toMatch(/data sem ano/i);
  });

  it('suggests breakfast reconciliation without duplicating a rate plan', () => {
    const parsed = parseSourceNote('RSV COM CAFE / LUXO CASAL');
    const meal = parsed.suggestions.find((suggestion) => suggestion.category === 'MEAL');

    expect(meal?.title).toMatch(/Desayuno/i);
    expect(meal?.body).toMatch(/RatePlan/i);
    expect(meal?.actionType).toBeUndefined();
  });

  it('never turns a rate mention into a charge or an inferred pre-authorization amount', () => {
    const parsed = parseSourceNote('TRF DBL R$ 606,00 + 15%');
    const rate = parsed.suggestions.find((suggestion) => suggestion.category === 'BILLING');

    expect(rate?.actionType).toBeUndefined();
    expect(rate?.body).toMatch(/Não alterar preço oficial/);
    expect(parsed.warnings.join(' ')).toMatch(/valores monetários/i);
    expect(
      parsed.suggestions.some((suggestion) => suggestion.actionType === 'PAYMENT_PREAUTHORIZATION'),
    ).toBe(false);
  });

  it('requires ledger verification when the text claims a cash payment was posted', () => {
    const parsed = parseSourceNote('PGTO DAS DIARIAS OK LANÇADO NO CAIXA');
    const verify = parsed.suggestions.find(
      (suggestion) => suggestion.actionType === 'VERIFY_PAYMENT',
    );

    expect(verify).toMatchObject({
      category: 'PAYMENT',
      status: 'NEEDS_CLARIFICATION',
    });
    expect(verify?.body).toMatch(/ledger/i);
  });

  it('keeps upgrades and room categories informational', () => {
    const parsed = parseSourceNote('UP POR DISPO / APTO LUXO CASAL');
    const room = parsed.suggestions.filter((suggestion) => suggestion.category === 'ROOM');

    expect(room.length).toBeGreaterThanOrEqual(2);
    expect(room.every((suggestion) => suggestion.actionType === undefined)).toBe(true);
    expect(room.map((suggestion) => suggestion.body).join(' ')).toMatch(/não atribui habitação/i);
  });

  it('recognizes the bare room category from the confirmed example without assigning a room', () => {
    const parsed = parseSourceNote('LUXO CASAL');
    const room = parsed.suggestions.filter((suggestion) => suggestion.category === 'ROOM');

    expect(room).toHaveLength(1);
    expect(room[0]?.sourcePhrase).toMatch(/LUXO CASAL/i);
    expect(room[0]?.actionType).toBeUndefined();
    expect(room[0]?.body).toMatch(/não atribui habitação/i);
  });

  it('covers the initial business dictionary without creating side effects', () => {
    const cases: Array<{ text: string; category: string; actionType?: string }> = [
      { text: 'RSV COM CAFE', category: 'MEAL' },
      {
        text: 'PGTO DAS DIARIAS OK LANÇADO NO CAIXA',
        category: 'PAYMENT',
        actionType: 'VERIFY_PAYMENT',
      },
      { text: 'EXTRAS DIRETO', category: 'EXTRA' },
      { text: 'DEBITAR DIARIAS E EXTRAS', category: 'BILLING', actionType: 'BILLING_TASK' },
      { text: 'FATURAR DIARIAS', category: 'BILLING', actionType: 'BILLING_TASK' },
      { text: 'EMITIR NF NO CNPJ', category: 'BILLING', actionType: 'BILLING_TASK' },
      { text: 'NÃO CANCELAR RSV', category: 'IMPORTANT' },
      { text: 'PAX CHEGARÁ ÀS 7H', category: 'ARRIVAL', actionType: 'ARRIVAL_REMINDER' },
      { text: 'AVISAR NO CHECK IN', category: 'IMPORTANT', actionType: 'ARRIVAL_REMINDER' },
      { text: 'UP POR DISPO', category: 'ROOM' },
      { text: 'APTO LUXO CASAL', category: 'ROOM' },
      { text: 'TRF DBL R$ 606 + 15%', category: 'BILLING' },
    ];

    for (const testCase of cases) {
      const parsed = parseSourceNote(testCase.text);
      const suggestion = parsed.suggestions.find((item) => item.category === testCase.category);
      expect(suggestion).toBeDefined();
      if (testCase.actionType !== undefined) {
        expect(suggestion?.actionType).toBe(testCase.actionType);
      }
      expect(parsed.suggestions.every((item) => item.requiresHumanConfirmation)).toBe(true);
    }
  });

  it('does not report a fake room category for unrelated words', () => {
    const parsed = parseSourceNote('Hóspede pediu um quarto silencioso.');
    expect(parsed.suggestions.some((suggestion) => suggestion.category === 'ROOM')).toBe(false);
  });

  it('flags do-not-cancel as critical without cancelling anything', () => {
    const parsed = parseSourceNote('NÃO CANCELAR RSV');
    const important = parsed.suggestions.find((suggestion) => suggestion.category === 'IMPORTANT');

    expect(important?.priority).toBe('CRITICAL');
    expect(important?.body).toMatch(/nunca cancela/i);
  });

  it('redacts labelled and bare card data before persisting source text', () => {
    const pan = '4111 1111 1111 1111';
    const redacted = redactSensitiveCardData(`Cartão: ${pan} CVV: 123`);
    expect(redacted.redacted).toBe(true);
    expect(redacted.text).not.toContain('4111');
    expect(redacted.text).not.toContain('123');
    expect(redacted.text).toContain('[CARD_REDACTED]');
    expect(redacted.text).toContain('[CVV_REDACTED]');
  });

  it('returns warnings instead of inventing instructions for unknown text', () => {
    const parsed = parseSourceNote('Texto livre sem padrão conhecido.');

    expect(parsed.suggestions).toHaveLength(0);
    expect(parsed.warnings.join(' ')).toMatch(/Nenhuma instrução conhecida/i);
  });

  it('produces stable content hashes while preserving distinct raw text digests', () => {
    expect(hashContent('RSV COM CAFE')).toBe(hashContent('  rsv com   cafe  '));
    expect(hashContent('RSV COM CAFE')).not.toBe(hashContent('RSV COM CAFÉ'));
  });

  it('marks every suggestion as requiring human confirmation', () => {
    const parsed = parseSourceNote(EXAMPLE);
    expect(parsed.suggestions.length).toBeGreaterThan(0);
    expect(parsed.suggestions.every((suggestion) => suggestion.requiresHumanConfirmation)).toBe(
      true,
    );
  });
});
