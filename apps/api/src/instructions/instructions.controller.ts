import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { InstructionStatus } from '@prisma/client';
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
  ConfirmSourceSuggestionsDto,
  CreateGuestNoteDto,
  CreateInstructionDto,
  InstructionTransitionDto,
  ListGuestNotesQueryDto,
  ListInstructionsQueryDto,
  ParseSourceNoteDto,
  UpdateGuestNoteDto,
  UpdateInstructionDto,
} from './dto/instruction.dto';
import { InstructionsService } from './instructions.service';

@ApiTags('instructions')
@ApiHeader({ name: DEV_USER_HEADER, required: false })
@ApiHeader({ name: ORGANIZATION_HEADER, required: true })
@ApiHeader({ name: PROPERTY_HEADER, required: true })
@Controller()
@UseGuards(AuthenticationGuard, TenantContextGuard, PermissionsGuard)
export class InstructionsController {
  constructor(private readonly instructions: InstructionsService) {}

  @Get('reservations/:reservationId/instructions')
  @RequirePermissions(PERMISSIONS.RESERVATIONS_READ)
  list(
    @Tenant() tenant: TenantContext,
    @Param('reservationId', new ParseUUIDPipe()) reservationId: string,
    @Query() query: ListInstructionsQueryDto,
  ) {
    return this.instructions.list(tenant, reservationId, query);
  }

  @Post('reservations/:reservationId/instructions')
  @RequirePermissions(PERMISSIONS.RESERVATIONS_MANAGE)
  create(
    @Tenant() tenant: TenantContext,
    @Param('reservationId', new ParseUUIDPipe()) reservationId: string,
    @Body() dto: CreateInstructionDto,
  ) {
    return this.instructions.create(tenant, reservationId, dto);
  }

  @Get('reservations/:reservationId/instructions/:instructionId')
  @RequirePermissions(PERMISSIONS.RESERVATIONS_READ)
  get(
    @Tenant() tenant: TenantContext,
    @Param('reservationId', new ParseUUIDPipe()) reservationId: string,
    @Param('instructionId', new ParseUUIDPipe()) instructionId: string,
  ) {
    return this.instructions.get(tenant, reservationId, instructionId);
  }

  @Patch('reservations/:reservationId/instructions/:instructionId')
  @RequirePermissions(PERMISSIONS.RESERVATIONS_MANAGE)
  update(
    @Tenant() tenant: TenantContext,
    @Param('reservationId', new ParseUUIDPipe()) reservationId: string,
    @Param('instructionId', new ParseUUIDPipe()) instructionId: string,
    @Body() dto: UpdateInstructionDto,
  ) {
    return this.instructions.update(tenant, reservationId, instructionId, dto);
  }

  @Get('reservations/:reservationId/instructions/:instructionId/events')
  @RequirePermissions(PERMISSIONS.RESERVATIONS_READ)
  events(
    @Tenant() tenant: TenantContext,
    @Param('reservationId', new ParseUUIDPipe()) reservationId: string,
    @Param('instructionId', new ParseUUIDPipe()) instructionId: string,
  ) {
    return this.instructions.events(tenant, reservationId, instructionId);
  }

  @Post('reservations/:reservationId/instructions/:instructionId/acknowledge')
  @RequirePermissions(PERMISSIONS.RESERVATIONS_MANAGE)
  acknowledge(
    @Tenant() tenant: TenantContext,
    @Param('reservationId', new ParseUUIDPipe()) reservationId: string,
    @Param('instructionId', new ParseUUIDPipe()) instructionId: string,
    @Body() dto: InstructionTransitionDto,
  ) {
    return this.instructions.transition(
      tenant,
      reservationId,
      instructionId,
      InstructionStatus.ACKNOWLEDGED,
      dto.reason,
    );
  }

  @Post('reservations/:reservationId/instructions/:instructionId/start')
  @RequirePermissions(PERMISSIONS.RESERVATIONS_MANAGE)
  start(
    @Tenant() tenant: TenantContext,
    @Param('reservationId', new ParseUUIDPipe()) reservationId: string,
    @Param('instructionId', new ParseUUIDPipe()) instructionId: string,
    @Body() dto: InstructionTransitionDto,
  ) {
    return this.instructions.transition(
      tenant,
      reservationId,
      instructionId,
      InstructionStatus.IN_PROGRESS,
      dto.reason,
    );
  }

