import type { DocumentContext } from './document-context';
import { renderDocumentHtml } from './document-renderer';

function context(overrides: Partial<DocumentContext> = {}): DocumentContext {
  return {
    schemaVersion: 1,
    document: {
      number: 'DOC-20261113-ABCDEF123456',
      type: 'GUEST_REGISTRATION',
      typeLabel: 'Ficha de registro de hóspede',
      title: 'Ficha de registro de hóspede',
      locale: 'pt-BR',
      templateVersion: 1,
      generatedAt: '2026-11-13T12:00:00.000Z',
    },
    template: {
      id: '00000000-0000-4000-8000-000000000001',
      key: 'GUEST_REGISTRATION',
      version: 1,
      title: 'Ficha de registro de hóspede',
      body: 'Declaro que as informações estão corretas.',
    },
    property: {
      id: '00000000-0000-4000-8000-000000000002',
      name: 'Hotel Centro',
      code: 'CENTRO',
      timezone: 'America/Sao_Paulo',
      currencyCode: 'BRL',
    },
    guest: {
      fullName: 'Ana Souza',
      documentType: 'PASSPORT',
      documentNumberMasked: '•••• 1234',
      email: 'ana@example.test',
      phone: null,
    },
    reservation: {
      id: '00000000-0000-4000-8000-000000000003',
      code: 'RES-001',
      status: 'CONFIRMED',
      checkInDate: '2026-11-13',
      checkOutDate: '2026-11-15',
      nights: 2,
      adults: 1,
      children: 0,
      roomType: 'Standard',
      roomNumber: '101',
    },
    stay: null,
    signatureRequired: true,
    ...overrides,
  };
}

describe('renderDocumentHtml', () => {
  it('escapes guest, property and template text instead of emitting markup', () => {
    const html = renderDocumentHtml(
      context({
        property: {
          ...context().property,
          name: '<script>alert("property")</script>',
        },
        guest: {
          ...context().guest,
          fullName: '<img src=x onerror="alert(1)">',
        },
        template: {
          ...context().template,
          title: '</title><script>alert("title")</script>',
          body: 'Olá <b>mundo</b>',
        },
      }),
    );

    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>mundo</b>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    expect(html).toContain('Olá &lt;b&gt;mundo&lt;/b&gt;');
  });

  it('shows placeholders for missing optional contact data and respects the signature flag', () => {
    const withoutContact = renderDocumentHtml(
      context({
        guest: {
          ...context().guest,
          email: null,
          phone: null,
          documentType: null,
          documentNumberMasked: null,
        },
        signatureRequired: false,
      }),
    );

    expect(withoutContact).toContain('<dd>—</dd>');
    expect(withoutContact).toContain('Não informado');
    expect(withoutContact).not.toContain('Assinatura do hóspede');

    const withSignature = renderDocumentHtml(context());
    expect(withSignature).toContain('Assinatura do hóspede');
  });
});
