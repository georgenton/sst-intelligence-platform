import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type AuditEvent = {
  organizationId?: string;
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
  requestId: string;
  ip?: string;
  userAgent?: string;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  record(
    event: AuditEvent,
    transaction: Prisma.TransactionClient = this.prisma,
  ): Promise<{ id: string }> {
    return transaction.auditLog.create({
      data: { ...event, metadata: event.metadata ?? {} },
      select: { id: true },
    });
  }
}
