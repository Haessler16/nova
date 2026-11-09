/**
 * Minimal RFC 4180 writer with two deliberate protections:
 * - UTF-8 BOM so Excel opens accented text correctly;
 * - formula-injection guard for text cells that start with =, +, - or @.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  let text = value instanceof Date ? value.toISOString() : String(value);

  if (typeof value === 'string' && /^[=+\-@]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) {
    text = `'${text}`;
  }

  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(
  headers: readonly string[],
  rows: ReadonlyArray<ReadonlyArray<unknown>>,
): string {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(','));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
