import { Injectable, NotFoundException } from '@nestjs/common';
import {
  TECHNICAL_RISK_DEMO_DISCLAIMER,
  technicalMethodSchema,
  type TechnicalMethodVersionSnapshot,
} from '@sst/contracts';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TechnicalMethodService {
  constructor(private readonly prisma: PrismaService) {}

  private visibleWhere(organizationId: string) {
    return {
      status: 'ACTIVE' as const,
      OR: [{ organizationId: null }, { organizationId }],
      methodDefinition: {
        status: 'ACTIVE' as const,
        OR: [{ organizationId: null }, { organizationId }],
      },
    };
  }

  async list(organizationId: string) {
    const versions = await this.prisma.technicalMethodVersion.findMany({
      where: this.visibleWhere(organizationId),
      select: {
        id: true,
        version: true,
        schema: true,
        calculationKey: true,
        regulatory: true,
        country: true,
        validFrom: true,
        validTo: true,
        methodDefinition: {
          select: { key: true, name: true, description: true, category: true },
        },
      },
      orderBy: [{ methodDefinition: { name: 'asc' } }, { createdAt: 'desc' }],
    });
    return versions.map((version) => this.present(version));
  }

  async get(organizationId: string, methodKey: string, version?: string) {
    const row = await this.prisma.technicalMethodVersion.findFirst({
      where: {
        ...this.visibleWhere(organizationId),
        version,
        methodDefinition: {
          ...this.visibleWhere(organizationId).methodDefinition,
          key: methodKey,
        },
      },
      select: {
        id: true,
        version: true,
        schema: true,
        calculationKey: true,
        regulatory: true,
        country: true,
        validFrom: true,
        validTo: true,
        methodDefinition: {
          select: { key: true, name: true, description: true, category: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'TECHNICAL_METHOD_NOT_FOUND',
        message: 'El método técnico solicitado no está disponible.',
      });
    }
    return this.present(row);
  }

  snapshot(
    method: Awaited<ReturnType<TechnicalMethodService['get']>>,
  ): TechnicalMethodVersionSnapshot {
    return {
      methodKey: method.key,
      methodName: method.name,
      methodVersion: method.version,
      calculationKey: method.calculationKey,
      regulatory: method.regulatory,
      country: method.country,
      disclaimer: method.disclaimer,
      schema: technicalMethodSchema.parse(method.schema),
    };
  }

  private present(row: {
    id: string;
    version: string;
    schema: unknown;
    calculationKey: string;
    regulatory: boolean;
    country: string | null;
    validFrom: Date | null;
    validTo: Date | null;
    methodDefinition: { key: string; name: string; description: string; category: string };
  }) {
    return {
      id: row.id,
      key: row.methodDefinition.key,
      name: row.methodDefinition.name,
      description: row.methodDefinition.description,
      category: row.methodDefinition.category,
      version: row.version,
      schema: technicalMethodSchema.parse(row.schema),
      calculationKey: row.calculationKey,
      regulatory: row.regulatory,
      country: row.country,
      validFrom: row.validFrom,
      validTo: row.validTo,
      disclaimer: row.regulatory ? null : TECHNICAL_RISK_DEMO_DISCLAIMER,
    };
  }
}
