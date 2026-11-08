import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { AuthenticationGuard } from '../auth/authentication.guard';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import { AuthenticatedActor, DEV_USER_HEADER } from '../common/http/request-context';
import { TenancyService } from '../tenancy/tenancy.service';

@ApiTags('identity')
@ApiHeader({ name: DEV_USER_HEADER, required: true })
@Controller()
@UseGuards(AuthenticationGuard)
export class IdentityController {
  constructor(private readonly tenancy: TenancyService) {}

  @Get('me')
  me(@CurrentActor() actor: AuthenticatedActor) {
    return this.tenancy.getMe(actor);
  }

  @Get('organizations')
  async organizations(@CurrentActor() actor: AuthenticatedActor) {
    return { items: await this.tenancy.listOrganizationsForUser(actor.id) };
  }
}
