import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, WorkPermitStatus } from '@prisma/client';
import { assertWorkPermitTransition, WORK_PERMIT_APPROVER_ROLES } from '@sst/contracts';
import { AuditService, type AuditEvent } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  ApproveWorkPermitDto,
  CreateWorkPermitDto,
  WorkPermitQueryDto,
  WorkPermitTransitionDto,
} from './dto';

type Context = Pick<AuditEvent, 'requestId' | 'ip' | 'userAgent'>;

const include = {
  workCenter: { select: { id: true, name: true } },
  requester: { select: { id: true, displayName: true } },
  approver: { select: { id: true, displayName: true } },
  closedBy: { select: { id: true, displayName: true } },
  permitTemplateVersion: {
    select: {
      id: true,
      version: true,
      disclaimer: true,
      permitTemplate: { select: { templateKey: true, name: true, isDemo: true } },
    },
  },
} as const;

@Injectable()
export class WorkPermitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  templates() {
    return this.prisma.permitTemplateVersion.findMany({
      where: { status: 'PUBLISHED' },
      select: {
        id: true,
        version: true,
        disclaimer: true,
        schema: true,
        permitTemplate: {
          select: { templateKey: true, name: true, description: true, isDemo: true },
        },
      },
      orderBy: [{ permitTemplate: { name: 'asc' } }, { version: 'desc' }],
    });
  }

  approvers(organizationId: string, requesterUserId: string) {
    return this.prisma.membership.findMany({
      where: {
        organizationId,
        status: 'ACTIVE',
        role: { in: [...WORK_PERMIT_APPROVER_ROLES] },
        userId: { not: requesterUserId },
      },
      select: {
        role: true,
        user: { select: { id: true, displayName: true, email: true } },
      },
      orderBy: [{ role: 'asc' }, { user: { displayName: 'asc' } }],
    });
  }

  async list(organizationId: string, query: WorkPermitQueryDto) {
    const where: Prisma.WorkPermitWhereInput = {
      organizationId,
      ...(query.status ? { status: query.status as WorkPermitStatus } : {}),
      ...(query.workCenterId ? { workCenterId: query.workCenterId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.workPermit.findMany({
        where,
        include,
        orderBy: [{ plannedStartAt: 'asc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.workPermit.count({ where }),
    ]);
    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async get(organizationId: string, id: string) {
    const permit = await this.prisma.workPermit.findFirst({
      where: { id, organizationId },
      include,
    });
    if (!permit) throw new NotFoundException('Permiso de trabajo no encontrado.');
    return permit;
  }

  async create(
    organizationId: string,
    userId: string,
    input: CreateWorkPermitDto,
    context: Context,
  ) {
    const start = new Date(input.plannedStartAt);
    const end = new Date(input.plannedEndAt);
    if (end <= start) throw new BadRequestException('La fecha final debe ser posterior al inicio.');
    if (
      input.hazards.length === 0 ||
      input.controls.length === 0 ||
      input.preconditions.length === 0
    )
      throw new BadRequestException(
        'Documenta peligros, controles y precondiciones antes de crear el permiso.',
      );
    if (input.approverUserId === userId) {
      throw new BadRequestException({
        code: 'WORK_PERMIT_SELF_APPROVER_FORBIDDEN',
        message: 'Selecciona una persona aprobadora diferente de quien solicita.',
      });
    }
    const [center, template, assessments, approverMembership] = await Promise.all([
      this.prisma.workCenter.findFirst({
        where: { id: input.workCenterId, organizationId, isActive: true },
        select: { id: true },
      }),
      this.prisma.permitTemplateVersion.findFirst({
        where: { id: input.permitTemplateVersionId, status: 'PUBLISHED' },
        select: {
          id: true,
          version: true,
          schema: true,
          contentHash: true,
          disclaimer: true,
          permitTemplate: { select: { templateKey: true, name: true, isDemo: true } },
        },
      }),
      input.linkedRiskAssessmentIds.length
        ? this.prisma.technicalAssessment.findMany({
            where: { organizationId, id: { in: input.linkedRiskAssessmentIds } },
            select: {
              id: true,
              title: true,
              status: true,
              methodSnapshot: true,
              result: { select: { level: true } },
            },
          })
        : [],
      this.prisma.membership.findFirst({
        where: {
          organizationId,
          userId: input.approverUserId,
          status: 'ACTIVE',
          role: { in: [...WORK_PERMIT_APPROVER_ROLES] },
        },
        select: { id: true },
      }),
    ]);
    if (!center)
      throw new BadRequestException('El centro de trabajo no pertenece a la organización activa.');
    if (!template) throw new BadRequestException('La plantilla publicada no está disponible.');
    if (!approverMembership) {
      throw new BadRequestException({
        code: 'WORK_PERMIT_APPROVER_NOT_ELIGIBLE',
        message: 'La persona aprobadora no pertenece a la organización o su rol no es elegible.',
      });
    }
    if (assessments.length !== new Set(input.linkedRiskAssessmentIds).size)
      throw new BadRequestException(
        'Una evaluación de riesgo vinculada no pertenece a la organización activa.',
      );
    const templateSnapshot = {
      templateKey: template.permitTemplate.templateKey,
      name: template.permitTemplate.name,
      isDemo: template.permitTemplate.isDemo,
      version: template.version,
      schema: template.schema,
      contentHash: template.contentHash,
      disclaimer: template.disclaimer,
    };
    const riskSnapshots = assessments.map((assessment) => {
      const method = assessment.methodSnapshot as { methodName?: string; methodVersion?: string };
      return {
        assessmentId: assessment.id,
        title: assessment.title,
        status: assessment.status,
        methodName: method.methodName ?? 'Método técnico registrado',
        methodVersion: method.methodVersion ?? null,
        level: assessment.result?.level ?? null,
      };
    });
    const permit = await this.prisma.workPermit.create({
      data: {
        organizationId,
        workCenterId: input.workCenterId,
        permitTemplateVersionId: template.id,
        templateSnapshot,
        area: input.area,
        activity: input.activity,
        plannedStartAt: start,
        plannedEndAt: end,
        requesterUserId: userId,
        approverUserId: input.approverUserId,
        hazards: input.hazards,
        linkedRiskReferences: riskSnapshots,
        controls: input.controls,
        preconditions: input.preconditions,
        evidenceReferences: input.evidenceReferences,
      },
      include,
    });
    await this.audit.record({
      organizationId,
      actorUserId: userId,
      action: 'WORK_PERMIT_CREATED',
      entityType: 'WorkPermit',
      entityId: permit.id,
      metadata: { templateVersionId: template.id, linkedRiskCount: riskSnapshots.length },
      ...context,
    });
    return permit;
  }

  async transition(
    organizationId: string,
    id: string,
    userId: string,
    input: WorkPermitTransitionDto,
    context: Context,
  ) {
    const current = await this.current(organizationId, id);
    this.assertExpectedVersion(current.version, input.expectedVersion);
    const target = input.status as WorkPermitStatus;
    if (target === 'AUTHORIZED')
      throw new BadRequestException('La autorización usa una decisión profesional separada.');
    try {
      assertWorkPermitTransition(current.status, target);
    } catch {
      throw new BadRequestException('La transición del permiso no está permitida.');
    }
    if (target === 'CLOSED' && !input.closureNote)
      throw new BadRequestException('Documenta el cierre del permiso.');
    const result = await this.prisma.workPermit.updateMany({
      where: { id, organizationId, version: input.expectedVersion, status: current.status },
      data: {
        status: target,
        closedAt: target === 'CLOSED' ? new Date() : undefined,
        closedByUserId: target === 'CLOSED' ? userId : undefined,
        closureNote: target === 'CLOSED' ? input.closureNote : undefined,
        version: { increment: 1 },
      },
    });
    this.singleWriter(result.count);
    await this.audit.record({
      organizationId,
      actorUserId: userId,
      action: 'WORK_PERMIT_TRANSITIONED',
      entityType: 'WorkPermit',
      entityId: id,
      metadata: { from: current.status, to: target },
      ...context,
    });
    return this.get(organizationId, id);
  }

  async approve(
    organizationId: string,
    id: string,
    userId: string,
    input: ApproveWorkPermitDto,
    context: Context,
  ) {
    const current = await this.current(organizationId, id);
    this.assertExpectedVersion(current.version, input.expectedVersion);
    if (current.status !== 'PENDING_APPROVAL')
      throw new BadRequestException('El permiso no está pendiente de aprobación.');
    if (current.requesterUserId === userId)
      throw new ForbiddenException({
        code: 'WORK_PERMIT_SELF_APPROVAL_FORBIDDEN',
        message: 'La persona solicitante no puede autorizar su propio permiso.',
      });
    if (current.approverUserId && current.approverUserId !== userId) {
      throw new ForbiddenException({
        code: 'WORK_PERMIT_ASSIGNED_APPROVER_REQUIRED',
        message: 'Este permiso está asignado a otra persona aprobadora.',
      });
    }
    const now = new Date();
    const result = await this.prisma.workPermit.updateMany({
      where: { id, organizationId, status: 'PENDING_APPROVAL', version: input.expectedVersion },
      data: {
        status: 'AUTHORIZED',
        approverUserId: userId,
        approvedAt: now,
        approvalComment: input.comment,
        version: { increment: 1 },
      },
    });
    this.singleWriter(result.count);
    await this.audit.record({
      organizationId,
      actorUserId: userId,
      action: 'WORK_PERMIT_AUTHORIZED',
      entityType: 'WorkPermit',
      entityId: id,
      metadata: { requesterUserId: current.requesterUserId },
      ...context,
    });
    return this.get(organizationId, id);
  }

  private async current(organizationId: string, id: string) {
    const permit = await this.prisma.workPermit.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        status: true,
        version: true,
        requesterUserId: true,
        approverUserId: true,
      },
    });
    if (!permit) throw new NotFoundException('Permiso de trabajo no encontrado.');
    return permit;
  }

  private singleWriter(count: number) {
    if (count !== 1)
      throw new ConflictException({
        code: 'WORK_PERMIT_VERSION_CONFLICT',
        message: 'El permiso cambió en otra sesión. Actualiza e intenta nuevamente.',
      });
  }

  private assertExpectedVersion(currentVersion: number, expectedVersion: number) {
    if (currentVersion !== expectedVersion) this.singleWriter(0);
  }
}
