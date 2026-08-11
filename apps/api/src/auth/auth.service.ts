import { randomBytes, randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { argon2id, hash, verify } from 'argon2';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

type Context = { requestId: string; ip?: string; userAgent?: string };

class RefreshReuseError extends Error {}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  private async accessToken(user: { id: string; email: string }) {
    return this.jwt.signAsync({ id: user.id, email: user.email, sub: user.id });
  }

  private async refreshToken(userId: string, context: Context, familyId: string = randomUUID()) {
    const secret = randomBytes(32).toString('base64url');
    const expiresAt = new Date(
      Date.now() + Number(process.env.REFRESH_TOKEN_DAYS ?? 30) * 86_400_000,
    );
    const session = await this.prisma.refreshSession.create({
      data: {
        familyId,
        userId,
        tokenHash: await hash(secret, { type: argon2id }),
        expiresAt,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      select: { id: true },
    });
    return `${session.id}.${secret}`;
  }

  async register(
    input: { email: string; displayName: string; password: string },
    context: Context,
  ) {
    const email = input.email.trim().toLowerCase();
    const exists = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (exists) throw new UnauthorizedException('No fue posible completar el registro.');
    const user = await this.prisma.user.create({
      data: {
        email,
        displayName: input.displayName.trim(),
        passwordHash: await hash(input.password, {
          type: argon2id,
          memoryCost: 19_456,
          timeCost: 2,
        }),
      },
      select: { id: true, email: true, displayName: true },
    });
    await this.audit.record({
      actorUserId: user.id,
      action: 'USER_REGISTERED',
      entityType: 'User',
      entityId: user.id,
      ...context,
    });
    return {
      user,
      accessToken: await this.accessToken(user),
      refreshToken: await this.refreshToken(user.id, context),
    };
  }

  async login(input: { email: string; password: string }, context: Context) {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.trim().toLowerCase() },
    });
    const valid = user ? await verify(user.passwordHash, input.password).catch(() => false) : false;
    if (!user || !valid) {
      await this.audit.record({
        action: 'LOGIN_FAILED',
        entityType: 'User',
        metadata: { emailHashRecorded: true },
        ...context,
      });
      throw new UnauthorizedException('Credenciales no válidas.');
    }
    await this.audit.record({
      actorUserId: user.id,
      action: 'LOGIN_SUCCEEDED',
      entityType: 'User',
      entityId: user.id,
      ...context,
    });
    return {
      user: { id: user.id, email: user.email, displayName: user.displayName },
      accessToken: await this.accessToken(user),
      refreshToken: await this.refreshToken(user.id, context),
    };
  }

  async refresh(rawToken: string | undefined, context: Context) {
    const [id, secret] = rawToken?.split('.') ?? [];
    if (!id || !secret) throw new UnauthorizedException('Sesión no válida.');
    const session = await this.prisma.refreshSession.findUnique({
      where: { id },
      include: { user: { select: { id: true, email: true, displayName: true } } },
    });
    if (!session || !(await verify(session.tokenHash, secret).catch(() => false)))
      throw new UnauthorizedException('Sesión no válida.');
    if (session.revokedAt) {
      await this.revokeFamily(session.familyId);
      throw new UnauthorizedException('Sesión no válida.');
    }
    if (session.expiresAt <= new Date()) throw new UnauthorizedException('Sesión no válida.');
    const replacementId = randomUUID();
    const replacementSecret = randomBytes(32).toString('base64url');
    const replacement = `${replacementId}.${replacementSecret}`;
    const replacementHash = await hash(replacementSecret, { type: argon2id });
    const now = new Date();
    const expiresAt = new Date(
      Date.now() + Number(process.env.REFRESH_TOKEN_DAYS ?? 30) * 86_400_000,
    );
    try {
      await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.refreshSession.updateMany({
          where: { id: session.id, revokedAt: null, expiresAt: { gt: now } },
          data: { revokedAt: now, replacedById: replacementId },
        });
        if (claimed.count !== 1) throw new RefreshReuseError();
        await tx.refreshSession.create({
          data: {
            id: replacementId,
            familyId: session.familyId,
            userId: session.userId,
            tokenHash: replacementHash,
            expiresAt,
            ip: context.ip,
            userAgent: context.userAgent,
          },
        });
      });
    } catch (error: unknown) {
      if (!(error instanceof RefreshReuseError)) throw error;
      await this.revokeFamily(session.familyId);
      throw new UnauthorizedException('Sesión no válida.');
    }
    return {
      user: session.user,
      accessToken: await this.accessToken(session.user),
      refreshToken: replacement,
    };
  }

  private revokeFamily(familyId: string) {
    const now = new Date();
    return this.prisma.refreshSession.updateMany({
      where: { familyId },
      data: { revokedAt: now, reuseDetectedAt: now },
    });
  }

  async logout(rawToken: string | undefined) {
    const id = rawToken?.split('.')[0];
    if (id)
      await this.prisma.refreshSession.updateMany({
        where: { id },
        data: { revokedAt: new Date() },
      });
  }

  me(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        memberships: {
          where: { status: 'ACTIVE' },
          select: { role: true, organization: { select: { id: true, name: true, status: true } } },
        },
      },
    });
  }
}
