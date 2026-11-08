import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ALL_PERMISSIONS, PERMISSIONS } from '../access/permissions';
import { AuthenticationGuard } from '../auth/authentication.guard';
import { authRequestMetadata } from '../auth/request-metadata';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { Tenant } from '../common/decorators/tenant.decorator';
import {
  DEV_USER_HEADER,
  ORGANIZATION_HEADER,
  TenantContext,
} from '../common/http/request-context';
import { PermissionsGuard } from '../tenancy/permissions.guard';
import { TenantContextGuard } from '../tenancy/tenant-context.guard';
import { ListSecurityEventsQueryDto } from '../security-events/dto/list-security-events.dto';
import { AdminService } from './admin.service';
import {
  CreateMembershipDto,
  CreatePropertyMembershipDto,
  CreateRoleDto,
  UpdateMembershipDto,
  UpdatePropertyMembershipDto,
  UpdateRoleDto,
} from './dto/admin.dto';

@ApiTags('admin')
@ApiHeader({ name: DEV_USER_HEADER, required: false })
@ApiHeader({ name: ORGANIZATION_HEADER, required: true })
@Controller('admin')
@UseGuards(AuthenticationGuard, TenantContextGuard, PermissionsGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('memberships')
  @RequirePermissions(PERMISSIONS.ORGANIZATION_MEMBERS_READ)
  listMemberships(@Tenant() tenant: TenantContext) {
    return this.admin.listMemberships(tenant);
  }

  @Post('memberships')
  @RequirePermissions(PERMISSIONS.ORGANIZATION_MEMBERS_MANAGE)
  createMembership(
    @Tenant() tenant: TenantContext,
    @Req() request: Request,
    @Body() dto: CreateMembershipDto,
  ) {
    return this.admin.createMembership(tenant, dto, authRequestMetadata(request));
  }

  @Patch('memberships/:id')
  @RequirePermissions(PERMISSIONS.ORGANIZATION_MEMBERS_MANAGE)
  updateMembership(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateMembershipDto,
  ) {
    return this.admin.updateMembership(tenant, id, dto);
  }

  @Get('memberships/:id/sessions')
  @RequirePermissions(PERMISSIONS.ORGANIZATION_MEMBERS_MANAGE)
  listMemberSessions(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.admin.listMemberSessions(tenant, id);
  }

  @Delete('memberships/:id/sessions/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.ORGANIZATION_MEMBERS_MANAGE)
  revokeMemberSession(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
  ) {
    return this.admin.revokeMemberSession(tenant, id, sessionId);
  }

  @Get('properties/:propertyId/memberships')
  @RequirePermissions(PERMISSIONS.ORGANIZATION_MEMBERS_READ)
  listPropertyMemberships(
    @Tenant() tenant: TenantContext,
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
  ) {
    return this.admin.listPropertyMemberships(tenant, propertyId);
  }

  @Post('properties/:propertyId/memberships')
  @RequirePermissions(PERMISSIONS.ORGANIZATION_MEMBERS_MANAGE)
  createPropertyMembership(
    @Tenant() tenant: TenantContext,
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Body() dto: CreatePropertyMembershipDto,
  ) {
    return this.admin.createPropertyMembership(tenant, propertyId, dto);
  }

  @Patch('properties/:propertyId/memberships/:id')
  @RequirePermissions(PERMISSIONS.ORGANIZATION_MEMBERS_MANAGE)
  updatePropertyMembership(
    @Tenant() tenant: TenantContext,
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePropertyMembershipDto,
  ) {
    return this.admin.updatePropertyMembership(tenant, propertyId, id, dto);
  }

  @Get('permissions')
  @RequirePermissions(PERMISSIONS.ORGANIZATION_ROLES_READ)
  listPermissions() {
    return { items: ALL_PERMISSIONS };
  }

  @Get('roles')
  @RequirePermissions(PERMISSIONS.ORGANIZATION_ROLES_READ)
  listRoles(@Tenant() tenant: TenantContext) {
    return this.admin.listRoles(tenant);
  }

  @Post('roles')
  @RequirePermissions(PERMISSIONS.ORGANIZATION_ROLES_MANAGE)
  createRole(@Tenant() tenant: TenantContext, @Body() dto: CreateRoleDto) {
    return this.admin.createRole(tenant, dto);
  }

  @Patch('roles/:id')
  @RequirePermissions(PERMISSIONS.ORGANIZATION_ROLES_MANAGE)
  updateRole(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.admin.updateRole(tenant, id, dto);
  }

  @Get('security-events')
  @RequirePermissions(PERMISSIONS.SECURITY_EVENTS_READ)
  listSecurityEvents(@Tenant() tenant: TenantContext, @Query() query: ListSecurityEventsQueryDto) {
    return this.admin.listSecurityEvents(tenant, query);
  }
}
