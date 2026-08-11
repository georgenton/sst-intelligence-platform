import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ApiRequest } from '../common/request-context';
import { ENTITLEMENT_KEY } from './entitlement.decorator';
import { EntitlementService } from './entitlement.service';

@Injectable()
export class EntitlementGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlements: EntitlementService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const feature = this.reflector.getAllAndOverride<string>(ENTITLEMENT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!feature) return true;
    const organizationId = context.switchToHttp().getRequest<ApiRequest>().organization?.id;
    if (!organizationId) return false;
    await this.entitlements.require(organizationId, feature);
    return true;
  }
}
