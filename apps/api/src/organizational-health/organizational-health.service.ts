import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, type ActionEvidenceType, type PrismaClient } from '@prisma/client';
import { adaptiveContentHash } from '@sst/contracts';
import { isUUID } from 'class-validator';
import { AuditService } from '../audit/audit.service';
import type { AuditEvent } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { resolvePsychosocialLegalContext } from './psychosocial-legal-context';
import {
  CreateOccupationalHealthActivityDto,
  CreateOccupationalHealthProgramDto,
  CreatePsychosocialAssessmentCycleDto,
  CreatePsychosocialProgramDto,
  UpdateOccupationalHealthActivityDto,
  UpdateOccupationalHealthProgramDto,
  UpdatePsychosocialAssessmentCycleDto,
  UpdatePsychosocialProgramDto,
} from './dto';

type Context = Pick<AuditEvent, 'requestId' | 'ip' | 'userAgent'>;

const occupationalProgramInclude = {
  activities: { orderBy: { plannedAt: 'asc' as const } },
} as const;

const psychosocialProgramInclude = {
  assessmentCycles: {
    orderBy: { plannedAt: 'asc' as const },
    include: {
      instrumentSourceVersion: {
        select: {
          id: true,
          catalogVersion: true,
          officialUrl: true,
          artifactVerificationStatus: true,
          source: { select: { sourceKey: true, canonicalTitle: true, issuer: true } },
        },
      },
    },
  },
} as const;

type IdempotencyReceipt = { hash: string; fingerprint: string };

