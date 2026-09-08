import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  assertTrainingSessionTransition,
  deriveWorkerCompetencyStatus,
  trainingNeedRequiresApprovedRequirement,
} from '@sst/contracts';
import { AuditService, type AuditEvent } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CompleteTrainingParticipantDto,
  AddTrainingAudienceDto,
  CreateCompetencyRequirementDto,
  CreateTrainingDefinitionDto,
  CreateTrainingSessionDto,
  CreateTrainingNeedDto,
  EnrollTrainingParticipantDto,
  RecordTrainingAttendanceDto,
  TrainingDefinitionQueryDto,
  TrainingSessionQueryDto,
  TransitionTrainingSessionDto,
} from './dto';

type Context = Pick<AuditEvent, 'requestId' | 'ip' | 'userAgent'>;

const sessionInclude = {
  trainingDefinition: {
    select: {
      id: true,
      title: true,
      category: true,
      validityDays: true,
      isActive: true,
      deliveryClassification: true,
    },
  },
  workCenter: { select: { id: true, name: true } },
  workArea: { select: { id: true, name: true } },
  trainingNeed: { select: { id: true, sourceType: true, reason: true, requiredByDate: true } },
  responsibleUser: { select: { id: true, displayName: true } },
  createdBy: { select: { id: true, displayName: true } },
  participants: {
    select: {
      id: true,
      attendance: true,
      attendanceRecordedAt: true,
      attendanceEvidenceNote: true,
      attendanceEvidenceUrl: true,
      version: true,
      worker: {
        select: {
          id: true,
          displayName: true,
          status: true,
          internalCode: true,
          jobTitle: true,
          trainingRequirements: {
            where: { status: { not: 'CANCELLED' as const } },
            select: { id: true, trainingDefinitionId: true, reason: true, status: true },
            orderBy: { assignedAt: 'asc' as const },
          },
        },
      },
      attendanceRecordedBy: { select: { id: true, displayName: true } },
      completion: {
        select: {
          id: true,
          completedAt: true,
          validUntil: true,
          completionNote: true,
          certificateReference: true,
          evidenceUrl: true,
          renewsCompletionId: true,
          recordedBy: { select: { id: true, displayName: true } },
        },
      },
    },
    orderBy: { enrolledAt: 'asc' as const },
  },
  _count: { select: { participants: true, completions: true } },
} as const;

