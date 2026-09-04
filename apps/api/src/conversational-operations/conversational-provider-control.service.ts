import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAiStagingPolicy } from './openai-staging-policy';

const SWITCH_ACTION = 'CONVERSATIONAL_OPENAI_STAGING_SWITCH';

type AuditContext = { requestId: string; ip?: string; userAgent?: string };

@Injectable()
export class ConversationalProviderControlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly policy: OpenAiStagingPolicy,
  ) {}

  async externalEnabled(organizationId: string) {
    const latest = await this.prisma.auditLog.findFirst({
      where: {
        organizationId,
        action: SWITCH_ACTION,
        entityType: 'ConversationalProvider',
        entityId: organizationId,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { metadata: true },
    });
    if (!latest) return true;
    const metadata = latest.metadata;
    return (
      typeof metadata === 'object' &&
      metadata !== null &&
      !Array.isArray(metadata) &&
      metadata.externalEnabled === true
    );
  }

  async setExternalEnabled(
    organizationId: string,
    userId: string,
    externalEnabled: boolean,
    request: AuditContext,
  ) {
    if (externalEnabled && !this.policy.cohortAllows(organizationId, userId)) {
      throw new ForbiddenException({
        code: 'OPENAI_STAGING_COHORT_REQUIRED',
        message: 'La organización y el usuario deben pertenecer a la cohorte autorizada.',
      });
    }
    await this.audit.record({
      organizationId,
      actorUserId: userId,
      action: SWITCH_ACTION,
      entityType: 'ConversationalProvider',
      entityId: organizationId,
      metadata: { externalEnabled } as Prisma.InputJsonValue,
      ...request,
    });
    return { externalEnabled };
  }
}
