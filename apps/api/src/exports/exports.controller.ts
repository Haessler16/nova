import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
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
import {
  ExportFoliosQueryDto,
  ExportGuestsQueryDto,
  ExportReservationsQueryDto,
} from './dto/export.dto';
import { CsvExport, ExportsService } from './exports.service';

@ApiTags('exports')
@ApiHeader({ name: DEV_USER_HEADER, required: false })
@ApiHeader({ name: ORGANIZATION_HEADER, required: true })
@ApiHeader({ name: PROPERTY_HEADER, required: true })
@Controller('exports')
@UseGuards(AuthenticationGuard, TenantContextGuard, PermissionsGuard)
export class ExportsController {
  constructor(private readonly csvExports: ExportsService) {}

  @Get('guests')
  @RequirePermissions(PERMISSIONS.GUESTS_READ)
  async guests(
    @Tenant() tenant: TenantContext,
    @Query() query: ExportGuestsQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<string> {
    return this.send(tenant, await this.csvExports.guests(tenant, query), response, 'guests');
  }

  @Get('reservations')
  @RequirePermissions(PERMISSIONS.RESERVATIONS_READ)
  async reservations(
    @Tenant() tenant: TenantContext,
    @Query() query: ExportReservationsQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<string> {
    return this.send(
      tenant,
      await this.csvExports.reservations(tenant, query),
      response,
      'reservations',
    );
  }

  @Get('folios')
  @RequirePermissions(PERMISSIONS.FOLIO_READ)
  async folios(
    @Tenant() tenant: TenantContext,
    @Query() query: ExportFoliosQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<string> {
    return this.send(tenant, await this.csvExports.folios(tenant, query), response, 'folios');
  }

  private async send(
    tenant: TenantContext,
    result: CsvExport,
    response: Response,
    name: string,
  ): Promise<string> {
    const date = await this.csvExports.filenameDate(tenant);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="nova-${name}-${date}.csv"`);
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    return result.csv;
  }
}
