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
import { CreatePilotFeedbackDto, ListPilotFeedbackQueryDto } from './dto/pilot.dto';
import { PilotService } from './pilot.service';

@ApiTags('pilot')
@ApiHeader({ name: DEV_USER_HEADER, required: false })
@ApiHeader({ name: ORGANIZATION_HEADER, required: true })
@ApiHeader({ name: PROPERTY_HEADER, required: true })
@Controller('pilot')
@UseGuards(AuthenticationGuard, TenantContextGuard, PermissionsGuard)
export class PilotController {
  constructor(private readonly pilot: PilotService) {}

  @Get('feedback')
  @RequirePermissions(PERMISSIONS.PILOT_FEEDBACK_READ)
  list(@Tenant() tenant: TenantContext, @Query() query: ListPilotFeedbackQueryDto) {
    return this.pilot.list(tenant, query);
  }

  @Post('feedback')
  @RequirePermissions(PERMISSIONS.PILOT_FEEDBACK_SUBMIT)
  @HttpCode(HttpStatus.CREATED)
  submit(@Tenant() tenant: TenantContext, @Body() dto: CreatePilotFeedbackDto) {
    return this.pilot.submit(tenant, dto);
  }

  @Get('feedback/:id')
  @RequirePermissions(PERMISSIONS.PILOT_FEEDBACK_READ)
  get(@Tenant() tenant: TenantContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.pilot.get(tenant, id);
  }

  @Patch('feedback/:id/review')
  @RequirePermissions(PERMISSIONS.PILOT_FEEDBACK_MANAGE)
  review(@Tenant() tenant: TenantContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.pilot.review(tenant, id);
  }
}
