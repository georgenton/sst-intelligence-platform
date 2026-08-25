import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, TechnicalAssessmentStatus } from '@prisma/client';
import {
  assertTechnicalAssessmentTransition,
  technicalMethodSchema,
  validateTechnicalAnswer,
  validateTechnicalAnswerSet,
  type TechnicalAnswerSet,
  type TechnicalMethodVersionSnapshot,
} from '@sst/contracts';
import { AuditService, type AuditEvent } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateTechnicalAssessmentDto,
  CreateTechnicalEvidenceDto,
  ReviewTechnicalAssessmentDto,
  UpdateTechnicalAssessmentDto,
} from './dto';
import { TechnicalCalculationRegistry } from './technical-calculation.registry';
import {
  TECHNICAL_ASSESSMENT_MUTATION_SYNC,
  type TechnicalAssessmentMutationOperation,
  type TechnicalAssessmentMutationSync,
} from './technical-assessment-mutation-sync';
import { TechnicalMethodService } from './technical-method.service';

type Context = Pick<AuditEvent, 'requestId' | 'ip' | 'userAgent'>;

const detailInclude = {
  workCenter: { select: { id: true, name: true, city: true } },
  workArea: { select: { id: true, name: true } },
  createdBy: { select: { id: true, displayName: true, email: true } },
  reviewedBy: { select: { id: true, displayName: true } },
  responses: { orderBy: { createdAt: 'asc' as const } },
  result: true,
  evidence: {
    include: { createdBy: { select: { id: true, displayName: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
  reviews: {
    include: { reviewer: { select: { id: true, displayName: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
  revisedFrom: {
    select: {
      id: true,
      title: true,
      status: true,
      methodVersionId: true,
      methodKey: true,
      methodVersion: true,
      reviews: {
        select: { decision: true, comment: true, createdAt: true },
        orderBy: { createdAt: 'desc' as const },
        take: 1,
      },
    },
  },
  revision: {
    select: { id: true, title: true, status: true, createdAt: true },
  },
} as const;

@Injectable()
export class TechnicalAssessmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly methods: TechnicalMethodService,
    private readonly calculations: TechnicalCalculationRegistry,
    @Inject(TECHNICAL_ASSESSMENT_MUTATION_SYNC)
    private readonly mutationSync: TechnicalAssessmentMutationSync,
  ) {}

  async list(organizationId: string) {
    const [items, statusRows, methodRows, centerRows, levelRows] = await Promise.all([
      this.prisma.technicalAssessment.findMany({
        where: { organizationId },
        include: {
          workCenter: { select: { id: true, name: true } },
          workArea: { select: { id: true, name: true } },
          result: { select: { score: true, level: true, calculatedAt: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.technicalAssessment.groupBy({
        by: ['status'],
        where: { organizationId },
        _count: { _all: true },
      }),
      this.prisma.technicalAssessment.groupBy({
        by: ['methodKey'],
        where: { organizationId },
        _count: { _all: true },
      }),
      this.prisma.technicalAssessment.groupBy({
        by: ['workCenterId'],
        where: { organizationId },
        _count: { _all: true },
      }),
      this.prisma.technicalAssessmentResult.groupBy({
        by: ['level'],
        where: { organizationId },
        _count: { _all: true },
      }),
    ]);
    const centerNames = await this.prisma.workCenter.findMany({
      where: { organizationId, id: { in: centerRows.map(({ workCenterId }) => workCenterId) } },
      select: { id: true, name: true },
    });
    const status = Object.fromEntries(statusRows.map((row) => [row.status, row._count._all]));
    return {
      items,
      analytics: {
        total: items.length,
        draft: status.DRAFT ?? 0,
        completed: status.COMPLETED ?? 0,
        reviewed: status.REVIEWED ?? 0,
        highCritical: levelRows
          .filter(({ level }) => level === 'HIGH' || level === 'CRITICAL')
          .reduce((sum, row) => sum + row._count._all, 0),
        byMethod: methodRows.map((row) => ({ methodKey: row.methodKey, count: row._count._all })),
        byCenter: centerRows.map((row) => ({
          workCenterId: row.workCenterId,
          name: centerNames.find(({ id }) => id === row.workCenterId)?.name ?? 'Centro',
          count: row._count._all,
        })),
        byRiskLevel: levelRows.map((row) => ({ level: row.level, count: row._count._all })),
      },
    };
  }

  async create(
    organizationId: string,
    userId: string,
    input: CreateTechnicalAssessmentDto,
    context: Context,
  ) {
    const [method, location] = await Promise.all([
      this.methods.getById(organizationId, input.methodVersionId),
      this.validateLocation(organizationId, input.workCenterId, input.workAreaId),
    ]);
    const snapshot = this.methods.snapshot(method);
    const assessment = await this.prisma.technicalAssessment.create({
      data: {
        organizationId,
        workCenterId: location.workCenterId,
        workAreaId: location.workAreaId,
        methodVersionId: method.id,
        methodKey: method.key,
        methodVersion: method.version,
        calculationKey: method.calculationKey,
        methodSnapshot: snapshot as unknown as Prisma.InputJsonValue,
        title: input.title.trim(),
        description: input.description?.trim(),
        createdById: userId,
        isDemo: method.isDemo,
      },
      include: detailInclude,
    });
    await this.audit.record({
      organizationId,
      actorUserId: userId,
      action: 'TECHNICAL_ASSESSMENT_CREATED',
      entityType: 'TechnicalAssessment',
      entityId: assessment.id,
      metadata: {
        methodKey: method.key,
        methodVersion: method.version,
        isDemo: method.isDemo,
      },
      ...context,
    });
    return assessment;
  }

  async get(organizationId: string, assessmentId: string) {
    const assessment = await this.prisma.technicalAssessment.findFirst({
      where: { id: assessmentId, organizationId },
      include: detailInclude,
    });
    if (!assessment) this.notFound();
    return assessment;
  }

  async update(organizationId: string, assessmentId: string, input: UpdateTechnicalAssessmentDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.claimEditableMutation(
        tx,
        organizationId,
        assessmentId,
        ['DRAFT', 'IN_PROGRESS'],
        'UPDATE_ASSESSMENT',
      );
      const current = await tx.technicalAssessment.findUniqueOrThrow({
        where: { id: assessmentId },
        select: { workCenterId: true, workAreaId: true },
      });
      const workCenterId = input.workCenterId ?? current.workCenterId;
      const workAreaId = input.workAreaId ?? current.workAreaId ?? undefined;
      const location = await this.validateLocation(organizationId, workCenterId, workAreaId, tx);
      return tx.technicalAssessment.update({
        where: { id: assessmentId },
        data: {
          workCenterId: location.workCenterId,
          workAreaId: location.workAreaId,
          title: input.title?.trim(),
          description: input.description?.trim(),
        },
        include: detailInclude,
      });
    });
  }

  async start(organizationId: string, assessmentId: string, userId: string, context: Context) {
    return this.prisma.$transaction(async (tx) => {
      const claim = await tx.technicalAssessment.updateMany({
        where: { id: assessmentId, organizationId, status: 'DRAFT' },
        data: { status: 'IN_PROGRESS', startedAt: new Date() },
      });
      if (claim.count !== 1) {
        const current = await tx.technicalAssessment.findFirst({
          where: { id: assessmentId, organizationId },
          select: { status: true },
        });
        if (!current) this.notFound();
        this.transition(current.status, 'IN_PROGRESS');
      }
      const assessment = await tx.technicalAssessment.findUniqueOrThrow({
        where: { id: assessmentId },
        include: detailInclude,
      });
      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId: userId,
          action: 'TECHNICAL_ASSESSMENT_STARTED',
          entityType: 'TechnicalAssessment',
          entityId: assessmentId,
          metadata: {},
          ...context,
        },
      });
      return assessment;
    });
  }

  async saveResponse(
    organizationId: string,
    assessmentId: string,
    questionKey: string,
    value: unknown,
    userId: string,
    context: Context,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.claimEditableMutation(
        tx,
        organizationId,
        assessmentId,
        ['IN_PROGRESS'],
        'UPSERT_RESPONSE',
      );
      const assessment = await tx.technicalAssessment.findUniqueOrThrow({
        where: { id: assessmentId },
        select: { methodSnapshot: true },
      });
      let validated: unknown;
      try {
        validated = validateTechnicalAnswer(
          this.snapshot(assessment.methodSnapshot).schema,
          questionKey,
          value,
        );
      } catch (error) {
        throw new BadRequestException({
          code: 'INVALID_TECHNICAL_RESPONSE',
          message: error instanceof Error ? error.message : 'La respuesta técnica no es válida.',
        });
      }
      const response = await tx.technicalAssessmentResponse.upsert({
        where: { assessmentId_questionKey: { assessmentId, questionKey } },
        update: { value: validated as Prisma.InputJsonValue },
        create: {
          organizationId,
          assessmentId,
          questionKey,
          value: validated as Prisma.InputJsonValue,
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId: userId,
          action: 'TECHNICAL_RESPONSE_SAVED',
          entityType: 'TechnicalAssessmentResponse',
          entityId: response.id,
          metadata: { assessmentId, questionKey, valueType: typeof validated },
          ...context,
        },
      });
      return response;
    });
  }

  async addEvidence(
    organizationId: string,
    assessmentId: string,
    userId: string,
    input: CreateTechnicalEvidenceDto,
    context: Context,
  ) {
    if (
      (input.type === 'NOTE' && !input.note) ||
      (input.type === 'EXTERNAL_LINK' && !input.externalUrl)
    ) {
      throw new BadRequestException({
        code: 'INVALID_TECHNICAL_EVIDENCE',
        message: 'La evidencia debe incluir el contenido correspondiente a su tipo.',
      });
    }
    return this.prisma.$transaction(async (tx) => {
      await this.claimEditableMutation(
        tx,
        organizationId,
        assessmentId,
        ['DRAFT', 'IN_PROGRESS'],
        'ADD_EVIDENCE',
      );
      const assessment = await tx.technicalAssessment.findUniqueOrThrow({
        where: { id: assessmentId },
        select: { methodSnapshot: true },
      });
      if (input.questionKey) {
        try {
          const schema = this.snapshot(assessment.methodSnapshot).schema;
          const exists = schema.sections.some((section) =>
            section.questions.some(({ key }) => key === input.questionKey),
          );
          if (!exists) throw new Error('unknown');
        } catch {
          throw new BadRequestException({
            code: 'UNKNOWN_TECHNICAL_QUESTION',
            message: 'La pregunta asociada no pertenece a este método.',
          });
        }
      }
      const evidence = await tx.technicalAssessmentEvidence.create({
        data: {
          organizationId,
          assessmentId,
          createdById: userId,
          questionKey: input.questionKey,
          type: input.type,
          note: input.note?.trim(),
          externalUrl: input.externalUrl,
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId: userId,
          action: 'TECHNICAL_EVIDENCE_ADDED',
          entityType: 'TechnicalAssessmentEvidence',
          entityId: evidence.id,
          metadata: { assessmentId, questionKey: input.questionKey ?? null, type: input.type },
          ...context,
        },
      });
      return evidence;
    });
  }

  async complete(organizationId: string, assessmentId: string, userId: string, context: Context) {
    return this.prisma.$transaction(async (tx) => {
      await this.mutationSync.point({
        assessmentId,
        operation: 'COMPLETE',
        phase: 'BEFORE_CLAIM',
        tx,
      });
      const claim = await tx.technicalAssessment.updateMany({
        where: { id: assessmentId, organizationId, status: 'IN_PROGRESS' },
        data: { status: 'COMPLETED' },
      });
      if (claim.count !== 1) {
        const current = await tx.technicalAssessment.findFirst({
          where: { id: assessmentId, organizationId },
          select: { status: true, result: { select: { id: true } } },
        });
        if (!current) this.notFound();
        if (!current.result && current.status !== 'COMPLETED' && current.status !== 'REVIEWED') {
          this.transition(current.status, 'COMPLETED');
        }
        throw new ConflictException({
          code: 'ASSESSMENT_ALREADY_COMPLETED',
          message: 'La evaluación técnica ya fue completada.',
        });
      }
      await this.mutationSync.point({
        assessmentId,
        operation: 'COMPLETE',
        phase: 'AFTER_SUCCESSFUL_CLAIM',
        tx,
      });
      const assessment = await tx.technicalAssessment.findUniqueOrThrow({
        where: { id: assessmentId },
        include: { responses: true },
      });
      const snapshot = this.snapshot(assessment.methodSnapshot);
      const rawAnswers = Object.fromEntries(
        assessment.responses.map(({ questionKey, value }) => [questionKey, value]),
      ) as TechnicalAnswerSet;
      let answers: TechnicalAnswerSet;
      try {
        answers = validateTechnicalAnswerSet(snapshot.schema, rawAnswers);
      } catch (error) {
        throw new BadRequestException({
          code: 'TECHNICAL_ASSESSMENT_INCOMPLETE',
          message: error instanceof Error ? error.message : 'Faltan respuestas obligatorias.',
        });
      }
      const calculated = this.calculations.calculate(snapshot, answers);
      const now = new Date();
      await tx.technicalAssessment.update({
        where: { id: assessmentId },
        data: { completedAt: now },
      });
      const result = await tx.technicalAssessmentResult.create({
        data: {
          organizationId,
          assessmentId,
          methodKey: assessment.methodKey,
          methodVersion: assessment.methodVersion,
          calculationKey: assessment.calculationKey,
          score: calculated.score,
          level: calculated.level,
          result: calculated.result as Prisma.InputJsonValue,
          calculatedAt: now,
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId: userId,
          action: 'TECHNICAL_ASSESSMENT_COMPLETED',
          entityType: 'TechnicalAssessment',
          entityId: assessmentId,
          metadata: {
            methodKey: assessment.methodKey,
            methodVersion: assessment.methodVersion,
            score: calculated.score,
            level: calculated.level,
          },
          ...context,
        },
      });
      return result;
    });
  }

  async review(
    organizationId: string,
    assessmentId: string,
    reviewerUserId: string,
    input: ReviewTechnicalAssessmentDto,
    context: Context,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const assessment = await tx.technicalAssessment.findFirst({
        where: { id: assessmentId, organizationId },
        select: {
          createdById: true,
          status: true,
          reviewedAt: true,
          result: { select: { level: true } },
        },
      });
      if (!assessment) this.notFound();
      const isSelfReview = assessment.createdById === reviewerUserId;
      const isElevatedSelfApproval =
        isSelfReview &&
        input.decision === 'APPROVED' &&
        (assessment.result?.level === 'HIGH' || assessment.result?.level === 'CRITICAL');
      const comment = input.comment?.trim();
      if (
        isElevatedSelfApproval &&
        (input.selfReviewAcknowledged !== true || !comment || comment.length < 10)
      ) {
        throw new BadRequestException({
          code: 'SELF_REVIEW_ACKNOWLEDGEMENT_REQUIRED',
          message: 'Confirma la autorrevisión y registra un comentario de al menos 10 caracteres.',
        });
      }
      const approved = input.decision === 'APPROVED';
      const reviewedAt = new Date();
      const claim = await tx.technicalAssessment.updateMany({
        where: { id: assessmentId, organizationId, status: 'COMPLETED', reviewedAt: null },
        data: {
          ...(approved ? { status: 'REVIEWED' as const } : {}),
          reviewedAt,
          reviewedById: reviewerUserId,
        },
      });
      if (claim.count !== 1) {
        const exists = await tx.technicalAssessment.findFirst({
          where: { id: assessmentId, organizationId },
          select: { id: true },
        });
        if (!exists) this.notFound();
        throw new ConflictException({
          code: 'ASSESSMENT_NOT_READY_FOR_REVIEW',
          message: 'Solo una evaluación completada puede revisarse.',
        });
      }
      const review = await tx.technicalAssessmentReview.create({
        data: {
          organizationId,
          assessmentId,
          reviewerUserId,
          decision: input.decision,
          comment,
          isSelfReview,
          selfReviewAcknowledged: isSelfReview && input.selfReviewAcknowledged === true,
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId: reviewerUserId,
          action: 'TECHNICAL_ASSESSMENT_REVIEWED',
          entityType: 'TechnicalAssessmentReview',
          entityId: review.id,
          metadata: {
            assessmentId,
            decision: input.decision,
            isSelfReview,
            selfReviewAcknowledged: isSelfReview && input.selfReviewAcknowledged === true,
          },
          ...context,
        },
      });
      return review;
    });
  }

  async createRevision(
    organizationId: string,
    sourceAssessmentId: string,
    userId: string,
    context: Context,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const source = await tx.technicalAssessment.findFirst({
          where: { id: sourceAssessmentId, organizationId },
          include: {
            responses: { orderBy: { createdAt: 'asc' } },
            reviews: { orderBy: { createdAt: 'desc' }, take: 1 },
            revision: { select: { id: true } },
          },
        });
        if (!source) this.notFound();
        if (
          source.status !== 'COMPLETED' ||
          source.reviews[0]?.decision !== 'NEEDS_REVISION' ||
          !source.reviewedAt
        ) {
          throw new ConflictException({
            code: 'REVISION_NOT_REQUESTED',
            message: 'Esta evaluación no tiene cambios pendientes solicitados por revisión.',
          });
        }
        if (source.revision) {
          throw new ConflictException({
            code: 'TECHNICAL_REVISION_ALREADY_EXISTS',
            message: 'Ya existe una corrección para esta evaluación.',
          });
        }
        const revision = await tx.technicalAssessment.create({
          data: {
            organizationId,
            workCenterId: source.workCenterId,
            workAreaId: source.workAreaId,
            methodVersionId: source.methodVersionId,
            methodKey: source.methodKey,
            methodVersion: source.methodVersion,
            calculationKey: source.calculationKey,
            methodSnapshot: source.methodSnapshot as Prisma.InputJsonValue,
            title: `${source.title} · Corrección`.slice(0, 160),
            description: source.description,
            createdById: userId,
            isDemo: source.isDemo,
            revisedFromAssessmentId: source.id,
            responses: {
              create: source.responses.map((response) => ({
                organizationId,
                questionKey: response.questionKey,
                value: response.value as Prisma.InputJsonValue,
              })),
            },
          },
          include: detailInclude,
        });
        await tx.auditLog.create({
          data: {
            organizationId,
            actorUserId: userId,
            action: 'TECHNICAL_ASSESSMENT_REVISION_CREATED',
            entityType: 'TechnicalAssessment',
            entityId: revision.id,
            metadata: {
              revisedFromAssessmentId: source.id,
              methodVersionId: source.methodVersionId,
              evidenceCopied: false,
            },
            ...context,
          },
        });
        return revision;
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException({
          code: 'TECHNICAL_REVISION_ALREADY_EXISTS',
          message: 'Ya existe una corrección para esta evaluación.',
        });
      }
      throw error;
    }
  }

  private async validateLocation(
    organizationId: string,
    workCenterId: string,
    workAreaId?: string,
    db: Pick<Prisma.TransactionClient, 'workCenter' | 'workArea'> = this.prisma,
  ) {
    const center = await db.workCenter.findFirst({
      where: { id: workCenterId, organizationId, isActive: true },
      select: { id: true },
    });
    if (!center) {
      throw new BadRequestException({
        code: 'INVALID_WORK_CENTER',
        message: 'El centro no pertenece a la organización activa.',
      });
    }
    if (!workAreaId) return { workCenterId, workAreaId: null };
    const area = await db.workArea.findFirst({
      where: { id: workAreaId, organizationId, workCenterId, isActive: true },
      select: { id: true },
    });
    if (!area) {
      throw new BadRequestException({
        code: 'INVALID_WORK_AREA',
        message: 'El área no pertenece al centro seleccionado.',
      });
    }
    return { workCenterId, workAreaId: area.id };
  }

  private async claimEditableMutation(
    tx: Prisma.TransactionClient,
    organizationId: string,
    assessmentId: string,
    statuses: TechnicalAssessmentStatus[],
    operation: TechnicalAssessmentMutationOperation,
  ) {
    await this.mutationSync.point({
      assessmentId,
      operation,
      phase: 'BEFORE_CLAIM',
      tx,
    });
    const claim = await tx.technicalAssessment.updateMany({
      where: { id: assessmentId, organizationId, status: { in: statuses } },
      data: { updatedAt: new Date() },
    });
    if (claim.count === 1) {
      await this.mutationSync.point({
        assessmentId,
        operation,
        phase: 'AFTER_SUCCESSFUL_CLAIM',
        tx,
      });
      return;
    }
    const exists = await tx.technicalAssessment.findFirst({
      where: { id: assessmentId, organizationId },
      select: { id: true },
    });
    if (!exists) this.notFound();
    this.notEditable();
  }

  private snapshot(value: Prisma.JsonValue): TechnicalMethodVersionSnapshot {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('INVALID_TECHNICAL_METHOD_SNAPSHOT');
    }
    const snapshot = value as Record<string, unknown>;
    return {
      methodKey: String(snapshot.methodKey),
      methodName: String(snapshot.methodName),
      methodVersion: String(snapshot.methodVersion),
      calculationKey: String(snapshot.calculationKey),
      regulatory: snapshot.regulatory === true,
      isDemo: snapshot.isDemo === true,
      country: typeof snapshot.country === 'string' ? snapshot.country : null,
      disclaimer: typeof snapshot.disclaimer === 'string' ? snapshot.disclaimer : null,
      schema: technicalMethodSchema.parse(snapshot.schema),
    };
  }

  private transition(from: TechnicalAssessmentStatus, to: TechnicalAssessmentStatus) {
    try {
      assertTechnicalAssessmentTransition(from, to);
    } catch {
      throw new ConflictException({
        code: 'INVALID_TECHNICAL_ASSESSMENT_TRANSITION',
        message: `La evaluación no puede cambiar de ${from} a ${to}.`,
      });
    }
  }

  private notFound(): never {
    throw new NotFoundException({
      code: 'TECHNICAL_ASSESSMENT_NOT_FOUND',
      message: 'La evaluación técnica no existe en la organización activa.',
    });
  }

  private notEditable(): never {
    throw new ConflictException({
      code: 'TECHNICAL_ASSESSMENT_NOT_EDITABLE',
      message: 'La evaluación técnica ya no admite cambios.',
    });
  }

  private isUniqueConstraintError(error: unknown): error is { code: string } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2002'
    );
  }
}
