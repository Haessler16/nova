import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
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
import { CashService } from './cash.service';
import {
  AddFolioChargeDto,
  CancelFolioDto,
  CloseCashSessionDto,
  CreateFolioDto,
  ListCashSessionsQueryDto,
  ListFoliosQueryDto,
  OpenCashSessionDto,
  RecordCashMovementDto,
  RecordPaymentDto,
  VoidFolioChargeDto,
} from './dto/folio.dto';
import { FolioService } from './folio.service';

@ApiTags('folios')
@ApiHeader({ name: DEV_USER_HEADER, required: false })
@ApiHeader({ name: ORGANIZATION_HEADER, required: true })
@ApiHeader({ name: PROPERTY_HEADER, required: true })
@Controller('folios')
@UseGuards(AuthenticationGuard, TenantContextGuard, PermissionsGuard)
export class FolioController {
  constructor(private readonly folios: FolioService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.FOLIO_READ)
  list(@Tenant() tenant: TenantContext, @Query() query: ListFoliosQueryDto) {
    return this.folios.list(tenant, query);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.FOLIO_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  create(@Tenant() tenant: TenantContext, @Body() dto: CreateFolioDto) {
    return this.folios.create(tenant, dto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.FOLIO_READ)
  get(@Tenant() tenant: TenantContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.folios.get(tenant, id);
  }

  @Post(':id/charges')
  @RequirePermissions(PERMISSIONS.FOLIO_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  addCharge(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AddFolioChargeDto,
  ) {
    return this.folios.addCharge(tenant, id, dto);
  }

  @Post(':id/charges/:lineId/void')
  @RequirePermissions(PERMISSIONS.FOLIO_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  voidCharge(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('lineId', new ParseUUIDPipe()) lineId: string,
    @Body() dto: VoidFolioChargeDto,
  ) {
    return this.folios.voidCharge(tenant, id, lineId, dto);
  }

  @Post(':id/payments')
  @RequirePermissions(PERMISSIONS.PAYMENT_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  recordPayment(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.folios.recordPayment(tenant, id, dto);
  }

  @Post(':id/cancel')
  @RequirePermissions(PERMISSIONS.FOLIO_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  cancel(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CancelFolioDto,
  ) {
    return this.folios.cancel(tenant, id, dto);
  }
}

@ApiTags('cash-sessions')
@ApiHeader({ name: DEV_USER_HEADER, required: false })
@ApiHeader({ name: ORGANIZATION_HEADER, required: true })
@ApiHeader({ name: PROPERTY_HEADER, required: true })
@Controller('cash-sessions')
@UseGuards(AuthenticationGuard, TenantContextGuard, PermissionsGuard)
export class CashSessionController {
  constructor(private readonly cash: CashService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CASH_READ)
  list(@Tenant() tenant: TenantContext, @Query() query: ListCashSessionsQueryDto) {
    return this.cash.list(tenant, query);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CASH_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  open(@Tenant() tenant: TenantContext, @Body() dto: OpenCashSessionDto) {
    return this.cash.open(tenant, dto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.CASH_READ)
  get(@Tenant() tenant: TenantContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.cash.get(tenant, id);
  }

  @Post(':id/movements')
  @RequirePermissions(PERMISSIONS.CASH_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  recordMovement(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RecordCashMovementDto,
  ) {
    return this.cash.recordMovement(tenant, id, dto);
  }

  @Post(':id/close')
  @RequirePermissions(PERMISSIONS.CASH_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  close(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CloseCashSessionDto,
  ) {
    return this.cash.close(tenant, id, dto);
  }
}
