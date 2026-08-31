import { createHash, randomBytes } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type MembershipRole } from '@prisma/client';
import {
  canInviteOrganizationRole,
  effectiveInvitationStatus,
  invitationExpiresAt,
  normalizeInvitationEmail,
} from '@sst/contracts';
import type { AuditEvent } from '../audit/audit.service';
import { EntitlementService } from '../catalog/entitlement.service';
import { PrismaService } from '../prisma/prisma.service';

type Context = Pick<AuditEvent, 'requestId' | 'ip' | 'userAgent'>;
type Transaction = Prisma.TransactionClient;

const MEMBER_LIMIT_FEATURE = 'organization.max_members';

@Injectable()
export class OrganizationTeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementService,
  ) {}

  members(organizationId: string) {
    return this.prisma.membership.findMany({
      where: { organizationId },
      select: {
        id: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { id: true, email: true, displayName: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async invitations(organizationId: string) {
    const now = new Date();
    const invitations = await this.prisma.organizationInvitation.findMany({
      where: { organizationId },
      select: {
        id: true,
        emailNormalized: true,
        role: true,
        status: true,
        expiresAt: true,
        acceptedAt: true,
        revokedAt: true,
        createdAt: true,
        updatedAt: true,
        invitedBy: { select: { displayName: true } },
        acceptedBy: { select: { displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return invitations.map((invitation) => ({
      ...invitation,
      status: effectiveInvitationStatus(invitation.status, invitation.expiresAt, now),
    }));
  }

  async invite(
    organizationId: string,
    actorUserId: string,
    input: { email: string; role: MembershipRole },
    context: Context,
  ) {
    if (!canInviteOrganizationRole(input.role)) {
      throw new ForbiddenException({
        code: 'INVITATION_ROLE_FORBIDDEN',
        message: 'La propiedad de la organización requiere un flujo dedicado.',
      });
    }
    const emailNormalized = normalizeInvitationEmail(input.email);
    const entitlements = await this.entitlements.effective(organizationId);
    const limit = entitlements.features[MEMBER_LIMIT_FEATURE];
    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(rawToken);
    const now = new Date();
    const expiresAt = invitationExpiresAt(now);
    try {
      const invitation = await this.prisma.$transaction(async (tx) => {
        await this.lockOrganization(tx, organizationId);
        await tx.organizationInvitation.updateMany({
          where: { organizationId, status: 'PENDING', expiresAt: { lte: now } },
          data: { status: 'EXPIRED', pendingKey: null },
        });
        const [activeMembers, pendingInvitations, existingMember, existingPending] =
          await Promise.all([
            tx.membership.count({ where: { organizationId, status: 'ACTIVE' } }),
            tx.organizationInvitation.count({
              where: { organizationId, status: 'PENDING', expiresAt: { gt: now } },
            }),
            tx.membership.findFirst({
              where: { organizationId, status: 'ACTIVE', user: { email: emailNormalized } },
              select: { id: true },
            }),
            tx.organizationInvitation.findFirst({
              where: {
                organizationId,
                emailNormalized,
                status: 'PENDING',
                expiresAt: { gt: now },
              },
              select: { id: true },
            }),
          ]);
        if (existingMember) {
          throw new ConflictException({
            code: 'MEMBERSHIP_ALREADY_ACTIVE',
            message: 'La persona ya pertenece a esta organización.',
          });
        }
        if (existingPending) {
          throw new ConflictException({
            code: 'INVITATION_ALREADY_PENDING',
            message: 'Ya existe una invitación pendiente para este correo.',
          });
        }
        const currentUsage = activeMembers + pendingInvitations;
        if (typeof limit !== 'number' || currentUsage >= limit) {
          throw new ForbiddenException({
            code: 'LIMIT_REACHED',
            message: 'La organización alcanzó el límite disponible en su plan.',
            details: {
              featureKey: MEMBER_LIMIT_FEATURE,
              currentUsage,
              limit: typeof limit === 'number' ? limit : null,
            },
          });
        }
        const created = await tx.organizationInvitation.create({
          data: {
            organizationId,
            emailNormalized,
            role: input.role,
            tokenHash,
            pendingKey: `${organizationId}:${emailNormalized}`,
            expiresAt,
            invitedByUserId: actorUserId,
          },
          select: { id: true, emailNormalized: true, role: true, status: true, expiresAt: true },
        });
        await tx.auditLog.create({
          data: {
            organizationId,
            actorUserId,
            action: 'ORGANIZATION_INVITATION_CREATED',
            entityType: 'OrganizationInvitation',
            entityId: created.id,
            metadata: { role: created.role, delivery: 'MANUAL_COPY_LINK' },
            ...context,
          },
        });
        return created;
      });
      return { ...invitation, token: rawToken, delivery: 'MANUAL_COPY_LINK' as const };
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException({
          code: 'INVITATION_ALREADY_PENDING',
          message: 'Ya existe una invitación pendiente para este correo.',
        });
      }
      throw error;
    }
  }

  async inspect(token: string, authenticatedEmail: string) {
    const invitation = await this.prisma.organizationInvitation.findUnique({
      where: { tokenHash: this.hashToken(token) },
      select: {
        emailNormalized: true,
        role: true,
        status: true,
        expiresAt: true,
        organization: { select: { name: true } },
      },
    });
    if (!invitation) throw this.invitationNotFound();
    this.assertEmailMatch(invitation.emailNormalized, authenticatedEmail);
    return {
      organizationName: invitation.organization.name,
      emailNormalized: invitation.emailNormalized,
      role: invitation.role,
      status: effectiveInvitationStatus(invitation.status, invitation.expiresAt),
      expiresAt: invitation.expiresAt,
    };
  }

  async accept(token: string, user: { id: string; email: string }, context: Context) {
    const tokenHash = this.hashToken(token);
    const now = new Date();
    const outcome = await this.prisma.$transaction(async (tx) => {
      const invitationId = await this.lockInvitationByToken(tx, tokenHash);
      const invitation = await tx.organizationInvitation.findUniqueOrThrow({
        where: { id: invitationId },
        select: {
          id: true,
          organizationId: true,
          emailNormalized: true,
          role: true,
          status: true,
          expiresAt: true,
          organization: { select: { name: true } },
        },
      });
      if (invitation.status === 'PENDING' && invitation.expiresAt <= now) {
        await tx.organizationInvitation.update({
          where: { id: invitation.id },
          data: { status: 'EXPIRED', pendingKey: null },
        });
        return { kind: 'EXPIRED' as const };
      }
      if (invitation.status !== 'PENDING') return { kind: invitation.status } as const;
      this.assertEmailMatch(invitation.emailNormalized, user.email);
      const existing = await tx.membership.findUnique({
        where: {
          userId_organizationId: { userId: user.id, organizationId: invitation.organizationId },
        },
        select: { id: true, status: true, role: true },
      });
      const membership = existing
        ? existing.status === 'ACTIVE'
          ? existing
          : await tx.membership.update({
              where: { id: existing.id },
              data: { status: 'ACTIVE', role: invitation.role },
              select: { id: true, status: true, role: true },
            })
        : await tx.membership.create({
            data: {
              organizationId: invitation.organizationId,
              userId: user.id,
              role: invitation.role,
              status: 'ACTIVE',
            },
            select: { id: true, status: true, role: true },
          });
      await tx.organizationInvitation.update({
        where: { id: invitation.id },
        data: {
          status: 'ACCEPTED',
          pendingKey: null,
          acceptedByUserId: user.id,
          acceptedAt: now,
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: invitation.organizationId,
          actorUserId: user.id,
          action: 'ORGANIZATION_INVITATION_ACCEPTED',
          entityType: 'OrganizationInvitation',
          entityId: invitation.id,
          metadata: { role: membership.role, alreadyMember: existing?.status === 'ACTIVE' },
          ...context,
        },
      });
      if (existing?.status !== 'ACTIVE') {
        await tx.auditLog.create({
          data: {
            organizationId: invitation.organizationId,
            actorUserId: user.id,
            action: existing ? 'MEMBERSHIP_REACTIVATED' : 'MEMBERSHIP_CREATED',
            entityType: 'Membership',
            entityId: membership.id,
            metadata: { role: membership.role, source: 'ORGANIZATION_INVITATION' },
            ...context,
          },
        });
      }
      return {
        kind: 'ACCEPTED_NOW' as const,
        membership,
        organization: { id: invitation.organizationId, name: invitation.organization.name },
        alreadyMember: existing?.status === 'ACTIVE',
      };
    });
    if (outcome.kind === 'ACCEPTED_NOW') return outcome;
    if (outcome.kind === 'ACCEPTED') {
      throw new ConflictException({
        code: 'INVITATION_ALREADY_USED',
        message: 'Esta invitación ya fue utilizada.',
      });
    }
    throw new GoneException({
      code: outcome.kind === 'REVOKED' ? 'INVITATION_REVOKED' : 'INVITATION_EXPIRED',
      message:
        outcome.kind === 'REVOKED' ? 'Esta invitación fue revocada.' : 'Esta invitación venció.',
    });
  }

  async revoke(
    organizationId: string,
    invitationId: string,
    actorUserId: string,
    context: Context,
  ) {
    const now = new Date();
    const outcome = await this.prisma.$transaction(async (tx) => {
      await this.lockInvitationById(tx, organizationId, invitationId);
      const invitation = await tx.organizationInvitation.findFirst({
        where: { id: invitationId, organizationId },
        select: { id: true, status: true, expiresAt: true },
      });
      if (!invitation) throw new NotFoundException('Invitación no encontrada.');
      if (invitation.status === 'PENDING' && invitation.expiresAt <= now) {
        await tx.organizationInvitation.update({
          where: { id: invitation.id },
          data: { status: 'EXPIRED', pendingKey: null },
        });
        return 'EXPIRED' as const;
      }
      if (invitation.status !== 'PENDING') return invitation.status;
      const revoked = await tx.organizationInvitation.update({
        where: { id: invitation.id },
        data: { status: 'REVOKED', pendingKey: null, revokedAt: now },
        select: { id: true, status: true, revokedAt: true },
      });
      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'ORGANIZATION_INVITATION_REVOKED',
          entityType: 'OrganizationInvitation',
          entityId: invitation.id,
          metadata: {},
          ...context,
        },
      });
      return revoked;
    });
    if (typeof outcome !== 'string') return outcome;
    throw new ConflictException({
      code: `INVITATION_${outcome}`,
      message: 'La invitación ya no está pendiente.',
    });
  }

  async updateMemberRole(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    role: MembershipRole,
    context: Context,
  ) {
    if (!canInviteOrganizationRole(role)) {
      throw new ForbiddenException('La propiedad de la organización no se modifica en este flujo.');
    }
    return this.prisma.$transaction(async (tx) => {
      await this.lockMembership(tx, organizationId, membershipId);
      const membership = await tx.membership.findFirst({
        where: { id: membershipId, organizationId },
        select: { id: true, userId: true, role: true, status: true },
      });
      if (!membership) throw new NotFoundException('Miembro no encontrado.');
      if (membership.role === 'ORG_OWNER') {
        throw new ForbiddenException('La propiedad requiere un flujo dedicado.');
      }
      if (membership.userId === actorUserId) {
        throw new ForbiddenException('No puedes modificar tu propio rol desde este flujo.');
      }
      if (membership.status !== 'ACTIVE') {
        throw new ConflictException('Solo puedes modificar miembros activos.');
      }
      const updated = await tx.membership.update({
        where: { id: membership.id },
        data: { role },
        select: {
          id: true,
          role: true,
          status: true,
          updatedAt: true,
          user: { select: { id: true, email: true, displayName: true } },
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'MEMBERSHIP_ROLE_CHANGED',
          entityType: 'Membership',
          entityId: membership.id,
          metadata: { from: membership.role, to: role },
          ...context,
        },
      });
      return updated;
    });
  }

  async deactivateMember(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    context: Context,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockMembership(tx, organizationId, membershipId);
      const membership = await tx.membership.findFirst({
        where: { id: membershipId, organizationId },
        select: { id: true, userId: true, role: true, status: true },
      });
      if (!membership) throw new NotFoundException('Miembro no encontrado.');
      if (membership.role === 'ORG_OWNER') {
        throw new ForbiddenException('La persona propietaria no puede desactivarse en V1.');
      }
      if (membership.userId === actorUserId) {
        throw new ForbiddenException('No puedes desactivar tu propio acceso desde este flujo.');
      }
      if (membership.status === 'SUSPENDED') return membership;
      const updated = await tx.membership.update({
        where: { id: membership.id },
        data: { status: 'SUSPENDED' },
        select: {
          id: true,
          role: true,
          status: true,
          updatedAt: true,
          user: { select: { id: true, email: true, displayName: true } },
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'MEMBERSHIP_DEACTIVATED',
          entityType: 'Membership',
          entityId: membership.id,
          metadata: { role: membership.role },
          ...context,
        },
      });
      return updated;
    });
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private assertEmailMatch(invitedEmail: string, authenticatedEmail: string) {
    if (normalizeInvitationEmail(authenticatedEmail) !== invitedEmail) {
      throw new ForbiddenException({
        code: 'INVITATION_EMAIL_MISMATCH',
        message: 'Inicia sesión con el correo al que se envió esta invitación.',
      });
    }
  }

  private invitationNotFound() {
    return new NotFoundException({
      code: 'INVITATION_NOT_FOUND',
      message: 'La invitación no existe o ya no está disponible.',
    });
  }

  private async lockOrganization(tx: Transaction, organizationId: string) {
    await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${organizationId}::uuid FOR UPDATE`;
  }

  private async lockInvitationByToken(tx: Transaction, tokenHash: string) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "OrganizationInvitation" WHERE "tokenHash" = ${tokenHash} FOR UPDATE
    `;
    if (!rows[0]) throw this.invitationNotFound();
    return rows[0].id;
  }

  private async lockInvitationById(tx: Transaction, organizationId: string, invitationId: string) {
    await tx.$queryRaw`
      SELECT id
      FROM "OrganizationInvitation"
      WHERE id = ${invitationId}::uuid
        AND "organizationId" = ${organizationId}::uuid
      FOR UPDATE
    `;
  }

  private async lockMembership(tx: Transaction, organizationId: string, membershipId: string) {
    await tx.$queryRaw`
      SELECT id
      FROM "Membership"
      WHERE id = ${membershipId}::uuid
        AND "organizationId" = ${organizationId}::uuid
      FOR UPDATE
    `;
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
