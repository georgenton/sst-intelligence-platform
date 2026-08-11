import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ApiRequest } from '../common/request-context';
import { ROLES_KEY } from './organization-context.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;
    const role = context.switchToHttp().getRequest<ApiRequest>().organization?.role;
    if (!role || !required.includes(role))
      throw new ForbiddenException({
        code: 'ROLE_REQUIRED',
        message: 'Tu rol no permite esta operación.',
      });
    return true;
  }
}
