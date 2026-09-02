import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  assertGovernanceActionTransition,
  assertGovernanceMeetingTransition,
  governanceRegulatoryReferenceLabel,
} from '@sst/contracts';
import { AuditService, type AuditEvent } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AddGovernanceMemberDto,
  CreateGovernanceActionDto,
  CreateGovernanceBodyDto,
  CreateGovernanceDecisionDto,
  CreateGovernanceEvidenceDto,
  CreateGovernanceMeetingDto,
  TransitionGovernanceActionDto,
  TransitionGovernanceMeetingDto,
} from './dto';

type Context = Pick<AuditEvent, 'requestId' | 'ip' | 'userAgent'>;

const governanceBodyInclude = {
  workCenter: { select: { id: true, name: true } },
  createdBy: { select: { id: true, displayName: true } },
  members: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      worker: { select: { id: true, displayName: true, status: true, linkedUserId: true } },
      membership: {
        select: {
          id: true,
          role: true,
          status: true,
          user: { select: { id: true, displayName: true, email: true } },
        },
      },
    },
  },
  meetings: {
    orderBy: { scheduledAt: 'desc' as const },
    include: {
      chairMembership: { select: { id: true, user: { select: { id: true, displayName: true } } } },
      secretaryMembership: {
        select: { id: true, user: { select: { id: true, displayName: true } } },
      },
      participants: {
        include: {
          governanceMember: {
            include: {
              worker: { select: { id: true, displayName: true, status: true } },
              membership: {
                select: {
                  id: true,
                  role: true,
                  status: true,
                  user: { select: { id: true, displayName: true } },
                },
              },
            },
          },
        },
      },
      agendaItems: { orderBy: { sortOrder: 'asc' as const } },
      decisions: {
        orderBy: { createdAt: 'asc' as const },
        include: {
          regulatoryUnit: {
            select: { id: true, identifier: true, locator: true, reviewStatus: true },
          },
          requirement: { select: { id: true, title: true, editorialStatus: true } },
          actions: {
            orderBy: { createdAt: 'asc' as const },
            include: {
              assignedToMembership: {
                select: {
                  id: true,
                  role: true,
                  status: true,
                  user: { select: { id: true, displayName: true } },
                },
              },
              evidence: { orderBy: { createdAt: 'asc' as const } },
            },
          },
          evidence: { orderBy: { createdAt: 'asc' as const } },
        },
      },
      evidence: { orderBy: { createdAt: 'asc' as const } },
    },
  },
} as const;

