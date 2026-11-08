import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedRequest, TenantContext } from '../http/request-context';

export const Tenant = createParamDecorator(
  (_data: unknown, context: ExecutionContext): TenantContext | undefined => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.tenant;
  },
);
