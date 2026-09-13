import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const PERMISSIONS_KEY = 'permissions';
export type PermissionRequirement = { module: string; action: string };

export const RequirePermission = (...perms: PermissionRequirement[]) =>
  SetMetadata(PERMISSIONS_KEY, perms);

export const ROLES_KEY = 'roles';
export const RequireRole = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