  @Post('reservations/:reservationId/instructions/:instructionId/complete')
  @RequirePermissions(PERMISSIONS.RESERVATIONS_MANAGE)
  complete(
    @Tenant() tenant: TenantContext,
    @Param('reservationId', new ParseUUIDPipe()) reservationId: string,
    @Param('instructionId', new ParseUUIDPipe()) instructionId: string,
    @Body() dto: InstructionTransitionDto,
  ) {
    return this.instructions.transition(
      tenant,
      reservationId,
      instructionId,
      InstructionStatus.COMPLETED,
      dto.reason,
    );
  }

  @Post('reservations/:reservationId/instructions/:instructionId/dismiss')
  @RequirePermissions(PERMISSIONS.RESERVATIONS_MANAGE)
  dismiss(
    @Tenant() tenant: TenantContext,
    @Param('reservationId', new ParseUUIDPipe()) reservationId: string,
    @Param('instructionId', new ParseUUIDPipe()) instructionId: string,
    @Body() dto: InstructionTransitionDto,
  ) {
    return this.instructions.transition(
      tenant,
      reservationId,
      instructionId,
      InstructionStatus.DISMISSED,
      dto.reason,
    );
  }

  @Post('reservations/:reservationId/instructions/:instructionId/needs-clarification')
  @RequirePermissions(PERMISSIONS.RESERVATIONS_MANAGE)
  needsClarification(
    @Tenant() tenant: TenantContext,
    @Param('reservationId', new ParseUUIDPipe()) reservationId: string,
    @Param('instructionId', new ParseUUIDPipe()) instructionId: string,
    @Body() dto: InstructionTransitionDto,
  ) {
    return this.instructions.transition(
      tenant,
      reservationId,
      instructionId,
      InstructionStatus.NEEDS_CLARIFICATION,
      dto.reason,
    );
  }

  @Post('reservations/:reservationId/source-notes/parse')
  @RequirePermissions(PERMISSIONS.RESERVATIONS_MANAGE)
  parseSource(
    @Tenant() tenant: TenantContext,
    @Param('reservationId', new ParseUUIDPipe()) reservationId: string,
    @Body() dto: ParseSourceNoteDto,
  ) {
    return this.instructions.parseSource(tenant, reservationId, dto);
  }

  @Get('reservations/:reservationId/source-notes')
  @RequirePermissions(PERMISSIONS.RESERVATIONS_MANAGE)
  listSourceNotes(
    @Tenant() tenant: TenantContext,
    @Param('reservationId', new ParseUUIDPipe()) reservationId: string,
  ) {
    return this.instructions.listSourceNotes(tenant, reservationId);
  }

  @Post('reservations/:reservationId/source-notes/:sourceNoteId/confirm')
  @RequirePermissions(PERMISSIONS.RESERVATIONS_MANAGE)
  confirmSourceSuggestions(
    @Tenant() tenant: TenantContext,
    @Param('reservationId', new ParseUUIDPipe()) reservationId: string,
    @Param('sourceNoteId', new ParseUUIDPipe()) sourceNoteId: string,
    @Body() dto: ConfirmSourceSuggestionsDto,
  ) {
    return this.instructions.confirmSourceSuggestions(tenant, reservationId, sourceNoteId, dto);
  }

  @Get('guests/:guestId/notes')
  @RequirePermissions(PERMISSIONS.GUESTS_READ)
  listGuestNotes(
    @Tenant() tenant: TenantContext,
    @Param('guestId', new ParseUUIDPipe()) guestId: string,
    @Query() query: ListGuestNotesQueryDto,
  ) {
    return this.instructions.listGuestNotes(tenant, guestId, query);
  }

  @Post('guests/:guestId/notes')
  @RequirePermissions(PERMISSIONS.GUESTS_MANAGE)
  createGuestNote(
    @Tenant() tenant: TenantContext,
    @Param('guestId', new ParseUUIDPipe()) guestId: string,
    @Body() dto: CreateGuestNoteDto,
  ) {
    return this.instructions.createGuestNote(tenant, guestId, dto);
  }

  @Patch('guests/:guestId/notes/:noteId')
  @RequirePermissions(PERMISSIONS.GUESTS_MANAGE)
  updateGuestNote(
    @Tenant() tenant: TenantContext,
    @Param('guestId', new ParseUUIDPipe()) guestId: string,
    @Param('noteId', new ParseUUIDPipe()) noteId: string,
    @Body() dto: UpdateGuestNoteDto,
  ) {
    return this.instructions.updateGuestNote(tenant, guestId, noteId, dto);
  }
}
