import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionKey } from '../access/permissions';
import { PERMISSIONS_METADATA_KEY } from '../common/decorators/require-permissions.decorator';
import { AuthenticatedRequest } from '../common/http/request-context';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PermissionKey[]>(PERMISSIONS_METADATA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (required === undefined || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const tenant = request.tenant;

    if (tenant === undefined) {
      throw new ForbiddenException({
        code: 'tenant_context_required',
        message: 'This operation requires tenant context.',
      });
    }

    const missing = required.filter((permission) => !tenant.permissions.has(permission));
    if (missing.length > 0) {
      throw new ForbiddenException({
        code: 'permission_denied',
        message: 'You do not have the required permission for this operation.',
        details: { required: missing },
      });
    }

    return true;
  }
}
