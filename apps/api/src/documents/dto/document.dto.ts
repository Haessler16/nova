import { DocumentPrintEventType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { DOCUMENT_LOCALES, DOCUMENT_TYPES, DocumentType } from '../document-context';

export class ListDocumentTemplatesQueryDto {
  @IsOptional()
  @IsIn(DOCUMENT_TYPES)
  type?: DocumentType;
}

export class DocumentSourceDto {
  @IsUUID()
  reservationId!: string;

  @IsOptional()
  @IsUUID()
  guestId?: string;

  @IsOptional()
  @IsIn(DOCUMENT_LOCALES)
  locale?: (typeof DOCUMENT_LOCALES)[number];

  @IsOptional()
  @IsUUID()
  templateId?: string;
}

export class PreviewDocumentDto extends DocumentSourceDto {
  @IsIn(DOCUMENT_TYPES)
  type!: DocumentType;
}

export class GenerateDocumentDto extends PreviewDocumentDto {}

export class ListDocumentsQueryDto {
  @IsOptional()
  @IsUUID()
  reservationId?: string;

  @IsOptional()
  @IsUUID()
  guestId?: string;

  @IsOptional()
  @IsUUID()
  stayId?: string;

  @IsOptional()
  @IsIn(DOCUMENT_TYPES)
  documentType?: DocumentType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class RegisterPhysicalSignatureDto {
  @IsOptional()
  @IsISO8601()
  receivedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class CreatePrintEventDto {
  @IsEnum(DocumentPrintEventType)
  type!: DocumentPrintEventType;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  note?: string;
}
