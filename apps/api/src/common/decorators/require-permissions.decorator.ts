import { SetMetadata } from '@nestjs/common';
import { PermissionKey } from '../../access/permissions';

export const PERMISSIONS_METADATA_KEY = 'nova:required-permissions';

export const RequirePermissions = (...permissions: PermissionKey[]): MethodDecorator =>
  SetMetadata(PERMISSIONS_METADATA_KEY, permissions);
