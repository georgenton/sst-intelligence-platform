import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { regulatoryRiskLinkInputSchema } from '@sst/contracts';
import { PrismaService } from '../prisma/prisma.service';

const linkInclude = {
  unit: {
    include: {
      sourceVersion: { include: { source: true } },
    },
  },
  requirement: true,
} as const;

@Injectable()
export class RegulatoryRiskLinkService {
  constructor(private readonly prisma: PrismaService) {}

  async linkFinding(organizationId: string, findingId: string, rawInput: unknown) {
    const input = this.parse(rawInput);
    const finding = await this.prisma.inspectionFinding.findFirst({
      where: { id: findingId, organizationId },
      select: { id: true },
    });
    if (!finding) throw new NotFoundException('Hallazgo no encontrado.');
    await this.requireTargets(input.unitId, input.requirementId);
    return this.prisma.inspectionFindingRegulatoryLink.create({
      data: { organizationId, findingId, ...input },
      include: linkInclude,
    });
  }

  async linkTechnicalAssessment(organizationId: string, assessmentId: string, rawInput: unknown) {
    const input = this.parse(rawInput);
    const assessment = await this.prisma.technicalAssessment.findFirst({
      where: { id: assessmentId, organizationId },
      select: { id: true, riskValuation: { select: { id: true } } },
    });
    if (!assessment) throw new NotFoundException('Evaluación técnica no encontrada.');
    if (!assessment.riskValuation)
      throw new BadRequestException({
        code: 'TECHNICAL_RISK_V2_REQUIRED',
        message:
          'Solo una evaluación V2 con metodología versionada admite referencias regulatorias.',
      });
    await this.requireTargets(input.unitId, input.requirementId);
    return this.prisma.technicalAssessmentRegulatoryLink.create({
      data: { organizationId, assessmentId, ...input },
      include: linkInclude,
    });
  }

  private parse(rawInput: unknown) {
    const parsed = regulatoryRiskLinkInputSchema.safeParse(rawInput);
    if (!parsed.success)
      throw new BadRequestException({
        code: 'INVALID_REGULATORY_RISK_LINK',
        message: 'Selecciona un artículo o requisito y documenta el motivo de la referencia.',
      });
    return parsed.data;
  }

  private async requireTargets(unitId?: string, requirementId?: string) {
    const [unit, requirement] = await Promise.all([
      unitId
        ? this.prisma.regulatoryUnit.findUnique({ where: { id: unitId }, select: { id: true } })
        : null,
      requirementId
        ? this.prisma.regulatoryRequirement.findUnique({
            where: { id: requirementId },
            select: { id: true },
          })
        : null,
    ]);
    if (unitId && !unit) throw new NotFoundException('Unidad regulatoria no encontrada.');
    if (requirementId && !requirement)
      throw new NotFoundException('Requisito regulatorio no encontrado.');
  }
}
