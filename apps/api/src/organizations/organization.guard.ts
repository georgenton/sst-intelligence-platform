import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { ApiRequest } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { Reflector } from '@nestjs/core';
import { ORGANIZATION_PARAM_KEY } from './organization-context.decorator';

@Injectable()
export class OrganizationGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<ApiRequest>();
    if (!request.user) throw new ForbiddenException('Se requiere una sesión válida.');
    const headerId = request.headers['x-organization-id'];
    const paramName = this.reflector.getAllAndOverride<string>(ORGANIZATION_PARAM_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const rawRouteId = paramName ? request.params[paramName] : undefined;
    const routeId = typeof rawRouteId === 'string' ? rawRouteId : undefined;
    if (Array.isArray(headerId)) throw new ForbiddenException('Organización no válida.');
    if (routeId && headerId && routeId !== headerId)
      throw new ForbiddenException('La organización activa no coincide con la ruta.');
    const organizationId = routeId ?? (typeof headerId === 'string' ? headerId : undefined);
    if (!organizationId) throw new ForbiddenException('Selecciona una organización.');
    const membership = await this.prisma.membership.findFirst({
      where: {
        organizationId,
        userId: request.user.id,
        status: 'ACTIVE',
        organization: { status: { in: ['ACTIVE', 'DEMO'] } },
      },
      select: { organizationId: true, role: true },
    });
    if (!membership) throw new ForbiddenException('No tienes acceso a esta organización.');
    request.organization = { id: membership.organizationId, role: membership.role };
    return true;
  }
}
