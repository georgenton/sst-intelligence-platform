import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  applicabilityRulePackSchema,
  evaluateApplicability,
  organizationSstProfileSchema,
  type OrganizationSstProfile,
  type OrganizationProfileFact,
  organizationProfileFactInputSchema,
  organizationProfileFactSchema,
} from '@sst/contracts';
import { AuditService, type AuditEvent } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateOrganizationSstProfileVersionDto, EvaluateApplicabilityDto } from './dto';

type Context = Pick<AuditEvent, 'requestId' | 'ip' | 'userAgent'>;

@Injectable()
export class ApplicabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listProfileVersions(organizationId: string) {
    return this.prisma.organizationSstProfileVersion.findMany({
      where: { organizationId },
      select: {
        id: true,
        version: true,
        snapshot: true,
        createdAt: true,
        createdBy: { select: { id: true, displayName: true } },
      },
      orderBy: { version: 'desc' },
      take: 100,
    });
  }

  async getProfileVersion(organizationId: string, profileVersionId: string) {
    const profile = await this.prisma.organizationSstProfileVersion.findFirst({
      where: { id: profileVersionId, organizationId },
      select: {
        id: true,
        version: true,
        snapshot: true,
        createdAt: true,
        createdBy: { select: { id: true, displayName: true } },
      },
    });
    if (!profile) throw new NotFoundException('Versión de perfil SST no encontrada.');
    return profile;
  }

  async createProfileVersion(
    organizationId: string,
    userId: string,
    input: CreateOrganizationSstProfileVersionDto,
    context: Context,
  ) {
    const [organization, workCenters, workAreaCount, positionCount] = await Promise.all([
      this.prisma.organization.findFirst({
        where: { id: organizationId },
        select: { country: true, sector: true },
      }),
      this.prisma.workCenter.findMany({
        where: { organizationId, isActive: true },
        select: { id: true, city: true },
      }),
      this.prisma.workArea.count({ where: { organizationId, isActive: true } }),
      this.prisma.position.count({ where: { organizationId, isActive: true } }),
    ]);
    if (!organization) throw new NotFoundException('Organización no encontrada.');

    const allowedWorkCenterIds = new Set(workCenters.map(({ id }) => id));
    const suppliedFactInputs = (input.facts ?? []).map((fact) => {
      const parsed = organizationProfileFactInputSchema.safeParse(fact);
      if (!parsed.success) {
        throw new BadRequestException('El hecho de contexto o su procedencia no son válidos.');
      }
      return parsed.data;
    });
    if (
      suppliedFactInputs.some(
        (fact) => fact.workCenterId && !allowedWorkCenterIds.has(fact.workCenterId),
      )
    ) {
      throw new NotFoundException(
        'El hecho de contexto referencia un centro de otra organización.',
      );
    }
    const serverDerivedKeys = new Set<OrganizationProfileFact['key']>([
      'WORK_CENTER_CITY_CONFIRMED',
      'WORK_AREAS_PRESENT',
      'POSITIONS_PRESENT',
    ]);
    if (suppliedFactInputs.some(({ key }) => serverDerivedKeys.has(key))) {
      throw new BadRequestException(
        'Los hechos derivados del registro canónico solo pueden ser producidos por el servidor.',
      );
    }
    if (
      suppliedFactInputs.some(({ provenance }) => provenance.source === 'DERIVED_DETERMINISTICALLY')
    ) {
      throw new BadRequestException(
        'La procedencia derivada determinísticamente solo puede ser asignada por el servidor.',
      );
    }
    const confirmedAt = new Date().toISOString();
    const suppliedFacts = await Promise.all(
      suppliedFactInputs.map(async (fact) => {
        const evidenceReference =
          fact.provenance.source === 'EVIDENCE_BACKED'
            ? await this.resolveEvidenceReference(
                organizationId,
                fact.provenance.evidenceReference!,
              )
            : undefined;
        return organizationProfileFactSchema.parse({
          ...fact,
          provenance: {
            ...fact.provenance,
            ...(evidenceReference ? { evidenceReference } : {}),
            ...(fact.provenance.source === 'PROFESSIONAL_CONFIRMED'
              ? { actorUserId: userId, confirmedAt }
              : {}),
          },
        });
      }),
    );
    const booleanFact = (
      key: OrganizationProfileFact['key'],
      value: boolean | undefined,
    ): OrganizationProfileFact[] =>
      value === undefined
        ? []
        : [
            organizationProfileFactSchema.parse({
              key,
              value: value ? 'KNOWN_TRUE' : 'KNOWN_FALSE',
              scope: 'ORGANIZATION',
              provenance: { source: 'DECLARED_BY_ORGANIZATION' },
            }),
          ];
    const derivedFacts: OrganizationProfileFact[] = [
      organizationProfileFactSchema.parse({
        key: 'WORK_CENTER_CITY_CONFIRMED',
        value:
          workCenters.length > 0 && workCenters.every(({ city }) => Boolean(city))
            ? 'KNOWN_TRUE'
            : 'UNKNOWN',
        scope: 'ORGANIZATION',
        provenance: {
          source: 'DERIVED_DETERMINISTICALLY',
          note: 'Derivado de los centros activos registrados.',
        },
      }),
      organizationProfileFactSchema.parse({
        key: 'WORK_AREAS_PRESENT',
        value: workAreaCount > 0 ? 'KNOWN_TRUE' : 'UNKNOWN',
        scope: 'ORGANIZATION',
        provenance: {
          source: 'DERIVED_DETERMINISTICALLY',
          note: 'Derivado de la presencia de áreas activas registradas; no afirma completitud.',
        },
      }),
      organizationProfileFactSchema.parse({
        key: 'POSITIONS_PRESENT',
        value: positionCount > 0 ? 'KNOWN_TRUE' : 'UNKNOWN',
        scope: 'ORGANIZATION',
        provenance: {
          source: 'DERIVED_DETERMINISTICALLY',
          note: 'Derivado de la presencia de cargos activos registrados; no afirma completitud.',
        },
      }),
    ];
    const contextFacts = this.mergeContextFacts([
      ...suppliedFacts,
      ...booleanFact('PHYSICAL_SITE_PRESENT', input.hasPhysicalSite),
      ...booleanFact('ADMINISTRATIVE_OR_REMOTE_ONLY', input.administrativeOrRemoteOnly),
      ...booleanFact(
        'CONTRACTOR_OR_EXTERNAL_PERSONNEL_PRESENT',
        input.hasContractorsOrExternalPersonnel,
      ),
      ...booleanFact('CHEMICAL_PROCESS_PRESENT', input.hasChemicalProcesses),
      ...booleanFact('HIGH_ENERGY_OPERATION_PRESENT', input.hasHighEnergyOperations),
      ...derivedFacts,
    ]);

    const requestsV2 =
      input.managementPriority !== undefined ||
      input.hasPhysicalSite !== undefined ||
      input.administrativeOrRemoteOnly !== undefined ||
      input.hasContractorsOrExternalPersonnel !== undefined ||
      input.facts !== undefined;
    const snapshot = organizationSstProfileSchema.parse({
      schemaVersion: requestsV2 ? '2.0.0' : '1.0.0',
      organization: {
        country: organization.country,
        ...(organization.sector ? { sector: organization.sector } : {}),
        workCenterCount: workCenters.length,
        ...(input.workerCount === undefined ? {} : { workerCount: input.workerCount }),
        ...(input.managementPriority ? { managementPriority: input.managementPriority } : {}),
      },
      operations: {
        ...(input.hasChemicalProcesses === undefined
          ? {}
          : { hasChemicalProcesses: input.hasChemicalProcesses }),
        ...(input.hasHighEnergyOperations === undefined
          ? {}
          : { hasHighEnergyOperations: input.hasHighEnergyOperations }),
      },
      ...(requestsV2 ? { contextFacts } : {}),
    });

    const profile = await this.createNextProfileVersion(organizationId, userId, snapshot);
    await this.audit.record({
      organizationId,
      actorUserId: userId,
      action: 'SST_PROFILE_VERSION_CREATED',
      entityType: 'OrganizationSstProfileVersion',
      entityId: profile.id,
      metadata: { version: profile.version },
      ...context,
    });
    return profile;
  }

  private mergeContextFacts(facts: OrganizationProfileFact[]) {
    const byIdentity = new Map<string, OrganizationProfileFact>();
    const provenanceRank: Record<OrganizationProfileFact['provenance']['source'], number> = {
      DECLARED_BY_ORGANIZATION: 1,
      IMPORTED_REFERENCE: 2,
      EVIDENCE_BACKED: 3,
      PROFESSIONAL_CONFIRMED: 4,
      DERIVED_DETERMINISTICALLY: 5,
    };
    for (const fact of [...facts].sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
    )) {
      const identity = `${fact.scope}:${fact.workCenterId ?? ''}:${fact.key}`;
      const current = byIdentity.get(identity);
      if (!current) {
        byIdentity.set(identity, fact);
        continue;
      }
      if (current.value !== fact.value) {
        throw new BadRequestException(
          `El hecho ${fact.key} contiene valores contradictorios para el mismo alcance.`,
        );
      }
      if (provenanceRank[fact.provenance.source] > provenanceRank[current.provenance.source]) {
        byIdentity.set(identity, fact);
      }
    }
    return [...byIdentity.values()].sort((left, right) =>
      `${left.scope}:${left.workCenterId ?? ''}:${left.key}`.localeCompare(
        `${right.scope}:${right.workCenterId ?? ''}:${right.key}`,
      ),
    );
  }

  private async resolveEvidenceReference(
    organizationId: string,
    reference: { type: string; id: string },
  ) {
    const select = { id: true, createdAt: true } as const;
    const record =
      reference.type === 'SAFETY_OBSERVATION_EVIDENCE'
        ? await this.prisma.safetyObservationEvidence.findFirst({
            where: { id: reference.id, organizationId },
            select,
          })
        : reference.type === 'INCIDENT_EVIDENCE'
          ? await this.prisma.incidentEvidence.findFirst({
              where: { id: reference.id, organizationId },
              select,
            })
          : reference.type === 'ACTION_EVIDENCE'
            ? await this.prisma.actionEvidence.findFirst({
                where: { id: reference.id, organizationId },
                select,
              })
            : reference.type === 'OBLIGATION_EXECUTION_EVIDENCE'
              ? await this.prisma.obligationExecutionEvidence.findFirst({
                  where: { id: reference.id, organizationId },
                  select,
                })
              : reference.type === 'TECHNICAL_ASSESSMENT_EVIDENCE'
                ? await this.prisma.technicalAssessmentEvidence.findFirst({
                    where: { id: reference.id, organizationId },
                    select,
                  })
                : reference.type === 'GOVERNANCE_EVIDENCE'
                  ? await this.prisma.governanceEvidence.findFirst({
                      where: { id: reference.id, organizationId },
                      select,
                    })
                  : null;
    if (!record) {
      throw new NotFoundException('La evidencia de perfil no existe en la organización activa.');
    }
    const typeLabels: Record<string, string> = {
      SAFETY_OBSERVATION_EVIDENCE: 'Evidencia de observación de seguridad',
      INCIDENT_EVIDENCE: 'Evidencia de incidente',
      ACTION_EVIDENCE: 'Evidencia de acción correctiva',
      OBLIGATION_EXECUTION_EVIDENCE: 'Evidencia de ejecución',
      TECHNICAL_ASSESSMENT_EVIDENCE: 'Evidencia de evaluación técnica',
      GOVERNANCE_EVIDENCE: 'Evidencia de gobernanza',
    };
    return {
      type: reference.type,
      id: record.id,
      label: `${typeLabels[reference.type]} · ${record.createdAt.toISOString().slice(0, 10)}`,
    };
  }

  listRulePacks() {
    return this.prisma.applicabilityRulePackVersion.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        key: true,
        name: true,
        version: true,
        status: true,
        sourceType: true,
        sourceReference: true,
        regulatory: true,
        isDemo: true,
        disclaimer: true,
        activatedAt: true,
      },
      orderBy: [{ key: 'asc' }, { version: 'desc' }],
    });
  }

  listAssessments(organizationId: string) {
    return this.prisma.applicabilityAssessment.findMany({
      where: { organizationId },
      select: {
        id: true,
        engineVersion: true,
        completedAt: true,
        createdAt: true,
        profileVersion: { select: { id: true, version: true } },
        rulePackVersion: { select: { id: true, key: true, version: true, isDemo: true } },
        _count: { select: { decisions: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async evaluate(
    organizationId: string,
    userId: string,
    input: EvaluateApplicabilityDto,
    context: Context,
  ) {
    const [profileRow, rulePackRow] = await Promise.all([
      this.prisma.organizationSstProfileVersion.findFirst({
        where: { id: input.profileVersionId, organizationId },
      }),
      this.prisma.applicabilityRulePackVersion.findFirst({
        where: { id: input.rulePackVersionId, status: 'ACTIVE' },
      }),
    ]);
    if (!profileRow) throw new NotFoundException('Versión de perfil SST no encontrada.');
    if (!rulePackRow) throw new NotFoundException('Versión de reglas activa no encontrada.');

    const profile = organizationSstProfileSchema.parse(profileRow.snapshot);
    const rulePack = applicabilityRulePackSchema.parse(rulePackRow.schema);
    if (
      rulePack.key !== rulePackRow.key ||
      rulePack.version !== rulePackRow.version ||
      rulePack.source.type !== rulePackRow.sourceType ||
      rulePack.regulatory !== rulePackRow.regulatory ||
      rulePack.isDemo !== rulePackRow.isDemo
    ) {
      throw new InternalServerErrorException(
        'La versión de reglas tiene metadatos inconsistentes.',
      );
    }
    const evaluation = evaluateApplicability(profile, rulePack);

    const assessment = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.applicabilityAssessment.create({
        data: {
          organizationId,
          profileVersionId: profileRow.id,
          rulePackVersionId: rulePackRow.id,
          profileSnapshot: profile as Prisma.InputJsonValue,
          rulePackSnapshot: rulePack as Prisma.InputJsonValue,
          engineVersion: evaluation.engineVersion,
          createdById: userId,
        },
        select: { id: true, completedAt: true, createdAt: true },
      });

      for (const result of evaluation.decisions) {
        const decision = await transaction.applicabilityDecision.create({
          data: {
            organizationId,
            assessmentId: created.id,
            targetKey: result.targetKey,
            state: result.state,
            reasonCode: result.reasonCode,
            explanation: result.explanation,
            sourceType: result.sourceType,
            sourceReference: result.sourceReference,
            winningRuleId: result.winningRuleId,
          },
          select: { id: true },
        });
        await transaction.applicabilityEvaluationTrace.createMany({
          data: result.trace.map((trace) => ({
            organizationId,
            assessmentId: created.id,
            decisionId: decision.id,
            ruleId: trace.ruleId,
            targetKey: trace.targetKey,
            composition: trace.mode,
            ruleResult: trace.result,
            configuredState: trace.configuredState,
            contributedState: trace.contributedState,
            reasonCode: trace.reasonCode,
            explanation: trace.explanation,
            predicates: trace.predicates as unknown as Prisma.InputJsonValue,
          })),
        });
      }
      return created;
    });

    await this.audit.record({
      organizationId,
      actorUserId: userId,
      action: 'APPLICABILITY_ASSESSMENT_COMPLETED',
      entityType: 'ApplicabilityAssessment',
      entityId: assessment.id,
      metadata: {
        profileVersionId: profileRow.id,
        profileVersion: profileRow.version,
        rulePackVersionId: rulePackRow.id,
        rulePackKey: rulePackRow.key,
        rulePackVersion: rulePackRow.version,
        engineVersion: evaluation.engineVersion,
      },
      ...context,
    });
    return this.getAssessment(organizationId, assessment.id);
  }

  async getAssessment(organizationId: string, assessmentId: string) {
    const assessment = await this.prisma.applicabilityAssessment.findFirst({
      where: { id: assessmentId, organizationId },
      include: {
        profileVersion: { select: { id: true, version: true } },
        rulePackVersion: {
          select: {
            id: true,
            key: true,
            name: true,
            version: true,
            sourceType: true,
            sourceReference: true,
            regulatory: true,
            isDemo: true,
            disclaimer: true,
          },
        },
        createdBy: { select: { id: true, displayName: true } },
        decisions: {
          where: { organizationId },
          orderBy: { targetKey: 'asc' },
          include: {
            traces: {
              where: { organizationId },
              orderBy: { ruleId: 'asc' },
            },
          },
        },
      },
    });
    if (!assessment) throw new NotFoundException('Evaluación de aplicabilidad no encontrada.');
    return assessment;
  }

  private async createNextProfileVersion(
    organizationId: string,
    userId: string,
    snapshot: OrganizationSstProfile,
  ) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (transaction) => {
            const latest = await transaction.organizationSstProfileVersion.findFirst({
              where: { organizationId },
              select: { version: true },
              orderBy: { version: 'desc' },
            });
            return transaction.organizationSstProfileVersion.create({
              data: {
                organizationId,
                version: (latest?.version ?? 0) + 1,
                snapshot: snapshot as Prisma.InputJsonValue,
                createdById: userId,
              },
              select: { id: true, version: true, snapshot: true, createdAt: true },
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        const isRetryable =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === 'P2034' || error.code === 'P2002');
        if (!isRetryable || attempt === 3) {
          if (isRetryable) {
            throw new ConflictException('No se pudo asignar una nueva versión del perfil SST.');
          }
          throw error;
        }
      }
    }
    throw new ConflictException('No se pudo asignar una nueva versión del perfil SST.');
  }
}
