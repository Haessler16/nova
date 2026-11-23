import { GuestDocumentType } from '@prisma/client';

export const GUEST_IMPORT_MAX_BYTES = 512 * 1024;
export const GUEST_IMPORT_MAX_ROWS = 500;

const HEADERS = ['fullName', 'email', 'phone', 'documentType', 'documentNumber', 'notes'] as const;

type Header = (typeof HEADERS)[number];

const DOCUMENT_TYPES: Record<string, GuestDocumentType> = {
  CPF: GuestDocumentType.CPF,
  PASSPORT: GuestDocumentType.PASSPORT,
  RG: GuestDocumentType.RG,
  NATIONAL_ID: GuestDocumentType.NATIONAL_ID,
  DRIVER_LICENSE: GuestDocumentType.DRIVER_LICENSE,
  OTHER: GuestDocumentType.OTHER,
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9 ()-]{6,32}$/;

export interface GuestImportValues {
  fullName: string;
  email: string | null;
  phone: string | null;
  documentType: GuestDocumentType | null;
  documentNumber: string | null;
  notes: string | null;
}

export interface GuestImportRow {
  line: number;
  values: GuestImportValues;
  errors: string[];
}

export interface GuestImportPreview {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: GuestImportRow[];
}

/** Invalid CSV structure (as opposed to invalid individual rows). */
export class GuestImportFormatError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'GuestImportFormatError';
  }
}

/**
 * Strict, dependency-free CSV reader for the guest import. It supports comma
 * and semicolon delimiters, quoted fields with escaped quotes, and quoted
 * newlines. Validation mirrors CreateGuestDto; the backend re-parses on commit
 * and never trusts a previous preview.
 */
export function parseGuestCsv(csv: string): GuestImportPreview {
  if (Buffer.byteLength(csv, 'utf8') > GUEST_IMPORT_MAX_BYTES) {
    throw new GuestImportFormatError(
      'guest_import_too_large',
      'El archivo supera el límite de 512 KB.',
    );
  }

  const text = csv.replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(firstLine(text));
  const records = splitRecords(text, delimiter);

  if (records.length === 0) {
    throw new GuestImportFormatError('guest_import_empty', 'El archivo está vacío.');
  }

  const headerCells = records[0].cells.map((cell) => cell.trim());
  for (const header of headerCells) {
    if (!isHeader(header)) {
      throw new GuestImportFormatError(
        'guest_import_unknown_column',
        `Columna desconocida "${header}". Usá: ${HEADERS.join(', ')}.`,
      );
    }
  }
  if (new Set(headerCells).size !== headerCells.length) {
    throw new GuestImportFormatError(
      'guest_import_duplicate_column',
      'El encabezado repite una columna.',
    );
  }
  if (!headerCells.includes('fullName')) {
    throw new GuestImportFormatError(
      'guest_import_missing_column',
      'Falta la columna obligatoria fullName.',
    );
  }

  const indexByHeader = new Map<Header, number>();
  headerCells.forEach((header, index) => indexByHeader.set(header as Header, index));

  const dataRecords = records
    .slice(1)
    .filter((record) => record.cells.some((cell) => cell.trim() !== ''));

  if (dataRecords.length === 0) {
    throw new GuestImportFormatError(
      'guest_import_empty',
      'El archivo no tiene filas de datos además del encabezado.',
    );
  }
  if (dataRecords.length > GUEST_IMPORT_MAX_ROWS) {
    throw new GuestImportFormatError(
      'guest_import_too_many_rows',
      `El archivo supera el límite de ${GUEST_IMPORT_MAX_ROWS} filas.`,
    );
  }

  const seenDocuments = new Map<string, number>();
  const rows = dataRecords.map((record): GuestImportRow => {
    const errors: string[] = [];
    if (record.cells.length > headerCells.length) {
      errors.push('La fila tiene más columnas que el encabezado.');
    }

    const read = (header: Header): string => {
      const index = indexByHeader.get(header);
      return index === undefined ? '' : (record.cells[index] ?? '').trim();
    };

    const fullName = read('fullName');
    const email = read('email');
    const phone = read('phone');
    const documentTypeRaw = read('documentType').toUpperCase();
    const documentNumberRaw = read('documentNumber').toUpperCase();
    const notes = read('notes');

    if (fullName.length < 2 || fullName.length > 160) {
      errors.push('fullName debe tener entre 2 y 160 caracteres.');
    }
    if (email !== '' && (email.length > 254 || !EMAIL_PATTERN.test(email))) {
      errors.push('email no es válido.');
    }
    if (phone !== '' && !PHONE_PATTERN.test(phone)) {
      errors.push('phone no tiene un formato válido.');
    }
    if (notes.length > 2000) {
      errors.push('notes supera 2000 caracteres.');
    }

    const document = parseDocumentFields(documentTypeRaw, documentNumberRaw);
    errors.push(...document.errors);
    const duplicate = registerDocument(document.type, document.number, record.line, seenDocuments);
    if (duplicate !== null) {
      errors.push(duplicate);
    }

    return {
      line: record.line,
      values: {
        fullName,
        email: email === '' ? null : email.toLowerCase(),
        phone: phone === '' ? null : phone,
        documentType: document.type,
        documentNumber: document.number,
        notes: notes === '' ? null : notes,
      },
      errors,
    };
  });

  return {
    totalRows: rows.length,
    validRows: rows.filter((row) => row.errors.length === 0).length,
    invalidRows: rows.filter((row) => row.errors.length > 0).length,
    rows,
  };
}