@Injectable()
export class OrganizationalHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listOccupationalPrograms(organizationId: string) {
    return this.prisma.occupationalHealthProgram.findMany({
      where: { organizationId },
      include: occupationalProgramInclude,
      orderBy: [{ periodStart: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getOccupationalProgram(organizationId: string, id: string) {
    const program = await this.prisma.occupationalHealthProgram.findFirst({
      where: { id, organizationId },
      include: occupationalProgramInclude,
    });
    if (!program) throw new NotFoundException('Programa de salud en el trabajo no encontrado.');
    return program;
  }

  async createOccupationalProgram(
    organizationId: string,
    userId: string,
    input: CreateOccupationalHealthProgramDto,
    context: Context,
    idempotencyKey?: string,
  ) {
    this.assertDateRange(input.periodStart, input.periodEnd);
    const fingerprint = adaptiveContentHash(input);
    return this.prisma.$transaction(async (tx) => {
      const receipt = await this.findReceipt(
        tx,
        organizationId,
        userId,
        'OCCUPATIONAL_HEALTH_PROGRAM_CREATED',
        idempotencyKey,
        fingerprint,
      );
      if (receipt) return this.getOccupationalProgramTx(tx, organizationId, receipt.entityId);
      const program = await tx.occupationalHealthProgram.create({
        data: {
          organizationId,
          periodStart: new Date(input.periodStart),
          periodEnd: new Date(input.periodEnd),
          title: input.title,
          scopeSummary: input.scopeSummary,
          coordinatorName: input.coordinatorName,
          notes: input.notes,
          createdById: userId,
        },
        include: occupationalProgramInclude,
      });
      await this.audit.record(
        {
          organizationId,
          actorUserId: userId,
          action: 'OCCUPATIONAL_HEALTH_PROGRAM_CREATED',
          entityType: 'OccupationalHealthProgram',
          entityId: program.id,
          metadata: this.idempotencyMetadata(idempotencyKey, fingerprint),
          ...context,
        },
        tx,
      );
      return program;
    });
  }

  async updateOccupationalProgram(
    organizationId: string,
    userId: string,
    id: string,
    input: UpdateOccupationalHealthProgramDto,
    context: Context,
  ) {
    const current = await this.prisma.occupationalHealthProgram.findFirst({
      where: { id, organizationId },
    });
    if (!current) throw new NotFoundException('Programa de salud en el trabajo no encontrado.');
    const start = input.periodStart ?? current.periodStart.toISOString();
    const end = input.periodEnd ?? current.periodEnd.toISOString();
    this.assertDateRange(start, end);
    const program = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.occupationalHealthProgram.update({
        where: { id },
        data: {
          ...(input.periodStart ? { periodStart: new Date(input.periodStart) } : {}),
          ...(input.periodEnd ? { periodEnd: new Date(input.periodEnd) } : {}),
          ...(input.status ? { status: input.status } : {}),
          ...(input.title ? { title: input.title } : {}),
          ...(input.scopeSummary !== undefined ? { scopeSummary: input.scopeSummary } : {}),
          ...(input.coordinatorName !== undefined
            ? { coordinatorName: input.coordinatorName }
            : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        },
        include: occupationalProgramInclude,
      });
      await this.audit.record(
        {
          organizationId,
          actorUserId: userId,
          action: 'OCCUPATIONAL_HEALTH_PROGRAM_UPDATED',
          entityType: 'OccupationalHealthProgram',
          entityId: id,
          metadata: { changedFields: Object.keys(input) },
          ...context,
        },
        tx,
      );
      return updated;
    });
    return program;
  }

  async createOccupationalActivity(
    organizationId: string,
    userId: string,
    programId: string,
    input: CreateOccupationalHealthActivityDto,
    context: Context,
  ) {
    await this.requireOccupationalProgram(organizationId, programId);
    await this.requireOptionalTenantReferences(
      organizationId,
      input.workCenterId,
      input.responsibleUserId,
    );
    this.assertEvidence(input.evidenceType, input.evidenceNote, input.evidenceUrl);
    if (input.linkedOperationalPlanItemId) {
      const item = await this.prisma.operationalPlanItem.findFirst({
        where: { id: input.linkedOperationalPlanItemId, organizationId },
        select: { id: true },
      });
      if (!item) throw new NotFoundException('Ítem del Plan Operativo no encontrado.');
    }
    const activity = await this.prisma.$transaction(async (tx) => {
      const created = await tx.occupationalHealthActivity.create({
        data: {
          organizationId,
          programId,
          componentKey: input.componentKey,
          title: input.title,
          description: input.description,
          workCenterId: input.workCenterId,
          plannedAt: input.plannedAt ? new Date(input.plannedAt) : undefined,
          responsibleUserId: input.responsibleUserId,
          evidenceType: input.evidenceType,
          evidenceNote: input.evidenceNote,
          evidenceUrl: input.evidenceUrl,
          linkedOperationalPlanItemId: input.linkedOperationalPlanItemId,
          createdById: userId,
        },
      });
      await this.audit.record(
        {
          organizationId,
          actorUserId: userId,
          action: 'OCCUPATIONAL_HEALTH_ACTIVITY_CREATED',
          entityType: 'OccupationalHealthActivity',
          entityId: created.id,
          metadata: {
            programId,
            componentKey: input.componentKey,
            ...(input.linkedOperationalPlanItemId
              ? { operationalPlanItemId: input.linkedOperationalPlanItemId, humanConfirmed: true }
              : {}),
          },
          ...context,
        },
        tx,
      );
      if (input.evidenceNote || input.evidenceUrl)
        await this.recordEvidenceLinked(
          tx,
          organizationId,
          userId,
          'OccupationalHealthActivity',
          created.id,
          context,
        );
      return created;
    });
    return this.getOccupationalProgram(organizationId, activity.programId);
  }

  async updateOccupationalActivity(
    organizationId: string,
    userId: string,
    id: string,
    input: UpdateOccupationalHealthActivityDto,
    context: Context,
  ) {
    const current = await this.prisma.occupationalHealthActivity.findFirst({
      where: { id, organizationId },
    });
    if (!current) throw new NotFoundException('Actividad de salud en el trabajo no encontrada.');
    await this.requireOptionalTenantReferences(
      organizationId,
      input.workCenterId,
      input.responsibleUserId,
    );
    this.assertEvidence(
      input.evidenceType ?? current.evidenceType ?? undefined,
      input.evidenceNote ?? current.evidenceNote ?? undefined,
      input.evidenceUrl ?? current.evidenceUrl ?? undefined,
    );
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.occupationalHealthActivity.update({
        where: { id },
        data: {
          ...(input.componentKey ? { componentKey: input.componentKey } : {}),
          ...(input.title ? { title: input.title } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.workCenterId !== undefined ? { workCenterId: input.workCenterId } : {}),
          ...(input.plannedAt ? { plannedAt: new Date(input.plannedAt) } : {}),
          ...(input.completedAt ? { completedAt: new Date(input.completedAt) } : {}),
          ...(input.status ? { status: input.status } : {}),
          ...(input.responsibleUserId !== undefined
            ? { responsibleUserId: input.responsibleUserId }
            : {}),
          ...(input.evidenceType !== undefined ? { evidenceType: input.evidenceType } : {}),
          ...(input.evidenceNote !== undefined ? { evidenceNote: input.evidenceNote } : {}),
          ...(input.evidenceUrl !== undefined ? { evidenceUrl: input.evidenceUrl } : {}),
        },
      });
      await this.audit.record(
        {
          organizationId,
          actorUserId: userId,
          action: 'OCCUPATIONAL_HEALTH_ACTIVITY_UPDATED',
          entityType: 'OccupationalHealthActivity',
          entityId: id,
          metadata: { changedFields: Object.keys(input) },
          ...context,
        },
        tx,
      );
      if (input.evidenceNote !== undefined || input.evidenceUrl !== undefined)
        await this.recordEvidenceLinked(
          tx,
          organizationId,
          userId,
          'OccupationalHealthActivity',
          id,
          context,
        );
      return row;
    });
    return this.getOccupationalProgram(organizationId, updated.programId);
  }

  async linkOccupationalPlanItem(
    organizationId: string,
    userId: string,
    activityId: string,
    operationalPlanItemId: string,
    context: Context,
  ) {
    const activity = await this.prisma.occupationalHealthActivity.findFirst({
      where: { id: activityId, organizationId },
      select: { id: true, programId: true },
    });
    if (!activity) throw new NotFoundException('Actividad de salud en el trabajo no encontrada.');
    const item = await this.prisma.operationalPlanItem.findFirst({
      where: { id: operationalPlanItemId, organizationId },
      select: { id: true },
    });
    if (!item) throw new NotFoundException('Ítem del Plan Operativo no encontrado.');
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.occupationalHealthActivity.update({
        where: { id: activityId },
        data: { linkedOperationalPlanItemId: item.id },
      });
      await this.audit.record(
        {
          organizationId,
          actorUserId: userId,
          action: 'OCCUPATIONAL_HEALTH_ACTIVITY_PLAN_ITEM_LINKED',
          entityType: 'OccupationalHealthActivity',
          entityId: activityId,
          metadata: { operationalPlanItemId: item.id, humanConfirmed: true },
          ...context,
        },
        tx,
      );
      return row;
    });
    return this.getOccupationalProgram(organizationId, updated.programId);
  }

  async listPsychosocialPrograms(organizationId: string) {
    return this.prisma.psychosocialProgram.findMany({
      where: { organizationId },
      include: psychosocialProgramInclude,
      orderBy: [{ periodStart: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getPsychosocialProgram(organizationId: string, id: string) {
    const program = await this.prisma.psychosocialProgram.findFirst({
      where: { id, organizationId },
      include: psychosocialProgramInclude,
    });
    if (!program) throw new NotFoundException('Programa de prevención psicosocial no encontrado.');
    return program;
  }

  async getPsychosocialLegalContext(organizationId: string) {
    const [organization, profile] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { country: true },
      }),
      this.prisma.organizationSstProfileVersion.findFirst({
        where: { organizationId },
        orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
        select: { snapshot: true },
      }),
    ]);
    if (!organization) throw new NotFoundException('Organización no encontrada.');
    const snapshot = profile?.snapshot as { organization?: { workerCount?: unknown } } | undefined;
    const source = await this.prisma.regulatorySourceVersion.findFirst({
      where: {
        catalogVersion: 2,
        source: { sourceKey: 'EC_MDT_2024_196' },
        officialDocumentLocated: true,
      },
      select: { id: true },
    });
    const context = resolvePsychosocialLegalContext({
      country: organization.country,
      totalWorkerCount: snapshot?.organization?.workerCount,
      sourceAvailable: source?.id === 'a2000000-0000-4000-8000-000000000012',
    });
    if (context.source && source) context.source.sourceVersionId = source.id;
    return context;
  }

  async createPsychosocialProgram(
    organizationId: string,
    userId: string,
    input: CreatePsychosocialProgramDto,
    context: Context,
    idempotencyKey?: string,
  ) {
    this.assertDateRange(input.periodStart, input.periodEnd);
    await this.requireOptionalMember(organizationId, input.responsibleUserId);
    const fingerprint = adaptiveContentHash(input);
    return this.prisma.$transaction(async (tx) => {
      const receipt = await this.findReceipt(
        tx,
        organizationId,
        userId,
        'PSYCHOSOCIAL_PROGRAM_CREATED',
        idempotencyKey,
        fingerprint,
      );
      if (receipt) return this.getPsychosocialProgramTx(tx, organizationId, receipt.entityId);
      const program = await tx.psychosocialProgram.create({
        data: {
          organizationId,
          periodStart: new Date(input.periodStart),
          periodEnd: new Date(input.periodEnd),
          title: input.title,
          responsibleUserId: input.responsibleUserId,
          notes: input.notes,
          createdById: userId,
        },
        include: psychosocialProgramInclude,
      });
      await this.audit.record(
        {
          organizationId,
          actorUserId: userId,
          action: 'PSYCHOSOCIAL_PROGRAM_CREATED',
          entityType: 'PsychosocialProgram',
          entityId: program.id,
          metadata: {
            ...this.idempotencyMetadata(idempotencyKey, fingerprint),
          },
          ...context,
        },
        tx,
      );
      return program;
    });
  }

  async updatePsychosocialProgram(
    organizationId: string,
    userId: string,
    id: string,
    input: UpdatePsychosocialProgramDto,
    context: Context,
  ) {
    const current = await this.prisma.psychosocialProgram.findFirst({
      where: { id, organizationId },
    });
    if (!current) throw new NotFoundException('Programa de prevención psicosocial no encontrado.');
    const start = input.periodStart ?? current.periodStart.toISOString();
    const end = input.periodEnd ?? current.periodEnd.toISOString();
    this.assertDateRange(start, end);
    await this.requireOptionalMember(organizationId, input.responsibleUserId);
    const updated = await this.prisma.$transaction(async (tx) => {
      const program = await tx.psychosocialProgram.update({
        where: { id },
        data: {
          ...(input.periodStart ? { periodStart: new Date(input.periodStart) } : {}),
          ...(input.periodEnd ? { periodEnd: new Date(input.periodEnd) } : {}),
          ...(input.status ? { status: input.status } : {}),
          ...(input.title ? { title: input.title } : {}),
          ...(input.responsibleUserId !== undefined
            ? { responsibleUserId: input.responsibleUserId }
            : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        },
        include: psychosocialProgramInclude,
      });
      await this.audit.record(
        {
          organizationId,
          actorUserId: userId,
          action: 'PSYCHOSOCIAL_PROGRAM_UPDATED',
          entityType: 'PsychosocialProgram',
          entityId: id,
          metadata: { changedFields: Object.keys(input) },
          ...context,
        },
        tx,
      );
      return program;
    });
    return updated;
  }

  async createPsychosocialCycle(
    organizationId: string,
    userId: string,
    programId: string,
    input: CreatePsychosocialAssessmentCycleDto,
    context: Context,
    idempotencyKey?: string,
  ) {
    await this.requirePsychosocialProgram(organizationId, programId);
    this.assertAggregateCounts(input.targetPopulationCount, input.participantCount);
    const instrumentSourceVersionId = await this.resolveInstrumentSourceVersion(
      input.instrumentSourceType,
      input.instrumentSourceVersionId,
    );
    const fingerprint = adaptiveContentHash({ ...input, instrumentSourceVersionId });
    return this.prisma.$transaction(async (tx) => {
      const receipt = await this.findReceipt(
        tx,
        organizationId,
        userId,
        'PSYCHOSOCIAL_CYCLE_CREATED',
        idempotencyKey,
        fingerprint,
      );
      if (receipt) return this.getPsychosocialProgramTx(tx, organizationId, programId);
      const cycle = await tx.psychosocialAssessmentCycle.create({
        data: {
          organizationId,
          programId,
          instrumentName: input.instrumentName,
          instrumentVersion: input.instrumentVersion,
          instrumentProvider: input.instrumentProvider,
          instrumentSourceType: input.instrumentSourceType,
          instrumentSourceVersionId,
          validationReference: input.validationReference,
          plannedAt: input.plannedAt ? new Date(input.plannedAt) : undefined,
          completedAt: input.completedAt ? new Date(input.completedAt) : undefined,
          status: input.completedAt ? 'COMPLETED' : undefined,
          targetPopulationCount: input.targetPopulationCount,
          participantCount: input.participantCount,
          aggregateReportAvailable: input.aggregateReportAvailable ?? false,
          aggregateReportUrl: input.aggregateReportUrl,
          evidenceNote: input.evidenceNote,
          notes: input.notes,
          createdById: userId,
        },
      });
      await this.audit.record(
        {
          organizationId,
          actorUserId: userId,
          action: 'PSYCHOSOCIAL_CYCLE_CREATED',
          entityType: 'PsychosocialAssessmentCycle',
          entityId: cycle.id,
          metadata: {
            ...this.idempotencyMetadata(idempotencyKey, fingerprint),
            programId,
            aggregateOnly: true,
            instrumentSourceVersionId,
          },
          ...context,
        },
        tx,
      );
      if (input.evidenceNote || input.aggregateReportUrl)
        await this.recordEvidenceLinked(
          tx,
          organizationId,
          userId,
          'PsychosocialAssessmentCycle',
          cycle.id,
          context,
        );
      return this.getPsychosocialProgramTx(tx, organizationId, programId);
    });
  }

  async updatePsychosocialCycle(
    organizationId: string,
    userId: string,
    id: string,
    input: UpdatePsychosocialAssessmentCycleDto,
    context: Context,
  ) {
    const current = await this.prisma.psychosocialAssessmentCycle.findFirst({
      where: { id, organizationId },
    });
    if (!current) throw new NotFoundException('Ciclo de evaluación psicosocial no encontrado.');
    this.assertAggregateCounts(
      input.targetPopulationCount ?? current.targetPopulationCount ?? undefined,
      input.participantCount ?? current.participantCount ?? undefined,
    );
    const instrumentSourceType = input.instrumentSourceType ?? current.instrumentSourceType;
    const instrumentSourceVersionId =
      input.instrumentSourceType || input.instrumentSourceVersionId
        ? await this.resolveInstrumentSourceVersion(
            instrumentSourceType,
            input.instrumentSourceVersionId,
          )
        : current.instrumentSourceVersionId;
    const updated = await this.prisma.$transaction(async (tx) => {
      const cycle = await tx.psychosocialAssessmentCycle.update({
        where: { id },
        data: {
          ...(input.status ? { status: input.status } : {}),
          ...(input.instrumentName ? { instrumentName: input.instrumentName } : {}),
          ...(input.instrumentVersion !== undefined
            ? { instrumentVersion: input.instrumentVersion }
            : {}),
          ...(input.instrumentProvider !== undefined
            ? { instrumentProvider: input.instrumentProvider }
            : {}),
          ...(input.instrumentSourceType
            ? { instrumentSourceType: input.instrumentSourceType }
            : {}),
          ...(input.instrumentSourceType || input.instrumentSourceVersionId !== undefined
            ? { instrumentSourceVersionId }
            : {}),
          ...(input.validationReference !== undefined
            ? { validationReference: input.validationReference }
            : {}),
          ...(input.plannedAt ? { plannedAt: new Date(input.plannedAt) } : {}),
          ...(input.completedAt ? { completedAt: new Date(input.completedAt) } : {}),
          ...(input.status === 'COMPLETED' && !input.completedAt
            ? { completedAt: new Date() }
            : {}),
          ...(input.targetPopulationCount !== undefined
            ? { targetPopulationCount: input.targetPopulationCount }
            : {}),
          ...(input.participantCount !== undefined
            ? { participantCount: input.participantCount }
            : {}),
          ...(input.aggregateReportAvailable !== undefined
            ? { aggregateReportAvailable: input.aggregateReportAvailable }
            : {}),
          ...(input.aggregateReportUrl !== undefined
            ? { aggregateReportUrl: input.aggregateReportUrl }
            : {}),
          ...(input.evidenceNote !== undefined ? { evidenceNote: input.evidenceNote } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        },
      });
      await this.audit.record(
        {
          organizationId,
          actorUserId: userId,
          action:
            input.status === 'COMPLETED'
              ? 'PSYCHOSOCIAL_CYCLE_COMPLETED'
              : 'PSYCHOSOCIAL_CYCLE_UPDATED',
          entityType: 'PsychosocialAssessmentCycle',
          entityId: id,
          metadata: { changedFields: Object.keys(input), aggregateOnly: true },
          ...context,
        },
        tx,
      );
      if (input.evidenceNote !== undefined || input.aggregateReportUrl !== undefined)
        await this.recordEvidenceLinked(
          tx,
          organizationId,
          userId,
          'PsychosocialAssessmentCycle',
          id,
          context,
        );
      return cycle;
    });
    return this.getPsychosocialProgram(organizationId, updated.programId);
  }

  async linkPsychosocialPlanItem(
    organizationId: string,
    userId: string,
    cycleId: string,
    operationalPlanItemId: string,
    context: Context,
  ) {
    const cycle = await this.prisma.psychosocialAssessmentCycle.findFirst({
      where: { id: cycleId, organizationId },
    });
    if (!cycle) throw new NotFoundException('Ciclo de evaluación psicosocial no encontrado.');
    const item = await this.prisma.operationalPlanItem.findFirst({
      where: { id: operationalPlanItemId, organizationId },
      select: { id: true },
    });
    if (!item) throw new NotFoundException('Ítem del Plan Operativo no encontrado.');
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.psychosocialAssessmentCycle.update({
        where: { id: cycleId },
        data: { linkedOperationalPlanItemId: item.id },
      });
      await this.audit.record(
        {
          organizationId,
          actorUserId: userId,
          action: 'PSYCHOSOCIAL_CYCLE_PLAN_ITEM_LINKED',
          entityType: 'PsychosocialAssessmentCycle',
          entityId: cycleId,
          metadata: { operationalPlanItemId: item.id, humanConfirmed: true },
          ...context,
        },
        tx,
      );
      return row;
    });
    return this.getPsychosocialProgram(organizationId, updated.programId);
  }

  private async requireOccupationalProgram(organizationId: string, id: string) {
    const program = await this.prisma.occupationalHealthProgram.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!program) throw new NotFoundException('Programa de salud en el trabajo no encontrado.');
  }

  private async requirePsychosocialProgram(organizationId: string, id: string) {
    const program = await this.prisma.psychosocialProgram.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!program) throw new NotFoundException('Programa de prevención psicosocial no encontrado.');
  }

  private async requireOptionalTenantReferences(
    organizationId: string,
    workCenterId?: string,
    userId?: string,
  ) {
    if (workCenterId) {
      const center = await this.prisma.workCenter.findFirst({
        where: { id: workCenterId, organizationId },
        select: { id: true },
      });
      if (!center)
        throw new BadRequestException(
          'El centro de trabajo no pertenece a la organización activa.',
        );
    }
    await this.requireOptionalMember(organizationId, userId);
  }

  private async requireOptionalMember(organizationId: string, userId?: string) {
    if (!userId) return;
    const membership = await this.prisma.membership.findFirst({
      where: { organizationId, userId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!membership)
      throw new BadRequestException(
        'La persona responsable no pertenece a la organización activa.',
      );
  }

  private async resolveInstrumentSourceVersion(
    sourceType: CreatePsychosocialAssessmentCycleDto['instrumentSourceType'],
    sourceVersionId?: string,
  ) {
    if (sourceType !== 'MINISTRY_QUESTIONNAIRE') {
      if (sourceVersionId)
        throw new BadRequestException(
          'Los instrumentos declarados no pueden presentarse como cuestionario oficial del Ministerio.',
        );
      return null;
    }
    const sourceVersion = sourceVersionId
      ? await this.prisma.regulatorySourceVersion.findFirst({
          where: {
            id: sourceVersionId,
            source: { sourceKey: 'EC_MDT_PSYCHOSOCIAL_QUESTIONNAIRE_2026' },
            catalogVersion: 1,
            officialDocumentLocated: true,
            artifactVerificationStatus: 'OFFICIAL_ARTIFACT_VERIFIED',
          },
          select: { id: true },
        })
      : await this.prisma.regulatorySourceVersion.findFirst({
          where: {
            source: { sourceKey: 'EC_MDT_PSYCHOSOCIAL_QUESTIONNAIRE_2026' },
            catalogVersion: 1,
            officialDocumentLocated: true,
            artifactVerificationStatus: 'OFFICIAL_ARTIFACT_VERIFIED',
          },
          select: { id: true },
        });
    if (!sourceVersion)
      throw new ServiceUnavailableException(
        'El cuestionario oficial del Ministerio no está disponible para vincularlo.',
      );
    return sourceVersion.id;
  }

  private assertDateRange(start: string, end: string) {
    if (new Date(end).getTime() < new Date(start).getTime())
      throw new BadRequestException('El período final debe ser posterior al inicial.');
  }

  private assertAggregateCounts(target?: number, participant?: number) {
    if (target !== undefined && participant !== undefined && participant > target)
      throw new BadRequestException(
        'La participación agregada no puede superar la población objetivo.',
      );
  }

  private assertEvidence(type?: ActionEvidenceType, note?: string, url?: string) {
    if ((note || url) && !type) throw new BadRequestException('Selecciona un tipo de evidencia.');
    if (type === 'NOTE' && !note) throw new BadRequestException('Añade una nota de evidencia.');
    if (type === 'EXTERNAL_LINK' && !url)
      throw new BadRequestException('Añade un enlace HTTPS de evidencia.');
    if (type === 'NOTE' && url)
      throw new BadRequestException('La evidencia usa una nota o un enlace, no ambos.');
    if (type === 'EXTERNAL_LINK' && note)
      throw new BadRequestException('La evidencia usa una nota o un enlace, no ambos.');
    if (note && url)
      throw new BadRequestException('La evidencia usa una nota o un enlace, no ambos.');
  }

  private recordEvidenceLinked(
    tx: Prisma.TransactionClient,
    organizationId: string,
    userId: string,
    entityType: string,
    entityId: string,
    context: Context,
  ) {
    return this.audit.record(
      {
        organizationId,
        actorUserId: userId,
        action: 'ORGANIZATIONAL_HEALTH_EVIDENCE_LINKED',
        entityType,
        entityId,
        metadata: { evidenceBoundary: 'NOTE_OR_EXTERNAL_LINK' },
        ...context,
      },
      tx,
    );
  }

  private idempotencyMetadata(key: string | undefined, fingerprint: string) {
    if (!key) return { creationFingerprint: fingerprint };
    return {
      idempotencyKeyHash: createHash('sha256').update(key.toLowerCase()).digest('hex'),
      creationFingerprint: fingerprint,
    };
  }

  private async findReceipt(
    tx: Prisma.TransactionClient,
    organizationId: string,
    userId: string,
    action: string,
    key: string | undefined,
    fingerprint: string,
  ): Promise<(IdempotencyReceipt & { entityId: string }) | null> {
    if (!key) return null;
    if (!isUUID(key, '4')) throw new BadRequestException('La clave de reintento no es válida.');
    const keyHash = createHash('sha256').update(key.toLowerCase()).digest('hex');
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${organizationId}:${keyHash}, 0))`,
    );
    const receipt = await tx.auditLog.findFirst({
      where: {
        organizationId,
        actorUserId: userId,
        action,
        metadata: { path: ['idempotencyKeyHash'], equals: keyHash },
      },
      select: { entityId: true, metadata: true },
    });
    if (!receipt) return null;
    const metadata = receipt.metadata as Prisma.JsonObject;
    if (metadata.creationFingerprint !== fingerprint || !receipt.entityId)
      throw new ConflictException({
        code: 'ORGANIZATIONAL_HEALTH_RETRY_CONFLICT',
        message: 'El intento anterior usó otros datos. Revisa el registro antes de reintentar.',
      });
    return { hash: keyHash, fingerprint, entityId: receipt.entityId };
  }

  private async getOccupationalProgramTx(
    tx: Prisma.TransactionClient | PrismaClient,
    organizationId: string,
    id: string,
  ) {
    const program = await tx.occupationalHealthProgram.findFirst({
      where: { id, organizationId },
      include: occupationalProgramInclude,
    });
    if (!program)
      throw new ConflictException('El registro del intento anterior ya no está disponible.');
    return program;
  }

  private async getPsychosocialProgramTx(
    tx: Prisma.TransactionClient | PrismaClient,
    organizationId: string,
    id: string,
  ) {
    const program = await tx.psychosocialProgram.findFirst({
      where: { id, organizationId },
      include: psychosocialProgramInclude,
    });
    if (!program)
      throw new ConflictException('El registro del intento anterior ya no está disponible.');
    return program;
  }
}
