import {
  BadRequestException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  adaptiveContentHash,
  conversationActionRequestSchema,
  conversationMessageInputSchema,
  conversationThreadInputSchema,
  isConversationalWriteAction,
  type ConversationContextType,
} from '@sst/contracts';
import { PrismaService } from '../prisma/prisma.service';
import {
  CONVERSATIONAL_ASSISTANT_PROVIDER,
  type ConversationalAssistantProvider,
} from './conversational-assistant.provider';
import {
  ConversationalActionRegistryService,
  type ConversationalActionResult,
} from './conversational-action-registry.service';
import type {
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
    return { ...thread, provider: this.provider.providerKey };
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
    const providerResponse = await this.provider.respond({
      content: parsed.data.content,
      context: {
        type: (thread.contextType as ConversationContextType | null) ?? null,
        id: thread.contextId,
      },
    });
    if (providerResponse.suggestedReadAction) {
      const action = await this.runAction(
        organization,
        userId,
        threadId,
        {
          ...providerResponse.suggestedReadAction,
          idempotencyKey: `message:${userMessage.id}`,
        },
        audit,
      );
      return { userMessage, providerReply: providerResponse.reply, action };
    }
    const assistantMessage = await this.prisma.conversationMessage.create({
      data: {
        organizationId: organization.id,
        threadId,
        role: 'ASSISTANT',
        content: providerResponse.reply,
        structuredData: {
          provider: this.provider.providerKey,
          boundary: 'NO_EXTERNAL_PROVIDER_NO_ARBITRARY_TOOL_INVOCATION',
        },
      },
    });
    await this.touch(threadId);
    return { userMessage, assistantMessage };
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
