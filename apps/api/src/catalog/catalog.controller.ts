import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { CatalogService } from './catalog.service';
import { CreateProductDto, ListProductsQueryDto, UpdateProductDto } from './dto/product.dto';

/**
 * Catalog reads reuse `folio.read` and catalog administration reuses
 * `folio.manage`: the catalog only exists to post folio charges and the demo
 * roles already carry exactly that pair (ADR-054).
 */
@ApiTags('catalog')
@ApiHeader({ name: DEV_USER_HEADER, required: false })
@ApiHeader({ name: ORGANIZATION_HEADER, required: true })
@ApiHeader({ name: PROPERTY_HEADER, required: true })
@Controller('products')
@UseGuards(AuthenticationGuard, TenantContextGuard, PermissionsGuard)
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.FOLIO_READ)
  list(@Tenant() tenant: TenantContext, @Query() query: ListProductsQueryDto) {
    return this.catalog.list(tenant, query);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.FOLIO_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  create(@Tenant() tenant: TenantContext, @Body() dto: CreateProductDto) {
    return this.catalog.create(tenant, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.FOLIO_MANAGE)
  update(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.catalog.update(tenant, id, dto);
  }
}
