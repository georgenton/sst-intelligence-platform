import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  adaptiveContentHash,
  conversationActionRequestSchema,
  conversationFeedbackInputSchema,
  conversationMessageInputSchema,
  conversationProviderControlInputSchema,
  conversationThreadInputSchema,
  isConversationalWriteAction,
  type ConversationContextType,
  type ConversationProviderUseCase,
} from '@sst/contracts';
import { AuditService } from '../audit/audit.service';
import { EntitlementService } from '../catalog/entitlement.service';
import { INSPECTION_WRITE_ROLES } from '../inspections/inspection-policy';
import { PrismaService } from '../prisma/prisma.service';
import {
  CONVERSATIONAL_ASSISTANT_PROVIDER,
  type ConversationalAssistantProvider,
  type ConversationalProviderInput,
  type ConversationalProviderResponse,
} from './conversational-assistant.provider';
import {
  ConversationalActionRegistryService,
  type ConversationalActionResult,
} from './conversational-action-registry.service';
import {
  GenerativeProviderContextBuilder,
  GenerativeProviderResponseGuard,
} from './generative-provider-boundaries';
import { ConversationalProviderControlService } from './conversational-provider-control.service';
import type {
  ConversationFeedbackDto,
  ConversationProviderControlDto,
  CreateConversationThreadDto,
  RunConversationActionDto,
  SendConversationMessageDto,
} from './dto';

type OrganizationActor = { id: string; role: string };
type AuditContext = { requestId: string; ip?: string; userAgent?: string };

const threadInclude = {
  messages: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      citations: { orderBy: { createdAt: 'asc' as const } },
      attachments: { orderBy: { createdAt: 'asc' as const } },
      actionRuns: { orderBy: { createdAt: 'asc' as const } },
    },
  },
  actionRuns: { orderBy: { createdAt: 'asc' as const } },
} as const;

