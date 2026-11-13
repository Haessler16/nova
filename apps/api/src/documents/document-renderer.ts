import type { DocumentContext } from './document-context';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function display(value: string | null | undefined): string {
  return value === null || value === undefined || value.trim() === '' ? '—' : value;
}

function formatCalendarDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-');
  return day !== undefined && month !== undefined && year !== undefined
    ? `${day}/${month}/${year}`
    : value;
}

function formatGeneratedAt(value: string, timezone: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(value));
}

function formatStayStatus(value: string): string {
  return value === 'IN_HOUSE'
    ? 'Em hospedagem'
    : value === 'CHECKED_OUT'
      ? 'Check-out realizado'
      : value;
}

function paragraphs(body: string): string[] {
  return body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

function rows(context: DocumentContext): Array<{ label: string; value: string }> {
  const reservation = context.reservation;
  return [
    { label: 'Estabelecimento', value: `${context.property.name} (${context.property.code})` },
    { label: 'Hóspede', value: context.guest.fullName },
    {
      label: 'Documento',
      value:
        context.guest.documentType === null
          ? 'Não informado'
          : `${context.guest.documentType} ${display(context.guest.documentNumberMasked)}`,
    },
    { label: 'Contato', value: display(context.guest.email ?? context.guest.phone) },
    { label: 'Reserva', value: reservation.code },
    {
      label: 'Período',
      value: `${formatCalendarDate(reservation.checkInDate)} a ${formatCalendarDate(reservation.checkOutDate)}`,
    },
    { label: 'Noites', value: String(reservation.nights) },
    {
      label: 'Ocupação',
      value: `${reservation.adults} adulto(s) · ${reservation.children} criança(s)`,
    },
    {
      label: 'Acomodação',
      value: `${reservation.roomType}${reservation.roomNumber !== null ? ` · Hab. ${reservation.roomNumber}` : ''}`,
    },
    ...(context.stay !== null
      ? [
          {
            label: 'Check-in',
            value: `${formatGeneratedAt(context.stay.checkedInAt, context.property.timezone)} · ${formatStayStatus(context.stay.status)}`,
          },
        ]
      : []),
  ];
}

function section(title: string, content: string): string {
  return `<section class="section"><h2>${escapeHtml(title)}</h2>${content}</section>`;
}

/**
 * Server-controlled A4 HTML. Templates contribute plain text only, so no
 * untrusted HTML reaches the preview document.
 */
export function renderDocumentHtml(context: DocumentContext): string {
  const rowsHtml = rows(context)
    .map(
      (row) =>
        `<div class="row"><dt>${escapeHtml(row.label)}</dt><dd>${escapeHtml(row.value)}</dd></div>`,
    )
    .join('');

  const bodyHtml = paragraphs(context.template.body)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join('');

  const numberLabel =
    context.document.number === null
      ? 'Prévia — documento não emitido'
      : `Documento ${context.document.number}`;

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(context.document.title)}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #eef1f5; color: #1d2733; font: 13px/1.5 Arial, Helvetica, sans-serif; }
    .sheet { width: min(210mm, 100%); min-height: min(297mm, 100vh); margin: 16px auto; padding: clamp(16px, 6vw, 18mm); background: #fff; box-shadow: 0 2px 12px rgba(16, 32, 48, .16); }
    .brand { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #1f4b6e; padding-bottom: 12px; }
    .brand strong { display: block; font-size: 17px; letter-spacing: .04em; }
    .brand span, .meta { color: #5b6572; font-size: 11px; }
    h1 { margin: 22px 0 4px; font-size: 22px; }
    h2 { margin: 0 0 8px; font-size: 14px; color: #1f4b6e; }
    .meta { margin-bottom: 18px; }
    .section { margin-top: 18px; }
    dl { display: grid; grid-template-columns: 34mm 1fr; gap: 4px 10px; margin: 0; }
    .row { display: contents; }
    dt { color: #5b6572; }
    dd { margin: 0; overflow-wrap: anywhere; }
    p { margin: 0 0 9px; text-align: justify; }
    .empty { color: #7a8491; font-style: italic; }
    .signature { display: grid; grid-template-columns: 1fr 1fr; gap: 18mm; margin-top: 42px; }
    .line { border-top: 1px solid #1d2733; padding-top: 5px; color: #5b6572; font-size: 11px; }
    .note { margin-top: 30px; color: #6a7480; font-size: 10px; }
    @page { size: A4; margin: 18mm; }
    @media print {
      body { background: #fff; }
      .sheet { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
    }
  </style>
</head>
<body>
  <main class="sheet">
    <header class="brand">
      <div><strong>${escapeHtml(context.property.name)}</strong><span>Código ${escapeHtml(context.property.code)}</span></div>
      <div class="meta">${escapeHtml(numberLabel)}<br />Versão ${context.document.templateVersion} · ${escapeHtml(context.document.locale)}</div>
    </header>
    <h1>${escapeHtml(context.document.title)}</h1>
    <div class="meta">Emitido em ${escapeHtml(formatGeneratedAt(context.document.generatedAt, context.property.timezone))}</div>
    ${section('Dados da hospedagem', `<dl>${rowsHtml}</dl>`)}
    ${bodyHtml.length > 0 ? section('Declaração e condições', bodyHtml) : ''}
    ${
      context.signatureRequired
        ? `<div class="signature"><div class="line">Assinatura do hóspede</div><div class="line">Recebido por / data</div></div>`
        : ''
    }
    <p class="note">Documento gerado pelo NOVA PMS. A assinatura física, quando exigida, é registrada separadamente pela recepção. Este documento não comprova impressão física por si só.</p>
  </main>
</body>
</html>`;
}
