import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  modules() {
    return this.prisma.moduleDefinition.findMany({
      select: {
        key: true,
        name: true,
        description: true,
        objective: true,
        demoContent: true,
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  subscription(organizationId: string) {
    return this.prisma.subscription.findFirst({
      where: { organizationId, status: { in: ['ACTIVE', 'TRIALING'] } },
      select: {
        status: true,
        startsAt: true,
        endsAt: true,
        plan: { select: { key: true, name: true, description: true } },
      },
      orderBy: { startsAt: 'desc' },
    });
  }
}
