import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PERMISSIONS } from '../access/permissions';
import { AuthenticationGuard } from '../auth/authentication.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { Tenant } from '../common/decorators/tenant.decorator';
import {
  DEV_USER_HEADER,
  ORGANIZATION_HEADER,
  PROPERTY_HEADER,
  TenantContext,
} from '../common/http/request-context';
import { PermissionsGuard } from '../tenancy/permissions.guard';
import { TenantContextGuard } from '../tenancy/tenant-context.guard';
import { DocumentsService } from './documents.service';
import {
  CreatePrintEventDto,
  GenerateDocumentDto,
  ListDocumentsQueryDto,
  ListDocumentTemplatesQueryDto,
  PreviewDocumentDto,
  RegisterPhysicalSignatureDto,
} from './dto/document.dto';

@ApiTags('documents')
@ApiHeader({ name: DEV_USER_HEADER, required: false })
@ApiHeader({ name: ORGANIZATION_HEADER, required: true })
@ApiHeader({ name: PROPERTY_HEADER, required: true })
@Controller('documents')
@UseGuards(AuthenticationGuard, TenantContextGuard, PermissionsGuard)
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get('templates')
  @RequirePermissions(PERMISSIONS.DOCUMENTS_READ)
  templates(@Tenant() tenant: TenantContext, @Query() query: ListDocumentTemplatesQueryDto) {
    return this.documents.templates(tenant, query);
  }

  @Post('preview')
  @RequirePermissions(PERMISSIONS.DOCUMENTS_GENERATE)
  preview(@Tenant() tenant: TenantContext, @Body() dto: PreviewDocumentDto) {
    return this.documents.preview(tenant, dto);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.DOCUMENTS_GENERATE)
  generate(@Tenant() tenant: TenantContext, @Body() dto: GenerateDocumentDto) {
    return this.documents.generate(tenant, dto);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.DOCUMENTS_READ)
  list(@Tenant() tenant: TenantContext, @Query() query: ListDocumentsQueryDto) {
    return this.documents.list(tenant, query);
  }

  @Get(':id/download')
  @RequirePermissions(PERMISSIONS.DOCUMENTS_READ)
  async download(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.documents.download(tenant, id);
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    response.setHeader('Content-Length', String(file.content.byteLength));
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Document-SHA256', file.sha256);
    response.send(file.content);
  }

  @Post(':id/physical-signature-received')
  @RequirePermissions(PERMISSIONS.DOCUMENTS_MANAGE)
  registerPhysicalSignature(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RegisterPhysicalSignatureDto,
  ) {
    return this.documents.registerPhysicalSignature(tenant, id, dto);
  }

  @Post(':id/print-events')
  @RequirePermissions(PERMISSIONS.DOCUMENTS_MANAGE)
  createPrintEvent(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreatePrintEventDto,
  ) {
    return this.documents.createPrintEvent(tenant, id, dto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.DOCUMENTS_READ)
  get(@Tenant() tenant: TenantContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.documents.get(tenant, id);
  }
}