@Injectable()
export class TrainingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async definitions(organizationId: string, query: TrainingDefinitionQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.TrainingDefinitionWhereInput = {
      organizationId,
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              { category: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.trainingDefinition.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          validityDays: true,
          deliveryClassification: true,
          classificationProvenance: true,
          isActive: true,
          version: true,
          createdAt: true,
        },
        orderBy: [{ isActive: 'desc' }, { title: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.trainingDefinition.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async createDefinition(
    organizationId: string,
    userId: string,
    input: CreateTrainingDefinitionDto,
    context: Context,
  ) {
    try {
      const definition = await this.prisma.trainingDefinition.create({
        data: {
          organizationId,
          title: input.title.trim(),
          description: input.description?.trim(),
          category: input.category.trim(),
          validityDays: input.validityDays,
          deliveryClassification: input.deliveryClassification,
          classificationProvenance: input.classificationProvenance?.trim(),
          createdById: userId,
        },
      });
      await this.recordAudit(
        organizationId,
        userId,
        'TRAINING_DEFINITION_CREATED',
        'TrainingDefinition',
        definition.id,
        { validityDays: definition.validityDays },
        context,
      );
      return definition;
    } catch (error) {
      if (this.isUniqueConflict(error))
        throw new ConflictException('Ya existe una definición de capacitación con ese título.');
      throw error;
    }
  }

  needs(organizationId: string) {
    return this.prisma.trainingNeed.findMany({
      where: { organizationId },
      include: {
        trainingDefinition: { select: { id: true, title: true, deliveryClassification: true } },
        position: { select: { id: true, name: true } },
        workCenter: { select: { id: true, name: true } },
        workArea: { select: { id: true, name: true } },
        audiences: {
          include: {
            position: { select: { id: true, name: true } },
            worker: { select: { id: true, displayName: true } },
            workCenter: { select: { id: true, name: true } },
            workArea: { select: { id: true, name: true } },
          },
        },
        _count: { select: { sessions: true } },
      },
      orderBy: [{ requiredByDate: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async createNeed(
    organizationId: string,
    userId: string,
    input: CreateTrainingNeedDto,
    context: Context,
  ) {
    const references = await this.requireNeedReferences(organizationId, input);
    if (
      !trainingNeedRequiresApprovedRequirement({
        sourceType: input.sourceType,
        requirementEditorialStatus: references.requirementStatus,
      })
    ) {
      throw new BadRequestException(
        'Solo un requisito editorialmente aprobado puede originar una necesidad obligatoria.',
      );
    }
    this.assertNeedSource(input);
    const need = await this.prisma.trainingNeed.create({
      data: {
        organizationId,
        createdById: userId,
        trainingDefinitionId: input.trainingDefinitionId,
        linkedPlanItemId: input.linkedPlanItemId,
        sourceType: input.sourceType,
        reason: input.reason.trim(),
        positionId: input.positionId,
        workCenterId: input.workCenterId,
        workAreaId: input.workAreaId,
        linkedAssessmentId: input.linkedAssessmentId,
        linkedPpeRequirementId: input.linkedPpeRequirementId,
        linkedIncidentId: input.linkedIncidentId,
        linkedSafetyObservationId: input.linkedSafetyObservationId,
        linkedFindingId: input.linkedFindingId,
        linkedRegulatoryRequirementId: input.linkedRegulatoryRequirementId,
        requiredByDate: input.requiredByDate ? new Date(input.requiredByDate) : undefined,
        renewalRequired: input.renewalRequired,
      },
    });
    await this.recordAudit(
      organizationId,
      userId,
      'TRAINING_NEED_CREATED',
      'TrainingNeed',
      need.id,
      { sourceType: need.sourceType },
      context,
    );
    return need;
  }

  async addAudience(
    organizationId: string,
    needId: string,
    userId: string,
    input: AddTrainingAudienceDto,
    context: Context,
  ) {
    const need = await this.prisma.trainingNeed.findFirst({
      where: { id: needId, organizationId },
      select: { id: true },
    });
    if (!need) throw new NotFoundException('Necesidad de capacitación no encontrada.');
    this.assertAudience(input);
    await this.requireAudienceReference(organizationId, input);
    const audience = await this.prisma.trainingAudience.create({
      data: {
        organizationId,
        trainingNeedId: needId,
        type: input.type,
        positionId: input.positionId,
        workerId: input.workerId,
        workCenterId: input.workCenterId,
        workAreaId: input.workAreaId,
        groupLabel: input.groupLabel?.trim(),
      },
    });
    await this.recordAudit(
      organizationId,
      userId,
      'TRAINING_AUDIENCE_ADDED',
      'TrainingNeed',
      needId,
      { audienceType: input.type },
      context,
    );
    return audience;
  }

  async plan(organizationId: string) {
    const sessions = await this.prisma.trainingSession.findMany({
      where: { organizationId, status: { not: 'CANCELLED' } },
      include: sessionInclude,
      orderBy: [{ scheduledStart: 'asc' }, { id: 'asc' }],
    });
    return {
      generatedAt: new Date(),
      sessions,
      signaturePlaceholders: ['Responsable SST', 'Facilitador', 'Participantes'],
      printNotice:
        'Vista imprimible para firma manuscrita. No constituye firma electrónica ni certificación automática.',
    };
  }

  async sessions(organizationId: string, query: TrainingSessionQueryDto) {
    const where: Prisma.TrainingSessionWhereInput = {
      organizationId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.trainingDefinitionId ? { trainingDefinitionId: query.trainingDefinitionId } : {}),
      ...(query.workCenterId ? { workCenterId: query.workCenterId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.trainingSession.findMany({
        where,
        select: {
          id: true,
          scheduledStart: true,
          scheduledEnd: true,
          status: true,
          mode: true,
          instructorName: true,
          location: true,
          version: true,
          createdAt: true,
          trainingDefinition: { select: { id: true, title: true, validityDays: true } },
          workCenter: { select: { id: true, name: true } },
          workArea: { select: { id: true, name: true } },
          trainingNeed: { select: { id: true, sourceType: true, reason: true } },
          responsibleUser: { select: { id: true, displayName: true } },
          _count: { select: { participants: true, completions: true } },
        },
        orderBy: [{ scheduledStart: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.trainingSession.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async session(organizationId: string, sessionId: string) {
    const session = await this.prisma.trainingSession.findFirst({
      where: { id: sessionId, organizationId },
      include: sessionInclude,
    });
    if (!session) throw new NotFoundException('Sesión de capacitación no encontrada.');
    return session;
  }

  async createSession(
    organizationId: string,
    userId: string,
    input: CreateTrainingSessionDto,
    context: Context,
  ) {
    const [definition, workCenter, workArea, need, responsible] = await Promise.all([
      this.requireDefinition(organizationId, input.trainingDefinitionId, true),
      input.workCenterId
        ? this.prisma.workCenter.findFirst({
            where: { id: input.workCenterId, organizationId, isActive: true },
            select: { id: true },
          })
        : null,
      input.workAreaId
        ? this.prisma.workArea.findFirst({
            where: { id: input.workAreaId, organizationId, isActive: true },
            select: { id: true, workCenterId: true },
          })
        : null,
      input.trainingNeedId
        ? this.prisma.trainingNeed.findFirst({
            where: {
              id: input.trainingNeedId,
              organizationId,
              trainingDefinitionId: input.trainingDefinitionId,
            },
            select: { id: true },
          })
        : null,
      input.responsibleUserId
        ? this.prisma.membership.findFirst({
            where: { organizationId, userId: input.responsibleUserId, status: 'ACTIVE' },
            select: { id: true },
          })
        : null,
    ]);
    if (input.workCenterId && !workCenter)
      throw new BadRequestException('El centro de trabajo no pertenece a la organización.');
    if (input.workAreaId && !workArea)
      throw new BadRequestException('El área no pertenece a la organización.');
    if (workArea && input.workCenterId && workArea.workCenterId !== input.workCenterId)
      throw new BadRequestException('El área no pertenece al centro seleccionado.');
    if (input.trainingNeedId && !need)
      throw new BadRequestException('La necesidad no corresponde a la capacitación elegida.');
    if (input.responsibleUserId && !responsible)
      throw new BadRequestException('El responsable no tiene membresía activa.');
    const scheduledStart = new Date(input.scheduledStart);
    const scheduledEnd = new Date(input.scheduledEnd);
    if (scheduledEnd <= scheduledStart)
      throw new BadRequestException('La fecha de fin debe ser posterior al inicio.');
    const session = await this.prisma.trainingSession.create({
      data: {
        organizationId,
        trainingDefinitionId: definition.id,
        workCenterId: input.workCenterId,
        workAreaId: input.workAreaId,
        trainingNeedId: input.trainingNeedId,
        responsibleUserId: input.responsibleUserId,
        scheduledStart,
        scheduledEnd,
        mode: input.mode,
        instructorName: input.instructorName?.trim(),
        location: input.location?.trim(),
        createdById: userId,
      },
      include: sessionInclude,
    });
    await this.recordAudit(
      organizationId,
      userId,
      'TRAINING_SESSION_CREATED',
      'TrainingSession',
      session.id,
      { trainingDefinitionId: definition.id, workCenterId: input.workCenterId ?? null },
      context,
    );
    return session;
  }

  async transitionSession(
    organizationId: string,
    sessionId: string,
    userId: string,
    input: TransitionTrainingSessionDto,
    context: Context,
  ) {
    const session = await this.prisma.$transaction(async (tx) => {
      const current = await this.lockSession(tx, organizationId, sessionId);
      this.assertVersion(
        current.version,
        input.expectedVersion,
        'TRAINING_SESSION_VERSION_CONFLICT',
      );
      try {
        assertTrainingSessionTransition(current.status, input.status);
      } catch {
        throw new BadRequestException('La transición de la sesión no es válida.');
      }
      if (input.status === 'COMPLETED') {
        const participants = await tx.trainingParticipant.findMany({
          where: { organizationId, sessionId },
          select: { attendance: true },
        });
        if (participants.length === 0)
          throw new BadRequestException('La sesión debe tener al menos un participante.');
        if (participants.some((participant) => participant.attendance === null))
          throw new BadRequestException('Registra la asistencia de todos los participantes.');
      }
      const updated = await tx.trainingSession.updateMany({
        where: { id: sessionId, organizationId, version: input.expectedVersion },
        data: { status: input.status, version: { increment: 1 } },
      });
      this.assertSingleWriter(updated.count, 'TRAINING_SESSION_VERSION_CONFLICT');
      return tx.trainingSession.findUniqueOrThrow({
        where: { id: sessionId },
        include: sessionInclude,
      });
    });
    await this.recordAudit(
      organizationId,
      userId,
      'TRAINING_SESSION_TRANSITIONED',
      'TrainingSession',
      session.id,
      { status: session.status },
      context,
    );
    return session;
  }

  async enroll(
    organizationId: string,
    sessionId: string,
    userId: string,
    input: EnrollTrainingParticipantDto,
    context: Context,
  ) {
    const worker = await this.requireWorker(organizationId, input.workerId, true);
    const session = await this.requireSession(organizationId, sessionId);
    if (!['DRAFT', 'SCHEDULED'].includes(session.status))
      throw new BadRequestException('La sesión ya no admite participantes.');
    try {
      const participant = await this.prisma.trainingParticipant.create({
        data: { organizationId, sessionId, workerId: worker.id },
        select: {
          id: true,
          sessionId: true,
          attendance: true,
          version: true,
          worker: { select: { id: true, displayName: true, status: true } },
        },
      });
      await this.recordAudit(
        organizationId,
        userId,
        'TRAINING_PARTICIPANT_ENROLLED',
        'TrainingParticipant',
        participant.id,
        { sessionId, workerId: worker.id },
        context,
      );
      return participant;
    } catch (error) {
      if (this.isUniqueConflict(error))
        throw new ConflictException('El trabajador ya está inscrito en la sesión.');
      throw error;
    }
  }

  async attendance(
    organizationId: string,
    sessionId: string,
    participantId: string,
    userId: string,
    input: RecordTrainingAttendanceDto,
    context: Context,
  ) {
    this.assertEvidence(input.evidenceNote, input.evidenceUrl);
    const participant = await this.prisma.$transaction(async (tx) => {
      const current = await this.lockParticipant(tx, organizationId, sessionId, participantId);
      this.assertVersion(
        current.version,
        input.expectedVersion,
        'TRAINING_PARTICIPANT_VERSION_CONFLICT',
      );
      if (current.session.status !== 'SCHEDULED')
        throw new BadRequestException('La asistencia se registra en una sesión programada.');
      const updated = await tx.trainingParticipant.updateMany({
        where: { id: participantId, organizationId, version: input.expectedVersion },
        data: {
          attendance: input.attendance,
          attendanceRecordedAt: new Date(),
          attendanceRecordedById: userId,
          attendanceEvidenceNote: input.evidenceNote?.trim(),
          attendanceEvidenceUrl: input.evidenceUrl,
          version: { increment: 1 },
        },
      });
      this.assertSingleWriter(updated.count, 'TRAINING_PARTICIPANT_VERSION_CONFLICT');
      return tx.trainingParticipant.findUniqueOrThrow({
        where: { id: participantId },
        select: {
          id: true,
          sessionId: true,
          workerId: true,
          attendance: true,
          attendanceRecordedAt: true,
          attendanceEvidenceNote: true,
          attendanceEvidenceUrl: true,
          version: true,
        },
      });
    });
    await this.recordAudit(
      organizationId,
      userId,
      'TRAINING_ATTENDANCE_RECORDED',
      'TrainingParticipant',
      participant.id,
      { sessionId, workerId: participant.workerId, attendance: participant.attendance },
      context,
    );
    return participant;
  }

  async createRequirement(
    organizationId: string,
    userId: string,
    input: CreateCompetencyRequirementDto,
    context: Context,
  ) {
    const [worker, definition] = await Promise.all([
      this.requireWorker(organizationId, input.workerId, true),
      this.requireDefinition(organizationId, input.trainingDefinitionId, true),
      this.requireRequirementReferences(organizationId, input),
    ]);
    const requirement = await this.prisma.workerCompetencyRequirement.create({
      data: {
        organizationId,
        workerId: worker.id,
        trainingDefinitionId: definition.id,
        linkedAssessmentId: input.linkedAssessmentId,
        linkedRegulatoryRequirementId: input.linkedRegulatoryRequirementId,
        reason: input.reason.trim(),
        requiredByDate: input.requiredByDate ? new Date(input.requiredByDate) : undefined,
        renewalRequired: input.renewalRequired ?? true,
        assignedById: userId,
      },
      select: {
        id: true,
        workerId: true,
        trainingDefinitionId: true,
        reason: true,
        requiredByDate: true,
        renewalRequired: true,
        status: true,
        version: true,
        linkedAssessment: { select: { id: true, title: true } },
        linkedRegulatoryRequirement: {
          select: { id: true, title: true, editorialStatus: true },
        },
      },
    });
    await this.recordAudit(
      organizationId,
      userId,
      'TRAINING_REQUIREMENT_CREATED',
      'WorkerCompetencyRequirement',
      requirement.id,
      {
        workerId: worker.id,
        trainingDefinitionId: definition.id,
        linkedAssessmentId: input.linkedAssessmentId ?? null,
        linkedRegulatoryRequirementId: input.linkedRegulatoryRequirementId ?? null,
      },
      context,
    );
    return requirement;
  }

  async completeParticipant(
    organizationId: string,
    sessionId: string,
    participantId: string,
    userId: string,
    input: CompleteTrainingParticipantDto,
    context: Context,
  ) {
    const completion = await this.prisma.$transaction(async (tx) => {
      const participant = await this.lockParticipant(tx, organizationId, sessionId, participantId);
      this.assertVersion(
        participant.version,
        input.expectedVersion,
        'TRAINING_PARTICIPANT_VERSION_CONFLICT',
      );
      if (!['SCHEDULED', 'COMPLETED'].includes(participant.session.status))
        throw new BadRequestException(
          'La sesión debe estar programada para registrar completitud.',
        );
      if (!participant.attendance || participant.attendance === 'ABSENT')
        throw new BadRequestException(
          'Solo una asistencia presente o parcial permite registrar completitud.',
        );
      let requirement: {
        id: string;
        workerId: string;
        trainingDefinitionId: string;
        status: string;
      } | null = null;
      if (input.requirementId) {
        requirement = await this.lockRequirement(tx, organizationId, input.requirementId);
        if (
          requirement.workerId !== participant.workerId ||
          requirement.trainingDefinitionId !== participant.session.trainingDefinitionId ||
          !['REQUIRED', 'FULFILLED'].includes(requirement.status)
        ) {
          throw new BadRequestException(
            'El requisito no corresponde al trabajador y a esta capacitación.',
          );
        }
      }
      const completedAt = new Date(input.completedAt);
      const latest = await tx.workerTrainingCompletion.findFirst({
        where: {
          organizationId,
          workerId: participant.workerId,
          trainingDefinitionId: participant.session.trainingDefinitionId,
        },
        select: { id: true },
        orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
      });
      const validUntil = this.validUntil(
        completedAt,
        participant.session.trainingDefinition.validityDays,
      );
      let created;
      try {
        created = await tx.workerTrainingCompletion.create({
          data: {
            organizationId,
            workerId: participant.workerId,
            trainingDefinitionId: participant.session.trainingDefinitionId,
            sessionId,
            participantId,
            requirementId: input.requirementId,
            completedAt,
            completionNote: input.completionNote?.trim(),
            certificateReference: input.certificateReference?.trim(),
            evidenceUrl: input.evidenceUrl,
            validUntil,
            recordedById: userId,
            renewsCompletionId: latest?.id,
          },
          select: {
            id: true,
            workerId: true,
            trainingDefinitionId: true,
            sessionId: true,
            participantId: true,
            requirementId: true,
            completedAt: true,
            validUntil: true,
            completionNote: true,
            certificateReference: true,
            evidenceUrl: true,
            renewsCompletionId: true,
          },
        });
      } catch (error) {
        if (this.isUniqueConflict(error))
          throw new ConflictException({
            code: 'TRAINING_COMPLETION_DUPLICATE',
            message: 'La completitud de este participante ya fue registrada.',
          });
        throw error;
      }
      if (requirement?.status === 'REQUIRED') {
        await tx.workerCompetencyRequirement.update({
          where: { id: requirement.id },
          data: { status: 'FULFILLED', fulfilledAt: completedAt, version: { increment: 1 } },
        });
      }
      const updated = await tx.trainingParticipant.updateMany({
        where: { id: participantId, organizationId, version: input.expectedVersion },
        data: { version: { increment: 1 } },
      });
      this.assertSingleWriter(updated.count, 'TRAINING_PARTICIPANT_VERSION_CONFLICT');
      return created;
    });
    await this.recordAudit(
      organizationId,
      userId,
      'TRAINING_COMPLETION_RECORDED',
      'WorkerTrainingCompletion',
      completion.id,
      {
        workerId: completion.workerId,
        sessionId,
        renewsCompletionId: completion.renewsCompletionId ?? null,
      },
      context,
    );
    return completion;
  }

  async workerWorkspace(organizationId: string, workerId: string) {
    const worker = await this.prisma.worker.findFirst({
      where: { id: workerId, organizationId },
      select: { id: true, displayName: true, status: true, workCenterId: true },
    });
    if (!worker) throw new NotFoundException('Trabajador no encontrado.');
    const [requirements, completions] = await Promise.all([
      this.prisma.workerCompetencyRequirement.findMany({
        where: { organizationId, workerId },
        select: {
          id: true,
          reason: true,
          requiredByDate: true,
          renewalRequired: true,
          status: true,
          assignedAt: true,
          fulfilledAt: true,
          version: true,
          trainingDefinition: {
            select: { id: true, title: true, category: true, validityDays: true, isActive: true },
          },
          linkedAssessment: { select: { id: true, title: true } },
          linkedRegulatoryRequirement: {
            select: { id: true, title: true, editorialStatus: true },
          },
          assignedBy: { select: { id: true, displayName: true } },
        },
        orderBy: { assignedAt: 'desc' },
      }),
      this.prisma.workerTrainingCompletion.findMany({
        where: { organizationId, workerId },
        select: {
          id: true,
          trainingDefinitionId: true,
          completedAt: true,
          validUntil: true,
          completionNote: true,
          certificateReference: true,
          evidenceUrl: true,
          renewsCompletionId: true,
          trainingDefinition: { select: { id: true, title: true, category: true } },
          session: {
            select: { id: true, scheduledStart: true, mode: true, instructorName: true },
          },
          recordedBy: { select: { id: true, displayName: true } },
        },
        orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);
    const now = new Date();
    const latestByDefinition = new Map<string, (typeof completions)[number]>();
    for (const completion of completions) {
      if (!latestByDefinition.has(completion.trainingDefinitionId))
        latestByDefinition.set(completion.trainingDefinitionId, completion);
    }
    return {
      worker,
      requirements: requirements.map((requirement) => {
        const latest = latestByDefinition.get(requirement.trainingDefinition.id);
        return {
          ...requirement,
          competencyStatus: deriveWorkerCompetencyStatus({
            completionExists: Boolean(latest),
            validUntil: latest?.validUntil ?? null,
            now,
          }),
          latestCompletionId: latest?.id ?? null,
          regulatoryContext: requirement.linkedRegulatoryRequirement
            ? {
                ...requirement.linkedRegulatoryRequirement,
                candidate:
                  requirement.linkedRegulatoryRequirement.editorialStatus !==
                  'APPROVED_FOR_RULE_DRAFTING',
              }
            : null,
        };
      }),
      completions: completions.map((completion, index) => ({
        ...completion,
        competencyStatus:
          latestByDefinition.get(completion.trainingDefinitionId)?.id === completion.id
            ? deriveWorkerCompetencyStatus({
                completionExists: true,
                validUntil: completion.validUntil,
                now,
              })
            : 'HISTORICAL',
        historyOrder: index + 1,
      })),
    };
  }

  private assertNeedSource(input: CreateTrainingNeedDto) {
    const sourceFields: Record<string, keyof CreateTrainingNeedDto | null> = {
      PLAN: 'linkedPlanItemId',
      RISK: 'linkedAssessmentId',
      POSITION: 'positionId',
      PPE_REQUIREMENT: 'linkedPpeRequirementId',
      INCIDENT: 'linkedIncidentId',
      SAFETY_OBSERVATION: 'linkedSafetyObservationId',
      FINDING: 'linkedFindingId',
      APPROVED_REQUIREMENT: 'linkedRegulatoryRequirementId',
      MANUAL: null,
    };
    const expected = sourceFields[input.sourceType];
    if (expected && !input[expected])
      throw new BadRequestException(
        'La necesidad requiere la referencia de procedencia seleccionada.',
      );
  }

  private async requireNeedReferences(organizationId: string, input: CreateTrainingNeedDto) {
    const [
      definition,
      planItem,
      position,
      center,
      area,
      assessment,
      ppeRequirement,
      incident,
      observation,
      finding,
      requirement,
    ] = await Promise.all([
      this.requireDefinition(organizationId, input.trainingDefinitionId, true),
      input.linkedPlanItemId
        ? this.prisma.operationalPlanItem.findFirst({
            where: { id: input.linkedPlanItemId, organizationId },
            select: { id: true },
          })
        : null,
      input.positionId
        ? this.prisma.position.findFirst({
            where: { id: input.positionId, organizationId, isActive: true },
            select: { id: true },
          })
        : null,
      input.workCenterId
        ? this.prisma.workCenter.findFirst({
            where: { id: input.workCenterId, organizationId, isActive: true },
            select: { id: true },
          })
        : null,
      input.workAreaId
        ? this.prisma.workArea.findFirst({
            where: { id: input.workAreaId, organizationId, isActive: true },
            select: { id: true, workCenterId: true },
          })
        : null,
      input.linkedAssessmentId
        ? this.prisma.technicalAssessment.findFirst({
            where: { id: input.linkedAssessmentId, organizationId },
            select: { id: true },
          })
        : null,
      input.linkedPpeRequirementId
        ? this.prisma.positionPpeRequirement.findFirst({
            where: { id: input.linkedPpeRequirementId, organizationId, isActive: true },
            select: { id: true },
          })
        : null,
      input.linkedIncidentId
        ? this.prisma.incident.findFirst({
            where: { id: input.linkedIncidentId, organizationId },
            select: { id: true },
          })
        : null,
      input.linkedSafetyObservationId
        ? this.prisma.safetyObservation.findFirst({
            where: { id: input.linkedSafetyObservationId, organizationId },
            select: { id: true },
          })
        : null,
      input.linkedFindingId
        ? this.prisma.inspectionFinding.findFirst({
            where: { id: input.linkedFindingId, organizationId },
            select: { id: true },
          })
        : null,
      input.linkedRegulatoryRequirementId
        ? this.prisma.regulatoryRequirement.findUnique({
            where: { id: input.linkedRegulatoryRequirementId },
            select: { id: true, editorialStatus: true },
          })
        : null,
    ]);
    const checks: Array<[unknown, unknown, string]> = [
      [input.linkedPlanItemId, planItem, 'El ítem del plan no pertenece a la organización.'],
      [input.positionId, position, 'El cargo no pertenece a la organización.'],
      [input.workCenterId, center, 'El centro no pertenece a la organización.'],
      [input.workAreaId, area, 'El área no pertenece a la organización.'],
      [input.linkedAssessmentId, assessment, 'La evaluación no pertenece a la organización.'],
      [
        input.linkedPpeRequirementId,
        ppeRequirement,
        'El requisito EPP no pertenece a la organización.',
      ],
      [input.linkedIncidentId, incident, 'El incidente no pertenece a la organización.'],
      [
        input.linkedSafetyObservationId,
        observation,
        'La observación no pertenece a la organización.',
      ],
      [input.linkedFindingId, finding, 'El hallazgo no pertenece a la organización.'],
    ];
    for (const [requested, found, message] of checks)
      if (requested && !found) throw new BadRequestException(message);
    if (area && input.workCenterId && area.workCenterId !== input.workCenterId)
      throw new BadRequestException('El área no pertenece al centro seleccionado.');
    if (input.linkedRegulatoryRequirementId && !requirement)
      throw new BadRequestException('El requisito regulatorio no existe.');
    return { definition, requirementStatus: requirement?.editorialStatus ?? null };
  }

  private assertAudience(input: AddTrainingAudienceDto) {
    const expected: Record<string, keyof AddTrainingAudienceDto> = {
      POSITION: 'positionId',
      WORKER: 'workerId',
      WORK_CENTER: 'workCenterId',
      WORK_AREA: 'workAreaId',
      EXPLICIT_GROUP: 'groupLabel',
    };
    const populated = ['positionId', 'workerId', 'workCenterId', 'workAreaId', 'groupLabel'].filter(
      (key) => Boolean(input[key as keyof AddTrainingAudienceDto]),
    );
    if (populated.length !== 1 || populated[0] !== expected[input.type])
      throw new BadRequestException(
        'La audiencia debe tener exactamente la referencia de su tipo.',
      );
  }

  private async requireAudienceReference(organizationId: string, input: AddTrainingAudienceDto) {
    const valid =
      input.type === 'POSITION'
        ? await this.prisma.position.findFirst({
            where: { id: input.positionId, organizationId, isActive: true },
            select: { id: true },
          })
        : input.type === 'WORKER'
          ? await this.prisma.worker.findFirst({
              where: { id: input.workerId, organizationId, status: 'ACTIVE' },
              select: { id: true },
            })
          : input.type === 'WORK_CENTER'
            ? await this.prisma.workCenter.findFirst({
                where: { id: input.workCenterId, organizationId, isActive: true },
                select: { id: true },
              })
            : input.type === 'WORK_AREA'
              ? await this.prisma.workArea.findFirst({
                  where: { id: input.workAreaId, organizationId, isActive: true },
                  select: { id: true },
                })
              : { id: 'explicit-group' };
    if (!valid)
      throw new BadRequestException('La audiencia no pertenece a la organización activa.');
  }

  private async requireWorker(organizationId: string, workerId: string, active: boolean) {
    const worker = await this.prisma.worker.findFirst({
      where: { id: workerId, organizationId, ...(active ? { status: 'ACTIVE' } : {}) },
      select: { id: true, status: true, workCenterId: true },
    });
    if (!worker)
      throw new BadRequestException(
        active
          ? 'El trabajador no pertenece a la organización o está inactivo.'
          : 'El trabajador no pertenece a la organización.',
      );
    return worker;
  }

  private async requireDefinition(organizationId: string, definitionId: string, active: boolean) {
    const definition = await this.prisma.trainingDefinition.findFirst({
      where: { id: definitionId, organizationId, ...(active ? { isActive: true } : {}) },
      select: { id: true, validityDays: true },
    });
    if (!definition)
      throw new BadRequestException('La capacitación no pertenece al catálogo activo.');
    return definition;
  }

  private async requireSession(organizationId: string, sessionId: string) {
    const session = await this.prisma.trainingSession.findFirst({
      where: { id: sessionId, organizationId },
      select: { id: true, status: true },
    });
    if (!session) throw new NotFoundException('Sesión de capacitación no encontrada.');
    return session;
  }

  private async requireRequirementReferences(
    organizationId: string,
    input: CreateCompetencyRequirementDto,
  ) {
    const [assessment, requirement] = await Promise.all([
      input.linkedAssessmentId
        ? this.prisma.technicalAssessment.findFirst({
            where: { id: input.linkedAssessmentId, organizationId },
            select: { id: true },
          })
        : null,
      input.linkedRegulatoryRequirementId
        ? this.prisma.regulatoryRequirement.findUnique({
            where: { id: input.linkedRegulatoryRequirementId },
            select: { id: true },
          })
        : null,
    ]);
    if (input.linkedAssessmentId && !assessment)
      throw new BadRequestException('La evaluación de riesgo no pertenece a la organización.');
    if (input.linkedRegulatoryRequirementId && !requirement)
      throw new BadRequestException('El requisito regulatorio no existe.');
  }

  private async lockSession(
    tx: Prisma.TransactionClient,
    organizationId: string,
    sessionId: string,
  ) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "TrainingSession"
      WHERE id = ${sessionId}::uuid AND "organizationId" = ${organizationId}::uuid
      FOR UPDATE
    `;
    if (rows.length !== 1) throw new NotFoundException('Sesión de capacitación no encontrada.');
    return tx.trainingSession.findUniqueOrThrow({
      where: { id: sessionId },
      select: { id: true, status: true, version: true },
    });
  }

  private async lockParticipant(
    tx: Prisma.TransactionClient,
    organizationId: string,
    sessionId: string,
    participantId: string,
  ) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "TrainingParticipant"
      WHERE id = ${participantId}::uuid
        AND "sessionId" = ${sessionId}::uuid
        AND "organizationId" = ${organizationId}::uuid
      FOR UPDATE
    `;
    if (rows.length !== 1) throw new NotFoundException('Participante no encontrado.');
    return tx.trainingParticipant.findUniqueOrThrow({
      where: { id: participantId },
      select: {
        id: true,
        workerId: true,
        attendance: true,
        version: true,
        session: {
          select: {
            status: true,
            trainingDefinitionId: true,
            trainingDefinition: { select: { validityDays: true } },
          },
        },
      },
    });
  }

  private async lockRequirement(
    tx: Prisma.TransactionClient,
    organizationId: string,
    requirementId: string,
  ) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "WorkerCompetencyRequirement"
      WHERE id = ${requirementId}::uuid AND "organizationId" = ${organizationId}::uuid
      FOR UPDATE
    `;
    if (rows.length !== 1) throw new BadRequestException('El requisito de capacitación no existe.');
    return tx.workerCompetencyRequirement.findUniqueOrThrow({
      where: { id: requirementId },
      select: { id: true, workerId: true, trainingDefinitionId: true, status: true },
    });
  }

  private validUntil(completedAt: Date, validityDays: number | null) {
    if (!validityDays) return null;
    const date = new Date(completedAt);
    date.setUTCDate(date.getUTCDate() + validityDays);
    return date;
  }

  private assertEvidence(note?: string, url?: string) {
    if (note && url)
      throw new BadRequestException('Registra una nota o un enlace de evidencia, no ambos.');
  }

  private assertVersion(current: number, expected: number, code: string) {
    if (current !== expected) this.assertSingleWriter(0, code);
  }

  private assertSingleWriter(count: number, code: string) {
    if (count !== 1)
      throw new ConflictException({
        code,
        message: 'El registro cambió en otra sesión. Actualiza e intenta nuevamente.',
      });
  }

  private isUniqueConflict(error: unknown) {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }

  private recordAudit(
    organizationId: string,
    actorUserId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata: Prisma.InputJsonObject,
    context: Context,
  ) {
    return this.audit.record({
      organizationId,
      actorUserId,
      action,
      entityType,
      entityId,
      metadata,
      ...context,
    });
  }
}