interface ParsedDocumentFields {
  type: GuestDocumentType | null;
  number: string | null;
  errors: string[];
}

/** Document columns are optional, but they must be informed as a pair. */
function parseDocumentFields(
  documentTypeRaw: string,
  documentNumberRaw: string,
): ParsedDocumentFields {
  const errors: string[] = [];

  let type: GuestDocumentType | null = null;
  if (documentTypeRaw !== '') {
    const mapped = DOCUMENT_TYPES[documentTypeRaw];
    if (mapped === undefined) {
      errors.push('documentType debe ser CPF, PASSPORT, RG, NATIONAL_ID, DRIVER_LICENSE u OTHER.');
    } else {
      type = mapped;
    }
  }

  let number: string | null = null;
  if (documentNumberRaw !== '') {
    if (documentNumberRaw.length < 3 || documentNumberRaw.length > 64) {
      errors.push('documentNumber debe tener entre 3 y 64 caracteres.');
    } else {
      number = documentNumberRaw;
    }
  }

  if ((type === null) !== (number === null)) {
    errors.push('documentType y documentNumber deben informarse juntos.');
  }

  return { type, number, errors };
}

/** Returns the duplicate error message instead of pushing, so the caller decides. */
function registerDocument(
  type: GuestDocumentType | null,
  number: string | null,
  line: number,
  seenDocuments: Map<string, number>,
): string | null {
  if (type === null || number === null) {
    return null;
  }

  const key = `${type}:${number}`;
  const previousLine = seenDocuments.get(key);
  if (previousLine !== undefined) {
    return `documento duplicado en el archivo (también en la línea ${previousLine}).`;
  }
  seenDocuments.set(key, line);
  return null;
}

function isHeader(value: string): value is Header {
  return (HEADERS as readonly string[]).includes(value);
}

function firstLine(text: string): string {
  const index = text.search(/\r?\n/);
  return index === -1 ? text : text.slice(0, index);
}

function detectDelimiter(line: string): ',' | ';' {
  const commas = (line.match(/,/g) ?? []).length;
  const semicolons = (line.match(/;/g) ?? []).length;
  return semicolons > commas ? ';' : ',';
}

function splitRecords(
  text: string,
  delimiter: ',' | ';',
): Array<{ line: number; cells: string[] }> {
  const records: Array<{ line: number; cells: string[] }> = [];
  let cells: string[] = [];
  let field = '';
  let inQuotes = false;
  let line = 1;
  let recordLine = 1;
  let started = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        if (char === '\n') {
          line += 1;
        }
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      started = true;
      continue;
    }
    if (char === delimiter) {
      cells.push(field);
      field = '';
      started = true;
      continue;
    }
    if (char === '\n') {
      cells.push(field);
      if (started || cells.some((cell) => cell.trim() !== '')) {
        records.push({ line: recordLine, cells });
      }
      cells = [];
      field = '';
      started = false;
      line += 1;
      recordLine = line;
      continue;
    }
    if (char === '\r') {
      continue;
    }
    field += char;
    started = true;
  }

  if (inQuotes) {
    throw new GuestImportFormatError(
      'guest_import_unterminated_quote',
      'El CSV tiene comillas sin cerrar.',
    );
  }

  cells.push(field);
  if (started || cells.some((cell) => cell.trim() !== '')) {
    records.push({ line: recordLine, cells });
  }

  return records;
}
