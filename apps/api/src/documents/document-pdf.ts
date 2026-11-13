import PDFDocument from 'pdfkit';
import type { DocumentContext } from './document-context';

export interface RenderedPdf {
  buffer: Buffer;
  pageCount: number;
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

function display(value: string | null | undefined): string {
  return value === null || value === undefined || value.trim() === '' ? '—' : value;
}

function documentRows(context: DocumentContext): Array<{ label: string; value: string }> {
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

/**
 * PDFKit with the built-in Helvetica family; no browser, headless Chromium or
 * external font file is required. The template body is plain text, never HTML.
 */
export async function renderDocumentPdf(context: DocumentContext): Promise<RenderedPdf> {
  const document = new PDFDocument({
    size: 'A4',
    margins: { top: 48, bottom: 52, left: 52, right: 52 },
    bufferPages: true,
    info: {
      Title: context.document.title,
      Author: context.property.name,
      Subject: `NOVA PMS ${context.document.type} v${context.document.templateVersion}`,
      Creator: 'NOVA PMS',
    },
  });

  const chunks: Buffer[] = [];
  document.on('data', (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<Buffer>((resolve, reject) => {
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);
  });

  const left = document.page.margins.left;
  const contentWidth =
    document.page.width - document.page.margins.left - document.page.margins.right;
  const bottomLimit = document.page.height - document.page.margins.bottom - 24;

  const ensureSpace = (height: number): void => {
    if (document.y + height > bottomLimit) {
      document.addPage();
      document.y = document.page.margins.top;
    }
  };

  const sectionTitle = (title: string): void => {
    ensureSpace(28);
    document.moveDown(0.8);
    document.font('Helvetica-Bold').fontSize(12).fillColor('#1f4b6e').text(title);
    document.moveDown(0.35);
    document.fillColor('#1d2733');
  };

  document.font('Helvetica-Bold').fontSize(15).fillColor('#1f4b6e');
  document.text(context.property.name);
  document.font('Helvetica').fontSize(9).fillColor('#5b6572');
  document.text(`Código ${context.property.code}`);
  document.moveDown(0.4);
  document
    .moveTo(left, document.y)
    .lineTo(left + contentWidth, document.y)
    .lineWidth(1.5)
    .strokeColor('#1f4b6e')
    .stroke();
  document.moveDown(1.2);

  document.font('Helvetica-Bold').fontSize(19).fillColor('#1d2733');
  document.text(context.document.title);
  document.font('Helvetica').fontSize(9).fillColor('#5b6572');
  document.text(
    `${
      context.document.number === null
        ? 'Prévia — documento não emitido'
        : `Documento ${context.document.number}`
    } · Versão ${context.document.templateVersion} · ${context.document.locale}`,
  );
  document.text(
    `Emitido em ${formatGeneratedAt(context.document.generatedAt, context.property.timezone)}`,
  );
  document.moveDown(0.6);

  sectionTitle('Dados da hospedagem');
  const labelWidth = 105;
  for (const row of documentRows(context)) {
    ensureSpace(22);
    document.font('Helvetica-Bold').fontSize(9).fillColor('#5b6572');
    const labelY = document.y;
    document.text(row.label, left, labelY, { width: labelWidth });
    document.font('Helvetica').fontSize(9.5).fillColor('#1d2733');
    document.text(row.value, left + labelWidth, labelY, {
      width: contentWidth - labelWidth,
      lineGap: 1,
    });
    document.moveDown(0.35);
  }

  const bodyParagraphs = context.template.body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);

  if (bodyParagraphs.length > 0) {
    sectionTitle('Declaração e condições');
    document.font('Helvetica').fontSize(10).fillColor('#1d2733');
    for (const paragraph of bodyParagraphs) {
      ensureSpace(36);
      document.text(paragraph, { width: contentWidth, align: 'justify', lineGap: 2 });
      document.moveDown(0.55);
    }
  }

  if (context.signatureRequired) {
    ensureSpace(78);
    document.moveDown(2.2);
    const lineWidth = (contentWidth - 36) / 2;
    const signatureY = document.y;
    document
      .moveTo(left, signatureY)
      .lineTo(left + lineWidth, signatureY)
      .lineWidth(0.7)
      .strokeColor('#1d2733')
      .stroke();
    document
      .moveTo(left + lineWidth + 36, signatureY)
      .lineTo(left + contentWidth, signatureY)
      .lineWidth(0.7)
      .strokeColor('#1d2733')
      .stroke();
    document.font('Helvetica').fontSize(8).fillColor('#5b6572');
    document.text('Assinatura do hóspede', left, signatureY + 5, { width: lineWidth });
    document.text('Recebido por / data', left + lineWidth + 36, signatureY + 5, {
      width: lineWidth,
    });
    document.y = signatureY + 28;
  }

  ensureSpace(34);
  document.moveDown(1.2);
  document
    .font('Helvetica')
    .fontSize(7.5)
    .fillColor('#6a7480')
    .text(
      'Documento gerado pelo NOVA PMS. A assinatura física, quando exigida, é registrada separadamente pela recepção. Este documento não comprova impressão física por si só.',
      { width: contentWidth, align: 'left' },
    );

  const range = document.bufferedPageRange();
  const originalBottomMargin = document.page.margins.bottom;
  for (let index = range.start; index < range.start + range.count; index += 1) {
    document.switchToPage(index);
    // The footer sits inside the bottom margin. Removing the margin while
    // drawing it prevents PDFKit from auto-creating a blank page.
    document.page.margins.bottom = 0;
    document
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor('#7a8491')
      .text(`Página ${index + 1} de ${range.count}`, left, document.page.height - 28, {
        width: contentWidth,
        align: 'center',
        lineBreak: false,
      });
    document.page.margins.bottom = originalBottomMargin;
  }

  document.end();
  const buffer = await finished;

  return { buffer, pageCount: range.count };
}
