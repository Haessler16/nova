import { csvCell, toCsv } from './csv';

describe('CSV export helpers', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('Silva, Ana')).toBe('"Silva, Ana"');
    expect(csvCell('Ana "Nina"')).toBe('"Ana ""Nina"""');
    expect(csvCell('linea 1\nlinea 2')).toBe('"linea 1\nlinea 2"');
  });

  it('adds a UTF-8 BOM, headers and CRLF line endings', () => {
    const csv = toCsv(['name', 'email'], [['Ana', 'ana@example.test']]);

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('name,email\r\n');
    expect(csv).toContain('Ana,ana@example.test\r\n');
  });

  it('neutralizes spreadsheet formulas without breaking numbers', () => {
    expect(csvCell('=HYPERLINK("http://evil.test")')).toContain("'=HYPERLINK");
    expect(csvCell('@SUM(A1)')).toContain("'@SUM");
    expect(csvCell('-12.50')).toBe('-12.50');
  });

  it('renders null and dates predictably', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(new Date('2026-11-09T12:00:00.000Z'))).toBe('2026-11-09T12:00:00.000Z');
  });
});
