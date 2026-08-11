import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { ApiRequest } from '../common/request-context';

export const ROLES_KEY = 'organization_roles';
export const ORGANIZATION_PARAM_KEY = 'organization_param';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
export const OrganizationIdParam = (name = 'id') => SetMetadata(ORGANIZATION_PARAM_KEY, name);

export const OrganizationContext = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const organization = context.switchToHttp().getRequest<ApiRequest>().organization;
    if (!organization) throw new Error('Organization context was not resolved');
    return organization;
  },
);
