import PDFDocument from 'pdfkit';
import type { ReportCellFormat, ReportResult } from './report-definitions';

export interface RenderedReportPdf {
  buffer: Buffer;
  pageCount: number;
}

function formatValue(
  value: string | number | null | undefined,
  format: ReportCellFormat,
  currencyCode: string,
): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  if (format === 'currency') {
    const amount = Number(value);
    return Number.isFinite(amount)
      ? new Intl.NumberFormat('es-AR', {
          style: 'currency',
          currency: currencyCode,
          minimumFractionDigits: 2,
        }).format(amount)
      : String(value);
  }
  if (format === 'percent') {
    const amount = Number(value);
    return Number.isFinite(amount) ? `${amount.toFixed(2)}%` : String(value);
  }
  if (format === 'number') {
    const amount = Number(value);
    return Number.isFinite(amount)
      ? new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(amount)
      : String(value);
  }
  if (format === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    const [year, month, day] = String(value).split('-');
    return `${day}/${month}/${year}`;
  }
  return String(value);
}

function formatCalendarDate(value: string): string {
  const [year, month, day] = value.split('-');
  return day !== undefined && month !== undefined && year !== undefined
    ? `${day}/${month}/${year}`
    : value;
}

function formatGeneratedAt(value: string, timezone: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(value));
}

/**
 * PDFKit with a fixed landscape A4 layout. Reports never render user HTML and
 * cell values are plain text. The report definition supplies relative widths so
 * tables with many columns stay readable without a client-side layout engine.
 */
export async function renderReportPdf(result: ReportResult): Promise<RenderedReportPdf> {
  const document = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margins: { top: 36, bottom: 42, left: 36, right: 36 },
    bufferPages: true,
    info: {
      Title: result.title,
      Author: result.property.name,
      Subject: `NOVA PMS report ${result.reportKey}`,
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
  const bottomLimit = document.page.height - document.page.margins.bottom - 20;
  const rowHeight = 15;
  const headerHeight = 17;

  const weights = result.columns.map((column) => column.width ?? 1);
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  const widths = weights.map((weight) => (weight / totalWeight) * contentWidth);
  const columnX = widths.map((_, index) =>
    widths.slice(0, index).reduce((total, width) => total + width, 0),
  );

  const drawPageHeader = (): void => {
    document.font('Helvetica-Bold').fontSize(13).fillColor('#1f4b6e');
    document.text(result.property.name, left, document.y, { width: contentWidth });
    document.font('Helvetica').fontSize(8).fillColor('#5b6572');
    document.text(
      `${result.property.code} · ${result.title} · ${formatCalendarDate(result.filters.from)} a ${formatCalendarDate(result.filters.to)} · ${result.timezone}`,
      left,
      document.y,
      { width: contentWidth },
    );
    document.moveDown(0.7);
    document
      .moveTo(left, document.y)
      .lineTo(left + contentWidth, document.y)
      .lineWidth(1)
      .strokeColor('#1f4b6e')
      .stroke();
    document.moveDown(0.8);
  };

  const drawTableHeader = (): void => {
    const y = document.y;
    document.save().rect(left, y, contentWidth, headerHeight).fill('#eaf3f9').restore();
    document.font('Helvetica-Bold').fontSize(7).fillColor('#1f4b6e');
    result.columns.forEach((column, index) => {
      document.text(column.label, left + columnX[index] + 3, y + 4, {
        width: widths[index] - 6,
        height: 9,
        lineBreak: false,
        ellipsis: true,
        align: column.align === 'right' ? 'right' : 'left',
      });
    });
    document.y = y + headerHeight;
    document.fillColor('#1d2733');
  };

  const ensureSpace = (height: number): void => {
    if (document.y + height > bottomLimit) {
      document.addPage();
      document.y = document.page.margins.top;
      drawPageHeader();
      drawTableHeader();
    }
  };

  drawPageHeader();

  document.font('Helvetica-Bold').fontSize(18).fillColor('#1d2733');
  document.text(result.title);
  document.font('Helvetica').fontSize(8).fillColor('#5b6572');
  document.text(result.description, { width: contentWidth });
  document.moveDown(0.4);
  document.text(
    `Generado ${formatGeneratedAt(result.generatedAt, result.timezone)} · ${result.totalRows} fila(s) · página ${result.page} de ${result.totalPages || 1}`,
    { width: contentWidth },
  );
  document.moveDown(0.8);

  const summaryColumns = 4;
  const summaryWidth = contentWidth / summaryColumns;
  result.summary.forEach((item, index) => {
    const column = index % summaryColumns;
    if (column === 0) {
      ensureSpace(28);
    }
    const y = document.y;
    const x = left + column * summaryWidth;
    document.font('Helvetica').fontSize(6.5).fillColor('#5b6572');
    document.text(item.label.toUpperCase(), x, y, {
      width: summaryWidth - 8,
      height: 8,
      lineBreak: false,
      ellipsis: true,
    });
    document.font('Helvetica-Bold').fontSize(9).fillColor('#1d2733');
    document.text(formatValue(item.value, item.format, result.currencyCode), x, y + 9, {
      width: summaryWidth - 8,
      height: 11,
      lineBreak: false,
      ellipsis: true,
    });
    if (column === summaryColumns - 1 || index === result.summary.length - 1) {
      document.y = y + 25;
    }
  });

  if (result.summary.length > 0) {
    document.moveDown(0.2);
  }

  ensureSpace(headerHeight + rowHeight);
  drawTableHeader();

  for (const row of result.rows) {
    ensureSpace(rowHeight);
    const y = document.y;
    if (Math.round((y - document.page.margins.top) / rowHeight) % 2 === 0) {
      document.save().rect(left, y, contentWidth, rowHeight).fill('#fafcfd').restore();
    }
    result.columns.forEach((column, index) => {
      const value = formatValue(row[column.key], column.format, result.currencyCode);
      document.font('Helvetica').fontSize(7).fillColor('#1d2733');
      document.text(value, left + columnX[index] + 3, y + 4, {
        width: widths[index] - 6,
        height: 9,
        lineBreak: false,
        ellipsis: true,
        align: column.align === 'right' ? 'right' : 'left',
      });
    });
    document.y = y + rowHeight;
  }

  if (result.rows.length === 0) {
    document.moveDown(0.8);
    document.font('Helvetica').fontSize(8).fillColor('#5b6572');
    document.text('No hay datos para los filtros seleccionados.', { width: contentWidth });
  }

  document.moveDown(0.7);
  document.font('Helvetica').fontSize(6.5).fillColor('#6a7480');
  document.text(
    'Reporte generado por NOVA PMS. Las cifras de caja provienen de movimientos de efectivo; los pagos registrados por otros medios se muestran por separado y no equivalen a efectivo recibido. La ocupación se calcula al cierre de cada día de la propiedad.',
    { width: contentWidth, align: 'left' },
  );

  const range = document.bufferedPageRange();
  const originalBottomMargin = document.page.margins.bottom;
  for (let index = range.start; index < range.start + range.count; index += 1) {
    document.switchToPage(index);
    document.page.margins.bottom = 0;
    document
      .font('Helvetica')
      .fontSize(7)
      .fillColor('#7a8491')
      .text(`Página ${index + 1} de ${range.count}`, left, document.page.height - 22, {
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
