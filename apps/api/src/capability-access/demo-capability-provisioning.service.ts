import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ModuleKey, Prisma } from '@prisma/client';
import { calculateDemoRisk } from '@sst/contracts';

type ProvisioningInput = {
  tx: Prisma.TransactionClient;
  organizationId: string;
  userId: string;
  moduleKeys: readonly ModuleKey[];
  capabilityMetadata: ReadonlyMap<ModuleKey, Prisma.InputJsonObject>;
  startsAt: Date;
  expiresAt: Date;
};

/**
 * Shared, bounded demo primitives. The service receives already validated
 * module requests; it never interprets assessment answers or grants plans.
 */
@Injectable()
export class DemoCapabilityProvisioningService {
  async provision(input: ProvisioningInput) {
    const moduleKeys = [...new Set(input.moduleKeys)];
    if (!moduleKeys.length) return [];
    const definitions = await input.tx.moduleDefinition.findMany({
      where: { key: { in: moduleKeys } },
      select: { id: true, key: true },
    });
    if (definitions.length !== moduleKeys.length) {
      const found = new Set(definitions.map(({ key }) => key));
      const missing = moduleKeys.filter((key) => !found.has(key));
      throw new ServiceUnavailableException({
        code: 'CAPABILITY_REFERENCE_UNAVAILABLE',
        message: 'La capacidad no está disponible temporalmente.',
        details: { missing },
      });
    }

    for (const definition of definitions) {
      const existing = await input.tx.organizationModule.findUnique({
        where: {
          organizationId_moduleId: {
            organizationId: input.organizationId,
            moduleId: definition.id,
          },
        },
        select: { status: true },
      });
      // A temporary demo selection must never downgrade an existing plan or
      // trial grant. Those rows remain authoritative and are left untouched.
      if (existing && (existing.status === 'ACTIVE' || existing.status === 'TRIAL')) {
        continue;
      }
      const metadata = input.capabilityMetadata.get(definition.key) ?? {
        accessType: 'DEMO',
        synthetic: true,
      };
      await input.tx.organizationModule.upsert({
        where: {
          organizationId_moduleId: {
            organizationId: input.organizationId,
            moduleId: definition.id,
          },
        },
        update: {
          ...(definition.key === ModuleKey.CORE
            ? {}
            : {
                status: 'DEMO',
                source: 'RECOMMENDATION',
                startsAt: input.startsAt,
                expiresAt: input.expiresAt,
                metadata,
              }),
        },
        create: {
          organizationId: input.organizationId,
          moduleId: definition.id,
          status: definition.key === ModuleKey.CORE ? 'ACTIVE' : 'DEMO',
          source: definition.key === ModuleKey.CORE ? 'PLAN' : 'RECOMMENDATION',
          startsAt: input.startsAt,
          expiresAt: definition.key === ModuleKey.CORE ? null : input.expiresAt,
          metadata,
        },
      });
    }

    if (moduleKeys.includes(ModuleKey.INSPECTIONS_INTELLIGENCE)) {
      await this.provisionInspectionDemo(input);
    }
    return definitions;
  }

  async ensureDemoTopology(input: ProvisioningInput) {
    const guayaquil = await input.tx.workCenter.upsert({
      where: {
        organizationId_name: {
          organizationId: input.organizationId,
          name: 'Centro Guayaquil (demostración)',
        },
      },
      update: { isDemo: true },
      create: {
        organizationId: input.organizationId,
        name: 'Centro Guayaquil (demostración)',
        city: 'Guayaquil',
        isDemo: true,
      },
    });
    await input.tx.workCenter.upsert({
      where: {
        organizationId_name: {
          organizationId: input.organizationId,
          name: 'Centro Quito (demostración)',
        },
      },
      update: { isDemo: true },
      create: {
        organizationId: input.organizationId,
        name: 'Centro Quito (demostración)',
        city: 'Quito',
        isDemo: true,
      },
    });
    const electricalArea = await input.tx.workArea.upsert({
      where: {
        organizationId_workCenterId_name: {
          organizationId: input.organizationId,
          workCenterId: guayaquil.id,
          name: 'Planta A',
        },
      },
      update: { isActive: true },
      create: {
        organizationId: input.organizationId,
        workCenterId: guayaquil.id,
        name: 'Planta A',
      },
    });
    return { guayaquil, electricalArea };
  }

  private async provisionInspectionDemo(input: ProvisioningInput) {
    const { guayaquil, electricalArea } = await this.ensureDemoTopology(input);

    const existingStandardPolicy =
      await input.tx.organizationInspectionStandardPolicyVersion.findFirst({
        where: { organizationId: input.organizationId },
        select: { id: true },
      });
    if (!existingStandardPolicy) {
      await input.tx.organizationInspectionStandardPolicyVersion.create({
        data: {
          organizationId: input.organizationId,
          version: 1,
          createdById: input.userId,
          reason: 'Configuración inicial de demostración conceptual.',
          bindings: {
            create: [
              {
                inspectionDomain: 'ELECTRICAL',
                standardVersionId: '57100000-0000-4000-8000-000000000001',
              },
              {
                inspectionDomain: 'FIRE_PROTECTION',
                standardVersionId: '57100000-0000-4000-8000-000000000003',
              },
            ],
          },
        },
      });
    }

    const risk = calculateDemoRisk(4, 4);
    const baseTime = input.startsAt.getTime();
    for (let index = 0; index < 3; index += 1) {
      const title = `Inspección eléctrica demostrativa ${index + 1}`;
      const alreadyExists = await input.tx.inspection.findFirst({
        where: { organizationId: input.organizationId, title, isDemo: true },
        select: { id: true },
      });
      if (alreadyExists) continue;
      const occurredAt = new Date(baseTime - (30 - index * 10) * 86_400_000);
      const inspection = await input.tx.inspection.create({
        data: {
          organizationId: input.organizationId,
          workCenterId: guayaquil.id,
          workAreaId: electricalArea.id,
          inspectorUserId: input.userId,
          title,
          description: 'Registro sintético para demostrar recurrencia determinística.',
          status: 'COMPLETED',
          startedAt: occurredAt,
          completedAt: occurredAt,
          isDemo: true,
          createdAt: occurredAt,
        },
      });
      const finding = await input.tx.inspectionFinding.create({
        data: {
          organizationId: input.organizationId,
          inspectionId: inspection.id,
          workCenterId: guayaquil.id,
          workAreaId: electricalArea.id,
          category: 'ELECTRICAL',
          title: `Hallazgo eléctrico sintético ${index + 1}`,
          description: 'Dato sintético sin información personal.',
          riskMethodKey: risk.methodKey,
          riskMethodVersion: risk.methodVersion,
          initialLikelihood: risk.likelihood,
          initialConsequence: risk.consequence,
          initialScore: risk.score,
          initialRiskLevel: risk.level,
          recurrenceCount: index,
          recurrenceStatus:
            index === 0 ? 'NONE' : index === 1 ? 'REPEATED' : 'SYSTEMIC_REVIEW_RECOMMENDED',
          createdById: input.userId,
          createdAt: occurredAt,
        },
      });
      if (index === 2) {
        await input.tx.inspectionAlert.create({
          data: {
            organizationId: input.organizationId,
            findingId: finding.id,
            type: 'RECURRENCE',
            severity: 'WARNING',
            message:
              'Se registraron varios hallazgos de categoría Eléctrico en este centro durante los últimos 90 días. Se recomienda revisar si las acciones puntuales son suficientes y evaluar posibles factores sistémicos.',
          },
        });
      }
    }
  }
}
