import { GuestDocumentType } from '@prisma/client';
import { GUEST_IMPORT_MAX_ROWS, GuestImportFormatError, parseGuestCsv } from './guest-import';

describe('parseGuestCsv', () => {
  it('parses quoted names, a BOM and normalized values', () => {
    const preview = parseGuestCsv(
      '\uFEFFfullName,email,phone,documentType,documentNumber,notes\n"Silva, Ana",ANA@Example.test,+55 11 90000-0001,passport,ab123456,"Nota, con coma"\n',
    );

    expect(preview.totalRows).toBe(1);
    expect(preview.invalidRows).toBe(0);
    expect(preview.rows[0]?.values).toEqual({
      fullName: 'Silva, Ana',
      email: 'ana@example.test',
      phone: '+55 11 90000-0001',
      documentType: GuestDocumentType.PASSPORT,
      documentNumber: 'AB123456',
      notes: 'Nota, con coma',
    });
  });

  it('detects semicolon-separated files', () => {
    const preview = parseGuestCsv('fullName;email\nAna Silva;ana@example.test\n');

    expect(preview.totalRows).toBe(1);
    expect(preview.rows[0]?.values.fullName).toBe('Ana Silva');
    expect(preview.rows[0]?.values.email).toBe('ana@example.test');
  });

  it('reports invalid rows instead of dropping them', () => {
    const preview = parseGuestCsv(
      'fullName,email,phone,documentType,documentNumber\nAna,not-an-email,12,PASSPORT,AB\n',
    );

    expect(preview.invalidRows).toBe(1);
    expect(preview.validRows).toBe(0);
    expect(preview.rows[0]?.errors).toEqual(
      expect.arrayContaining([
        'email no es válido.',
        'phone no tiene un formato válido.',
        'documentNumber debe tener entre 3 y 64 caracteres.',
      ]),
    );
  });

  it('rejects documents duplicated inside the file', () => {
    const preview = parseGuestCsv(
      [
        'fullName,documentType,documentNumber',
        'Ana Silva,PASSPORT,AB123456',
        'Ana Duplicada,PASSPORT,AB123456',
      ].join('\n'),
    );

    expect(preview.invalidRows).toBe(1);
    expect(preview.rows[1]?.errors.join(' ')).toContain('documento duplicado');
  });

  it('requires the fullName column', () => {
    expect(() => parseGuestCsv('email\nana@example.test\n')).toThrow(GuestImportFormatError);
    try {
      parseGuestCsv('email\nana@example.test\n');
    } catch (error) {
      expect((error as GuestImportFormatError).code).toBe('guest_import_missing_column');
    }
  });

  it('enforces the row limit', () => {
    const rows = Array.from(
      { length: GUEST_IMPORT_MAX_ROWS + 1 },
      (_, index) => `Huésped ${index}`,
    );

    expect(() => parseGuestCsv(['fullName', ...rows].join('\n'))).toThrow(GuestImportFormatError);
  });

  it('rejects unterminated quotes', () => {
    expect(() => parseGuestCsv('fullName\n"Ana\n')).toThrow(GuestImportFormatError);
  });
});
