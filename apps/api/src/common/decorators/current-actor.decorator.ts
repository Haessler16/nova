import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedActor, AuthenticatedRequest } from '../http/request-context';

export const CurrentActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedActor | undefined => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.actor;
  },
);
