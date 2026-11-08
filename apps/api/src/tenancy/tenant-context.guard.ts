import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import {
  AuthenticatedRequest,
  ORGANIZATION_HEADER,
  PROPERTY_HEADER,
} from '../common/http/request-context';
import { TenancyService } from './tenancy.service';

@Injectable()
export class TenantContextGuard implements CanActivate {
  constructor(private readonly tenancy: TenancyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (request.actor === undefined) {
      throw new ForbiddenException({
        code: 'unauthenticated',
        message: 'Authentication is required before resolving tenant context.',
      });
    }

    const organizationId = request.header(ORGANIZATION_HEADER);
    if (organizationId === undefined || !isUUID(organizationId)) {
      throw new BadRequestException({
        code: 'invalid_tenant_context',
        message: `A valid ${ORGANIZATION_HEADER} header is required.`,
      });
    }

    const rawPropertyId = request.header(PROPERTY_HEADER);
    if (rawPropertyId !== undefined && !isUUID(rawPropertyId)) {
      throw new BadRequestException({
        code: 'invalid_tenant_context',
        message: `The ${PROPERTY_HEADER} header must be a valid UUID when provided.`,
      });
    }

    const tenant = await this.tenancy.resolveContext(
      request.actor,
      organizationId,
      rawPropertyId,
      request.correlationId ?? 'unknown',
    );

    request.tenant = tenant;
    return true;
  }
}