@Injectable()
export class GovernanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listBodies(organizationId: string) {
    return this.prisma.governanceBody.findMany({
      where: { organizationId },
      include: governanceBodyInclude,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async getBody(organizationId: string, bodyId: string) {
    const body = await this.prisma.governanceBody.findFirst({
      where: { id: bodyId, organizationId },
      include: governanceBodyInclude,
    });
    if (!body) throw new NotFoundException('Espacio de gobernanza no encontrado.');
    return body;
  }

  async createBody(
    organizationId: string,
    userId: string,
    input: CreateGovernanceBodyDto,
    context: Context,
  ) {
    if (input.workCenterId) await this.requireWorkCenter(organizationId, input.workCenterId);
    try {
      const body = await this.prisma.governanceBody.create({
        data: {
          organizationId,
          createdById: userId,
          name: input.name.trim(),
          category: input.category,
          workCenterId: input.workCenterId,
        },
        include: governanceBodyInclude,
      });
      await this.record(
        organizationId,
        userId,
        'GOVERNANCE_BODY_CREATED',
        'GovernanceBody',
        body.id,
        { category: body.category, workCenterId: body.workCenterId },
        context,
      );
      return body;
    } catch (error) {
      this.translateUnique(error, 'Ya existe un espacio de gobernanza con ese nombre.');
    }
  }

  async addMember(
    organizationId: string,
    bodyId: string,
    userId: string,
    input: AddGovernanceMemberDto,
    context: Context,
  ) {
    await this.requireBody(organizationId, bodyId);
    if (!input.workerId && !input.membershipId) {
      throw new BadRequestException('Selecciona un trabajador o una cuenta del equipo.');
    }
    const [worker, membership] = await Promise.all([
      input.workerId
        ? this.prisma.worker.findFirst({
            where: { id: input.workerId, organizationId, status: 'ACTIVE' },
            select: { id: true, linkedUserId: true },
          })
        : null,
      input.membershipId
        ? this.prisma.membership.findFirst({
            where: { id: input.membershipId, organizationId, status: 'ACTIVE' },
            select: { id: true, userId: true },
          })
        : null,
    ]);
    if (input.workerId && !worker)
      throw new BadRequestException('El trabajador activo no pertenece a la organización.');
    if (input.membershipId && !membership)
      throw new BadRequestException('La cuenta activa no pertenece a la organización.');
    if (worker && membership && worker.linkedUserId !== membership.userId) {
      throw new BadRequestException(
        'El trabajador y la cuenta seleccionada no representan la misma identidad vinculada.',
      );
    }
    const linkedUserId = worker?.linkedUserId ?? membership?.userId;
    const personKey = linkedUserId ? `USER:${linkedUserId}` : `WORKER:${worker!.id}`;
    try {
      const member = await this.prisma.governanceMember.create({
        data: {
          organizationId,
          bodyId,
          workerId: worker?.id,
          membershipId: membership?.id,
          personKey,
          roleLabel: input.roleLabel?.trim(),
        },
        include: {
          worker: { select: { id: true, displayName: true, status: true } },
          membership: {
            select: {
              id: true,
              role: true,
              user: { select: { id: true, displayName: true } },
            },
          },
        },
      });
      await this.record(
        organizationId,
        userId,
        'GOVERNANCE_MEMBER_ADDED',
        'GovernanceMember',
        member.id,
        { bodyId, workerId: worker?.id ?? null, membershipId: membership?.id ?? null },
        context,
      );
      return member;
    } catch (error) {
      this.translateUnique(error, 'La persona ya participa en este espacio de gobernanza.');
    }
  }

  async createMeeting(
    organizationId: string,
    bodyId: string,
    userId: string,
    input: CreateGovernanceMeetingDto,
    context: Context,
  ) {
    const body = await this.requireBody(organizationId, bodyId);
    if (body.status !== 'ACTIVE')
      throw new BadRequestException('El espacio de gobernanza está inactivo.');
    const participantIds = [...new Set(input.participantMemberIds)];
    const agendaOrders = input.agendaItems.map(({ sortOrder }) => sortOrder);
    if (participantIds.length !== input.participantMemberIds.length)
      throw new BadRequestException('No repitas participantes en la reunión.');
    if (new Set(agendaOrders).size !== agendaOrders.length)
      throw new BadRequestException('El orden de agenda no puede repetirse.');
    const [participants, actorMemberships] = await Promise.all([
      participantIds.length
        ? this.prisma.governanceMember.findMany({
            where: { organizationId, bodyId, id: { in: participantIds }, isActive: true },
            select: {
              id: true,
              personKey: true,
              roleLabel: true,
              worker: { select: { displayName: true } },
              membership: { select: { user: { select: { displayName: true } } } },
            },
          })
        : [],
      this.requireMembershipIds(
        organizationId,
        [input.chairMembershipId, input.secretaryMembershipId].filter((value): value is string =>
          Boolean(value),
        ),
      ),
    ]);
    if (participants.length !== participantIds.length)
      throw new BadRequestException('Un participante no pertenece a este espacio.');
    if (new Set(participants.map(({ personKey }) => personKey)).size !== participants.length) {
      throw new BadRequestException('No repitas a la misma persona en la reunión.');
    }
    const allowedMembershipIds = new Set(actorMemberships.map(({ id }) => id));
    if (input.chairMembershipId && !allowedMembershipIds.has(input.chairMembershipId))
      throw new BadRequestException(
        'La presidencia requiere una cuenta activa de la organización.',
      );
    if (input.secretaryMembershipId && !allowedMembershipIds.has(input.secretaryMembershipId))
      throw new BadRequestException('La secretaría requiere una cuenta activa de la organización.');

    const participantsById = new Map(
      participants.map((participant) => [participant.id, participant]),
    );
    const participantSnapshots = participantIds.map((governanceMemberId) => {
      const participant = participantsById.get(governanceMemberId)!;
      return {
        organizationId,
        governanceMemberId,
        personKeySnapshot: participant.personKey,
        displayNameSnapshot:
          participant.worker?.displayName ?? participant.membership!.user.displayName,
        roleLabelSnapshot: participant.roleLabel,
      };
    });
    const meeting = await this.prisma.governanceMeeting.create({
      data: {
        organizationId,
        bodyId,
        createdById: userId,
        title: input.title.trim(),
        scheduledAt: new Date(input.scheduledAt),
        mode: input.mode,
        location: input.location?.trim(),
        notes: input.notes?.trim(),
        chairMembershipId: input.chairMembershipId,
        secretaryMembershipId: input.secretaryMembershipId,
        participants: {
          create: participantSnapshots,
        },
        agendaItems: {
          create: input.agendaItems.map((item) => ({
            organizationId,
            title: item.title.trim(),
            notes: item.notes?.trim(),
            sortOrder: item.sortOrder,
          })),
        },
      },
      select: { id: true },
    });
    await this.record(
      organizationId,
      userId,
      'GOVERNANCE_MEETING_CREATED',
      'GovernanceMeeting',
      meeting.id,
      { bodyId, participantCount: participantIds.length, agendaCount: input.agendaItems.length },
      context,
    );
    return this.getMeeting(organizationId, meeting.id);
  }

  async transitionMeeting(
    organizationId: string,
    meetingId: string,
    userId: string,
    input: TransitionGovernanceMeetingDto,
    context: Context,
  ) {
    const current = await this.prisma.governanceMeeting.findFirst({
      where: { id: meetingId, organizationId },
      select: { id: true, status: true, chairMembershipId: true, notes: true },
    });
    if (!current) throw new NotFoundException('Reunión de gobernanza no encontrada.');
    try {
      assertGovernanceMeetingTransition(current.status, input.status);
    } catch {
      throw new BadRequestException('La transición de la reunión no es válida.');
    }
    if (input.status === 'HELD' && !current.chairMembershipId) {
      throw new BadRequestException(
        'Para registrar la reunión como realizada se requiere una presidencia con cuenta activa.',
      );
    }
    const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();
    const result = await this.prisma.governanceMeeting.updateMany({
      where: { id: meetingId, organizationId, status: current.status },
      data: {
        status: input.status,
        ...(input.status === 'HELD' ? { heldAt: occurredAt } : {}),
        ...(input.status === 'CANCELLED' ? { cancelledAt: occurredAt } : {}),
        ...(input.notes ? { notes: input.notes.trim() } : {}),
      },
    });
    if (result.count !== 1) throw this.versionConflict();
    await this.record(
      organizationId,
      userId,
      'GOVERNANCE_MEETING_TRANSITIONED',
      'GovernanceMeeting',
      meetingId,
      { from: current.status, to: input.status },
      context,
    );
    return this.getMeeting(organizationId, meetingId);
  }

  async createDecision(
    organizationId: string,
    meetingId: string,
    userId: string,
    input: CreateGovernanceDecisionDto,
    context: Context,
  ) {
    const meeting = await this.prisma.governanceMeeting.findFirst({
      where: { id: meetingId, organizationId },
      select: { id: true, status: true },
    });
    if (!meeting) throw new NotFoundException('Reunión de gobernanza no encontrada.');
    if (meeting.status !== 'HELD')
      throw new BadRequestException('Las decisiones se registran después de realizar la reunión.');
    const [agendaItem, unit, requirement] = await Promise.all([
      input.agendaItemId
        ? this.prisma.governanceAgendaItem.findFirst({
            where: { id: input.agendaItemId, organizationId, meetingId },
            select: { id: true, title: true },
          })
        : null,
      input.regulatoryUnitId
        ? this.prisma.regulatoryUnit.findUnique({
            where: { id: input.regulatoryUnitId },
            select: { id: true, identifier: true, locator: true, reviewStatus: true },
          })
        : null,
      input.requirementId
        ? this.prisma.regulatoryRequirement.findUnique({
            where: { id: input.requirementId },
            select: { id: true, title: true, editorialStatus: true },
          })
        : null,
    ]);
    if (input.agendaItemId && !agendaItem)
      throw new BadRequestException('El punto de agenda no pertenece a esta reunión.');
    if (input.regulatoryUnitId && !unit)
      throw new BadRequestException('La unidad normativa no existe.');
    if (input.requirementId && !requirement)
      throw new BadRequestException('El requisito no existe.');
    const regulatorySnapshot = {
      boundary: governanceRegulatoryReferenceLabel({
        unitReviewStatus: unit?.reviewStatus,
        requirementEditorialStatus: requirement?.editorialStatus,
      }),
      unit,
      requirement,
      legalMandateInferred: false,
    } satisfies Prisma.InputJsonValue;
    const decision = await this.prisma.governanceDecision.create({
      data: {
        organizationId,
        meetingId,
        agendaItemId: agendaItem?.id,
        summary: input.summary.trim(),
        rationale: input.rationale?.trim(),
        regulatoryUnitId: unit?.id,
        requirementId: requirement?.id,
        regulatorySnapshot,
        createdById: userId,
      },
      select: { id: true },
    });
    await this.record(
      organizationId,
      userId,
      'GOVERNANCE_DECISION_CREATED',
      'GovernanceDecision',
      decision.id,
      { meetingId, regulatoryBoundary: regulatorySnapshot.boundary },
      context,
    );
    return this.getDecision(organizationId, decision.id);
  }

  async createAction(
    organizationId: string,
    decisionId: string,
    userId: string,
    input: CreateGovernanceActionDto,
    context: Context,
  ) {
    const decision = await this.prisma.governanceDecision.findFirst({
      where: { id: decisionId, organizationId },
      select: { id: true },
    });
    if (!decision) throw new NotFoundException('Decisión de gobernanza no encontrada.');
    if (input.assignedToMembershipId) {
      await this.requireMembershipIds(organizationId, [input.assignedToMembershipId]);
    }
    const action = await this.prisma.governanceAction.create({
      data: {
        organizationId,
        decisionId,
        createdById: userId,
        title: input.title.trim(),
        description: input.description?.trim(),
        priority: input.priority,
        assignedToMembershipId: input.assignedToMembershipId,
        dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
      },
      include: {
        assignedToMembership: {
          select: { id: true, role: true, user: { select: { id: true, displayName: true } } },
        },
      },
    });
    await this.record(
      organizationId,
      userId,
      'GOVERNANCE_ACTION_CREATED',
      'GovernanceAction',
      action.id,
      { decisionId, assignedToMembershipId: action.assignedToMembershipId },
      context,
    );
    return action;
  }

  async transitionAction(
    organizationId: string,
    actionId: string,
    userId: string,
    input: TransitionGovernanceActionDto,
    context: Context,
  ) {
    const current = await this.prisma.governanceAction.findFirst({
      where: { id: actionId, organizationId },
      select: { id: true, status: true, version: true },
    });
    if (!current) throw new NotFoundException('Acción de gobernanza no encontrada.');
    if (current.version !== input.expectedVersion) throw this.versionConflict();
    try {
      assertGovernanceActionTransition(current.status, input.status);
    } catch {
      throw new BadRequestException('La transición de la acción no es válida.');
    }
    const result = await this.prisma.governanceAction.updateMany({
      where: {
        id: actionId,
        organizationId,
        version: input.expectedVersion,
        status: current.status,
      },
      data: {
        status: input.status,
        version: { increment: 1 },
        completedAt: input.status === 'COMPLETED' ? new Date() : null,
      },
    });
    if (result.count !== 1) throw this.versionConflict();
    await this.record(
      organizationId,
      userId,
      'GOVERNANCE_ACTION_TRANSITIONED',
      'GovernanceAction',
      actionId,
      { from: current.status, to: input.status, previousVersion: input.expectedVersion },
      context,
    );
    return this.prisma.governanceAction.findFirstOrThrow({
      where: { id: actionId, organizationId },
      include: {
        assignedToMembership: {
          select: { id: true, role: true, user: { select: { id: true, displayName: true } } },
        },
      },
    });
  }

  async addEvidence(
    organizationId: string,
    userId: string,
    target: { meetingId?: string; decisionId?: string; actionId?: string },
    input: CreateGovernanceEvidenceDto,
    context: Context,
  ) {
    if (input.type === 'NOTE' && (!input.note?.trim() || input.externalUrl)) {
      throw new BadRequestException('La nota requiere texto y no utiliza un enlace externo.');
    }
    if (input.type === 'EXTERNAL_LINK' && !input.externalUrl) {
      throw new BadRequestException('La evidencia externa requiere un enlace HTTPS.');
    }
    const targetCount = Object.values(target).filter(Boolean).length;
    if (targetCount !== 1)
      throw new BadRequestException('Selecciona un único destino de evidencia.');
    await this.requireEvidenceTarget(organizationId, target);
    const evidence = await this.prisma.governanceEvidence.create({
      data: {
        organizationId,
        createdById: userId,
        ...target,
        type: input.type,
        note: input.note?.trim(),
        externalUrl: input.externalUrl,
      },
    });
    await this.record(
      organizationId,
      userId,
      'GOVERNANCE_EVIDENCE_ADDED',
      'GovernanceEvidence',
      evidence.id,
      { target, type: input.type },
      context,
    );
    return evidence;
  }

  private async getMeeting(organizationId: string, meetingId: string) {
    const body = await this.prisma.governanceBody.findFirst({
      where: { organizationId, meetings: { some: { id: meetingId } } },
      include: governanceBodyInclude,
    });
    const meeting = body?.meetings.find(({ id }) => id === meetingId);
    if (!meeting) throw new NotFoundException('Reunión de gobernanza no encontrada.');
    return meeting;
  }

  private async getDecision(organizationId: string, decisionId: string) {
    const decision = await this.prisma.governanceDecision.findFirst({
      where: { id: decisionId, organizationId },
      include: {
        agendaItem: true,
        regulatoryUnit: {
          select: { id: true, identifier: true, locator: true, reviewStatus: true },
        },
        requirement: { select: { id: true, title: true, editorialStatus: true } },
        actions: true,
        evidence: true,
      },
    });
    if (!decision) throw new NotFoundException('Decisión de gobernanza no encontrada.');
    return decision;
  }

  private async requireBody(organizationId: string, bodyId: string) {
    const body = await this.prisma.governanceBody.findFirst({
      where: { id: bodyId, organizationId },
      select: { id: true, status: true },
    });
    if (!body) throw new NotFoundException('Espacio de gobernanza no encontrado.');
    return body;
  }

  private async requireWorkCenter(organizationId: string, workCenterId: string) {
    const center = await this.prisma.workCenter.findFirst({
      where: { id: workCenterId, organizationId, isActive: true },
      select: { id: true },
    });
    if (!center)
      throw new BadRequestException('El centro de trabajo no pertenece a la organización.');
    return center;
  }

  private async requireMembershipIds(organizationId: string, ids: string[]) {
    const unique = [...new Set(ids)];
    const memberships = unique.length
      ? await this.prisma.membership.findMany({
          where: { id: { in: unique }, organizationId, status: 'ACTIVE' },
          select: { id: true, userId: true },
        })
      : [];
    if (memberships.length !== unique.length) {
      throw new BadRequestException('Una cuenta seleccionada no está activa en la organización.');
    }
    return memberships;
  }

  private async requireEvidenceTarget(
    organizationId: string,
    target: { meetingId?: string; decisionId?: string; actionId?: string },
  ) {
    const record = target.meetingId
      ? await this.prisma.governanceMeeting.findFirst({
          where: { id: target.meetingId, organizationId },
          select: { id: true },
        })
      : target.decisionId
        ? await this.prisma.governanceDecision.findFirst({
            where: { id: target.decisionId, organizationId },
            select: { id: true },
          })
        : await this.prisma.governanceAction.findFirst({
            where: { id: target.actionId, organizationId },
            select: { id: true },
          });
    if (!record) throw new NotFoundException('Destino de evidencia no encontrado.');
  }

  private record(
    organizationId: string,
    actorUserId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata: Prisma.InputJsonValue,
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

  private versionConflict() {
    return new ConflictException({
      code: 'GOVERNANCE_VERSION_CONFLICT',
      message: 'El registro cambió en otra sesión. Actualiza e intenta nuevamente.',
    });
  }

  private translateUnique(error: unknown, message: string): never {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      throw new ConflictException({ code: 'GOVERNANCE_UNIQUE_CONFLICT', message });
    }
    throw error;
  }
}