@Injectable()
export class ConversationalOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ConversationalActionRegistryService,
    private readonly auditLog: AuditService,
    private readonly entitlements: EntitlementService,
    private readonly providerControl: ConversationalProviderControlService,
    private readonly providerContext: GenerativeProviderContextBuilder,
    private readonly providerGuard: GenerativeProviderResponseGuard,
    @Inject(CONVERSATIONAL_ASSISTANT_PROVIDER)
    private readonly provider: ConversationalAssistantProvider,
  ) {}

  async list(organizationId: string, userId: string) {
    return this.prisma.conversationThread.findMany({
      where: { organizationId, userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        contextType: true,
        contextId: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true, actionRuns: true } },
      },
    });
  }

  async create(organizationId: string, userId: string, rawInput: CreateConversationThreadDto) {
    const parsed = conversationThreadInputSchema.safeParse(rawInput);
    if (!parsed.success) throw this.invalid(parsed.error.issues[0]?.message);
    const input = parsed.data;
    if (input.contextId && !input.contextType) {
      throw this.invalid('El contexto necesita un tipo explícito.');
    }
    return this.prisma.conversationThread.create({
      data: {
        organizationId,
        userId,
        title: input.title ?? 'Operación SST',
        contextType: input.contextType ?? 'GLOBAL',
        contextId: input.contextId,
      },
      include: threadInclude,
    });
  }

  async get(organizationId: string, userId: string, threadId: string) {
    const thread = await this.prisma.conversationThread.findFirst({
      where: { id: threadId, organizationId, userId },
      include: threadInclude,
    });
    if (!thread) throw new NotFoundException('Conversación no encontrada.');
    const providerState = await this.status(organizationId, userId);
    return {
      ...thread,
      provider: providerState.providerKey,
      providerState,
    };
  }

  async status(organizationId: string, userId: string) {
    if (this.provider.status) return this.provider.status({ organizationId, userId });
    return {
      ...this.provider.descriptor,
      label:
        this.provider.descriptor.mode === 'DETERMINISTIC_LOCAL'
          ? 'Procesamiento local controlado · sin IA externa'
          : 'Proveedor generativo configurado por el servidor',
      providerSelection: 'DETERMINISTIC_ENVIRONMENT_POLICY' as const,
      configuredProvider: 'DETERMINISTIC_LOCAL_V1' as const,
      requestedModel: null,
      externalEligible: false,
      externalEnabled: false,
      killSwitchAvailable: false,
      reviewRequired: true,
      dataScope: 'LOW_ONLY' as const,
    };
  }

  async sendMessage(
    organization: OrganizationActor,
    userId: string,
    threadId: string,
    rawInput: SendConversationMessageDto,
    audit: AuditContext,
  ) {
    const parsed = conversationMessageInputSchema.safeParse(rawInput);
    if (!parsed.success) throw this.invalid(parsed.error.issues[0]?.message);
    const thread = await this.requireThread(organization.id, userId, threadId);
    const userMessage = await this.prisma.conversationMessage.create({
      data: {
        organizationId: organization.id,
        threadId,
        authorUserId: userId,
        role: 'USER',
        content: parsed.data.content,
      },
    });
    await this.touch(threadId);
    const authorization = await this.requireCurrentProviderAuthorization(organization.id, userId);
    const citations = await this.authorizedCitations(organization.id, userId, threadId);
    const tools = await this.providerTools(
      organization.id,
      authorization.role,
      thread,
      parsed.data.providerUseCase,
      parsed.data.providerActionContext,
      authorization.activeEntitlementKeys,
    );
    const externalRequest = this.externalRequest(
      parsed.data.providerUseCase,
      thread.contextType as ConversationContextType | null,
    );
    const providerInput = this.providerContext.build({
      userIntent: parsed.data.content,
      requestContext: {
        organizationId: organization.id,
        userId,
        currentRole: authorization.role,
        activeEntitlementKeys: authorization.activeEntitlementKeys,
      },
      context: {
        type: (thread.contextType as ConversationContextType | null) ?? null,
        id: thread.contextId,
      },
      citations,
      tools,
      externalRequest,
    });
    let providerResponse;
    try {
      providerResponse = this.providerGuard.validate(
        await this.provider.respond(providerInput),
        providerInput,
        this.provider,
      );
      await this.recordProviderAudit(
        organization.id,
        userId,
        threadId,
        'SUCCEEDED',
        {
          capability: providerResponse.capability,
          requestedAction: providerResponse.requestedAction?.actionKey ?? null,
          citationValidation: providerResponse.execution?.citationValidation ?? 'PASS',
          citationCount: providerResponse.citationIds.length,
          ...this.safeProviderExecution(providerResponse),
        },
        audit,
      );
    } catch (error) {
      await this.recordProviderAudit(
        organization.id,
        userId,
        threadId,
        'REJECTED',
        {
          requestedAction: null,
          citationValidation: 'REJECTED_OR_NOT_REACHED',
        },
        audit,
      );
      throw error;
    }
    if (providerResponse.requestedAction) {
      const assistantMessage = await this.createProviderMessage(
        organization.id,
        threadId,
        providerResponse,
        providerInput,
      );
      const action = await this.runAction(
        { id: organization.id, role: authorization.role },
        userId,
        threadId,
        {
          ...providerResponse.requestedAction,
          idempotencyKey: `message:${userMessage.id}`,
        },
        audit,
      );
      return { userMessage, assistantMessage, action };
    }
    const assistantMessage = await this.createProviderMessage(
      organization.id,
      threadId,
      providerResponse,
      providerInput,
    );
    await this.touch(threadId);
    return { userMessage, assistantMessage };
  }

  async feedback(
    organizationId: string,
    userId: string,
    messageId: string,
    rawInput: ConversationFeedbackDto,
    request: AuditContext,
  ) {
    const parsed = conversationFeedbackInputSchema.safeParse(rawInput);
    if (!parsed.success) throw this.invalid(parsed.error.issues[0]?.message);
    const message = await this.prisma.conversationMessage.findFirst({
      where: {
        id: messageId,
        organizationId,
        role: 'ASSISTANT',
        thread: { userId },
      },
      select: { structuredData: true },
    });
    const structured = this.record(message?.structuredData);
    if (!message || structured?.externalProcessing !== true) {
      throw new BadRequestException({
        code: 'STAGING_FEEDBACK_NOT_AVAILABLE',
        message: 'El feedback está disponible solo para respuestas generativas del piloto.',
      });
    }
    await this.auditLog.record({
      organizationId,
      actorUserId: userId,
      action: 'CONVERSATIONAL_STAGING_FEEDBACK',
      entityType: 'ConversationMessage',
      entityId: messageId,
      metadata: this.json({
        useful: parsed.data.useful,
        reason: parsed.data.reason ?? null,
        provider: structured.provider,
        providerConfig: structured.providerConfig,
      }),
      ...request,
    });
    return { recorded: true };
  }

  async setProviderControl(
    organizationId: string,
    userId: string,
    rawInput: ConversationProviderControlDto,
    request: AuditContext,
  ) {
    const parsed = conversationProviderControlInputSchema.safeParse(rawInput);
    if (!parsed.success) throw this.invalid(parsed.error.issues[0]?.message);
    return this.providerControl.setExternalEnabled(
      organizationId,
      userId,
      parsed.data.externalEnabled,
      request,
    );
  }

  private async requireCurrentProviderAuthorization(organizationId: string, userId: string) {
    const membership = await this.prisma.membership.findFirst({
      where: {
        organizationId,
        userId,
        status: 'ACTIVE',
        organization: { status: { in: ['ACTIVE', 'DEMO'] } },
      },
      select: { role: true },
    });
    if (!membership) throw new ForbiddenException('No tienes acceso a esta organización.');
    const entitlements = await this.entitlements.effective(organizationId);
    return {
      role: membership.role,
      activeEntitlementKeys: Object.entries(entitlements.features)
        .filter(([, value]) => value === true)
        .map(([key]) => key)
        .sort(),
    };
  }

  private async authorizedCitations(organizationId: string, userId: string, threadId: string) {
    const rows = await this.prisma.conversationCitation.findMany({
      where: {
        organizationId,
        message: { threadId, thread: { userId } },
      },
      orderBy: { createdAt: 'desc' },
      take: 24,
      select: { referenceId: true, type: true, label: true },
    });
    const seen = new Set<string>();
    return rows
      .filter(({ referenceId }) => {
        if (seen.has(referenceId)) return false;
        seen.add(referenceId);
        return true;
      })
      .map(({ referenceId, ...citation }) => ({ id: referenceId, ...citation }));
  }

  private async providerTools(
    organizationId: string,
    role: string,
    thread: { contextType: string | null; contextId: string | null },
    useCase: ConversationProviderUseCase | undefined,
    actionContext:
      { actionKey: 'create_action'; inspectionId: string; findingId: string } | undefined,
    activeEntitlementKeys: readonly string[],
  ): Promise<ConversationalProviderInput['actionRegistry']['tools']> {
    if (!useCase) {
      return [{ actionKey: 'get_my_work_queue', input: {} }];
    }
    if (useCase === 'WORK_QUEUE_EXPLANATION') {
      return [{ actionKey: 'get_my_work_queue', input: {} }];
    }
    if (useCase === 'CURRENT_CONTEXT_EXPLANATION' && thread.contextId) {
      if (thread.contextType === 'WORK_ITEM') {
        return [{ actionKey: 'explain_work_item', input: { sourceId: thread.contextId } }];
      }
      if (
        thread.contextType === 'INSPECTION' &&
        activeEntitlementKeys.includes('module.inspections')
      ) {
        return [{ actionKey: 'get_inspection_context', input: { inspectionId: thread.contextId } }];
      }
      if (thread.contextType === 'OBLIGATION') {
        return [{ actionKey: 'get_obligation_context', input: { obligationId: thread.contextId } }];
      }
    }
    if (useCase === 'ACTION_PROPOSAL' && actionContext) {
      if (
        !activeEntitlementKeys.includes('module.inspections') ||
        !(INSPECTION_WRITE_ROLES as readonly string[]).includes(role)
      ) {
        return [];
      }
      const finding = await this.prisma.inspectionFinding.findFirst({
        where: {
          id: actionContext.findingId,
          organizationId,
          inspectionId: actionContext.inspectionId,
        },
        select: { id: true },
      });
      if (!finding)
        throw new NotFoundException('Hallazgo no encontrado en la organización activa.');
      return [
        {
          actionKey: 'create_action',
          input: {
            inspectionId: actionContext.inspectionId,
            findingId: actionContext.findingId,
            title: 'Revisar y tratar la condición identificada',
            priority: 'MEDIUM',
          },
        },
      ];
    }
    return [];
  }

  private externalRequest(
    useCase: ConversationProviderUseCase | undefined,
    contextType: ConversationContextType | null,
  ) {
    if (!useCase) return undefined;
    if (
      contextType &&
      ['WORKER', 'INCIDENT', 'PPE', 'TRAINING', 'WORK_PERMIT'].includes(contextType)
    ) {
      return undefined;
    }
    const canonicalPrompts: Record<ConversationProviderUseCase, string> = {
      WORK_QUEUE_EXPLANATION:
        'Consulta la cola autorizada y prepara una explicación operacional breve.',
      CURRENT_CONTEXT_EXPLANATION:
        'Consulta el registro anclado por el servidor y explica únicamente su estado factual.',
      CITATION_SUMMARY:
        'Resume las fuentes opacas disponibles sin agregar hechos, autoridad ni aplicabilidad.',
      OPERATIONAL_DRAFT:
        'Prepara un borrador operativo breve, no canónico y sujeto a revisión humana.',
      ACTION_PROPOSAL:
        'Prepara la acción exacta anclada por el servidor; no la ejecutes ni alteres sus datos.',
    };
    return { useCase, canonicalPrompt: canonicalPrompts[useCase] };
  }

  private createProviderMessage(
    organizationId: string,
    threadId: string,
    response: ConversationalProviderResponse,
    input: ConversationalProviderInput,
  ) {
    const execution = response.execution;
    const citationIds = response.citationIds ?? [];
    return this.prisma.conversationMessage.create({
      data: {
        organizationId,
        threadId,
        role: 'ASSISTANT',
        content: response.reply,
        structuredData: this.json({
          provider: execution?.providerKey ?? this.provider.descriptor.providerKey,
          providerConfig: execution?.configIdentifier ?? this.provider.descriptor.configIdentifier,
          externalProcessing: execution?.externalProcessing ?? false,
          fallbackUsed: execution?.fallbackUsed ?? false,
          capability: response.capability,
          outcome: response.outcome ?? 'ANSWERED',
          reviewRequired: true,
          boundary: 'SERVER_AUTHORIZED_CONTEXT_AND_CONFIRMATION_REQUIRED',
        }),
        citations: citationIds.length
          ? {
              create: citationIds.map((citationId) => {
                const citation = input.citations.find(({ id }) => id === citationId)!;
                return {
                  organizationId,
                  type: citation.type,
                  referenceId: citation.id,
                  label: citation.label,
                };
              }),
            }
          : undefined,
      },
      include: {
        citations: { orderBy: { createdAt: 'asc' } },
        attachments: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  private safeProviderExecution(response: ConversationalProviderResponse) {
    const execution = response.execution;
    if (!execution) return {};
    return {
      providerKey: execution.providerKey,
      configIdentifier: execution.configIdentifier,
      externalProcessing: execution.externalProcessing,
      requestedModel: execution.requestedModel,
      returnedModel: execution.returnedModel,
      requestPolicyVersion: execution.requestPolicyVersion,
      latencyMs: execution.latencyMs,
      inputTokens: execution.inputTokens,
      outputTokens: execution.outputTokens,
      estimatedCostUsd: execution.estimatedCostUsd,
      toolRequests: execution.toolRequests,
      errorClass: execution.errorClass,
      fallbackUsed: execution.fallbackUsed,
    };
  }

  private record(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  async runAction(
    organization: OrganizationActor,
    userId: string,
    threadId: string,
    rawInput: RunConversationActionDto,
    audit: AuditContext,
  ) {
    const parsed = conversationActionRequestSchema.safeParse(rawInput);
    if (!parsed.success) throw this.invalid(parsed.error.issues[0]?.message);
    const input = parsed.data;
    await this.requireThread(organization.id, userId, threadId);
    const requestDigest = adaptiveContentHash({
      actionKey: input.actionKey,
      input: input.input,
    });
    const existing = await this.findByIdempotency(organization.id, input.idempotencyKey);
    if (existing) {
      this.assertSameRequest(existing, threadId, userId, requestDigest);
      return existing;
    }
    const write = isConversationalWriteAction(input.actionKey);
    let run;
    try {
      run = await this.prisma.conversationActionRun.create({
        data: {
          organizationId: organization.id,
          threadId,
          actorUserId: userId,
          actionKey: input.actionKey,
          idempotencyKey: input.idempotencyKey,
          requestDigest,
          request: this.json(input.input),
          status: write ? 'AWAITING_CONFIRMATION' : 'EXECUTING',
          confirmationState: write ? 'PENDING' : 'NOT_REQUIRED',
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const winner = await this.findByIdempotency(organization.id, input.idempotencyKey);
        if (!winner) throw error;
        this.assertSameRequest(winner, threadId, userId, requestDigest);
        return winner;
      }
      throw error;
    }
    if (write) {
      const message = await this.prisma.conversationMessage.create({
        data: {
          organizationId: organization.id,
          threadId,
          role: 'ASSISTANT',
          content: `Confirma la acción “${input.actionKey}”. No se ha realizado ningún cambio todavía.`,
          structuredData: this.json({
            actionRunId: run.id,
            actionKey: input.actionKey,
            confirmationRequired: true,
            input: input.input,
          }),
        },
      });
      await this.prisma.conversationActionRun.update({
        where: { id: run.id },
        data: { messageId: message.id },
      });
      await this.touch(threadId);
      return this.findRun(organization.id, userId, run.id);
    }
    return this.executeRun(organization, userId, run.id, input.actionKey, input.input, audit);
  }

  async confirm(
    organization: OrganizationActor,
    userId: string,
    actionRunId: string,
    audit: AuditContext,
  ) {
    const current = await this.findRun(organization.id, userId, actionRunId);
    if (current.status === 'SUCCEEDED') return current;
    if (current.status === 'REJECTED') throw new ConflictException('La acción fue rechazada.');
    if (current.status === 'FAILED') throw new ConflictException('La acción terminó con error.');
    if (current.status === 'EXECUTING') {
      throw new ConflictException({
        code: 'CONVERSATIONAL_ACTION_ALREADY_EXECUTING',
        message: 'La acción ya está en ejecución; no se volverá a invocar.',
      });
    }
    const claimed = await this.prisma.conversationActionRun.updateMany({
      where: {
        id: actionRunId,
        organizationId: organization.id,
        actorUserId: userId,
        status: 'AWAITING_CONFIRMATION',
        confirmationState: 'PENDING',
      },
      data: {
        status: 'EXECUTING',
        confirmationState: 'CONFIRMED',
        confirmedAt: new Date(),
      },
    });
    if (claimed.count !== 1) {
      const winner = await this.findRun(organization.id, userId, actionRunId);
      if (winner.status === 'SUCCEEDED') return winner;
      throw new ConflictException('La acción ya fue procesada.');
    }
    const request = current.request as Record<string, unknown>;
    return this.executeRun(
      organization,
      userId,
      actionRunId,
      current.actionKey as RunConversationActionDto['actionKey'],
      request,
      audit,
    );
  }

  async reject(organizationId: string, userId: string, actionRunId: string) {
    const updated = await this.prisma.conversationActionRun.updateMany({
      where: {
        id: actionRunId,
        organizationId,
        actorUserId: userId,
        status: 'AWAITING_CONFIRMATION',
        confirmationState: 'PENDING',
      },
      data: {
        status: 'REJECTED',
        confirmationState: 'REJECTED',
        completedAt: new Date(),
      },
    });
    if (updated.count !== 1) throw new ConflictException('La acción ya fue procesada.');
    return this.findRun(organizationId, userId, actionRunId);
  }

  private async executeRun(
    organization: OrganizationActor,
    userId: string,
    runId: string,
    actionKey: RunConversationActionDto['actionKey'],
    input: Record<string, unknown>,
    audit: AuditContext,
  ) {
    try {
      const result = await this.registry.execute(actionKey, input, {
        organizationId: organization.id,
        userId,
        role: organization.role,
        audit,
      });
      return await this.completeRun(organization.id, userId, runId, result);
    } catch (error) {
      await this.prisma.conversationActionRun.updateMany({
        where: { id: runId, organizationId: organization.id, actorUserId: userId },
        data: {
          status: 'FAILED',
          errorCode: this.errorCode(error),
          errorMessage: this.errorMessage(error),
          completedAt: new Date(),
        },
      });
      throw error;
    }
  }

  private async completeRun(
    organizationId: string,
    userId: string,
    runId: string,
    result: ConversationalActionResult,
  ) {
    const run = await this.findRun(organizationId, userId, runId);
    await this.prisma.$transaction(async (tx) => {
      const message = await tx.conversationMessage.create({
        data: {
          organizationId,
          threadId: run.threadId,
          role: 'ASSISTANT',
          content: result.summary,
          structuredData: this.json({
            actionRunId: run.id,
            actionKey: run.actionKey,
            result: result.data,
            semanticBoundary: 'DOMAIN_SERVICE_RESULT',
          }),
          citations: result.citations.length
            ? {
                create: result.citations.map((citation) => ({
                  organizationId,
                  type: citation.type,
                  referenceId: citation.referenceId,
                  label: citation.label,
                  deepLink: citation.deepLink,
                  ...(citation.sourceSnapshot === undefined
                    ? {}
                    : { sourceSnapshot: this.json(citation.sourceSnapshot) }),
                })),
              }
            : undefined,
        },
      });
      if (result.attachmentReference) {
        await tx.conversationAttachmentReference.create({
          data: {
            organizationId,
            messageId: message.id,
            actionRunId: run.id,
            createdById: userId,
            ...result.attachmentReference,
          },
        });
      }
      await tx.conversationActionRun.update({
        where: { id: run.id },
        data: {
          messageId: message.id,
          status: 'SUCCEEDED',
          result: this.json(result.data),
          resultType: result.resultReference?.type,
          resultId: result.resultReference?.id,
          completedAt: new Date(),
        },
      });
      await tx.conversationThread.update({
        where: { id: run.threadId },
        data: { updatedAt: new Date() },
      });
    });
    return this.findRun(organizationId, userId, run.id);
  }

  private requireThread(organizationId: string, userId: string, threadId: string) {
    return this.prisma.conversationThread
      .findFirst({ where: { id: threadId, organizationId, userId } })
      .then((thread) => {
        if (!thread) throw new NotFoundException('Conversación no encontrada.');
        return thread;
      });
  }

  private async findRun(organizationId: string, userId: string, id: string) {
    const run = await this.prisma.conversationActionRun.findFirst({
      where: { id, organizationId, actorUserId: userId },
      include: {
        message: {
          include: {
            citations: { orderBy: { createdAt: 'asc' } },
            attachments: { orderBy: { createdAt: 'asc' } },
          },
        },
        attachments: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!run) throw new NotFoundException('Ejecución conversacional no encontrada.');
    return run;
  }

  private findByIdempotency(organizationId: string, idempotencyKey: string) {
    return this.prisma.conversationActionRun.findUnique({
      where: { organizationId_idempotencyKey: { organizationId, idempotencyKey } },
      include: {
        message: { include: { citations: true, attachments: true } },
        attachments: true,
      },
    });
  }

  private assertSameRequest(
    run: { threadId: string; actorUserId: string; requestDigest: string },
    threadId: string,
    userId: string,
    requestDigest: string,
  ) {
    if (
      run.threadId !== threadId ||
      run.actorUserId !== userId ||
      run.requestDigest !== requestDigest
    ) {
      throw new ConflictException({
        code: 'CONVERSATIONAL_IDEMPOTENCY_KEY_REUSED',
        message: 'La clave idempotente ya pertenece a otra solicitud.',
      });
    }
  }

  private touch(threadId: string) {
    return this.prisma.conversationThread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() },
    });
  }

  private recordProviderAudit(
    organizationId: string,
    userId: string,
    threadId: string,
    status: 'SUCCEEDED' | 'REJECTED',
    details: Record<string, unknown>,
    audit: AuditContext,
  ) {
    return this.auditLog.record({
      organizationId,
      actorUserId: userId,
      action: 'CONVERSATIONAL_PROVIDER_REQUEST',
      entityType: 'ConversationThread',
      entityId: threadId,
      metadata: this.json({
        providerKey: this.provider.descriptor.providerKey,
        configIdentifier: this.provider.descriptor.configIdentifier,
        externalProcessing: this.provider.descriptor.externalProcessing,
        status,
        ...details,
      }),
      ...audit,
    });
  }

  private json(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private invalid(message?: string) {
    return new BadRequestException({
      code: 'INVALID_CONVERSATIONAL_REQUEST',
      message: message ?? 'La solicitud conversacional no es válida.',
    });
  }

  private errorCode(error: unknown) {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (typeof response === 'object' && response && 'code' in response) {
        const code = (response as { code?: unknown }).code;
        if (typeof code === 'string') return code;
      }
      return `HTTP_${error.getStatus()}`;
    }
    return 'CONVERSATIONAL_ACTION_FAILED';
  }

  private errorMessage(error: unknown) {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (typeof response === 'string') return response.slice(0, 500);
      if (typeof response === 'object' && response && 'message' in response) {
        const message = (response as { message?: unknown }).message;
        if (typeof message === 'string') return message.slice(0, 500);
      }
    }
    return error instanceof Error ? error.message.slice(0, 500) : 'La acción no pudo completarse.';
  }
}
