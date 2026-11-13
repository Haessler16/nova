import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
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
import { ExportReportDto, RunReportDto } from './dto/report.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiHeader({ name: DEV_USER_HEADER, required: false })
@ApiHeader({ name: ORGANIZATION_HEADER, required: true })
@ApiHeader({ name: PROPERTY_HEADER, required: true })
@Controller('reports')
@UseGuards(AuthenticationGuard, TenantContextGuard, PermissionsGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.REPORTS_READ)
  catalog(@Tenant() tenant: TenantContext) {
    return this.reports.catalog(tenant);
  }

  @Get('executions')
  @RequirePermissions(PERMISSIONS.REPORTS_READ)
  history(@Tenant() tenant: TenantContext) {
    return this.reports.history(tenant);
  }

  @Post(':reportKey/run')
  @RequirePermissions(PERMISSIONS.REPORTS_READ)
  run(
    @Tenant() tenant: TenantContext,
    @Param('reportKey') reportKey: string,
    @Body() dto: RunReportDto,
  ) {
    return this.reports.run(tenant, reportKey, dto);
  }

  @Post(':reportKey/exports')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.REPORTS_READ)
  async export(
    @Tenant() tenant: TenantContext,
    @Param('reportKey') reportKey: string,
    @Body() dto: ExportReportDto,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.reports.export(tenant, reportKey, dto);
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    response.setHeader('Content-Length', String(file.content.byteLength));
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.send(file.content);
  }
}
