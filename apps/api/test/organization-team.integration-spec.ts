import { createHash } from 'node:crypto';
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('organization team and invitations integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
  });

  afterAll(async () => app.close());

  async function register(label: string) {
    const email = `${label.toLowerCase().replaceAll(' ', '-')}-${suffix}@example.test`;
    const user = await prisma.user.create({
      data: { email, displayName: label, passwordHash: 'integration-fixture-not-for-login' },
      select: { id: true },
    });
    return {
      email,
      token: await jwt.signAsync({ id: user.id, email, sub: user.id }),
      userId: user.id,
    };
  }

  async function registerWithSession(label: string) {
    const email = `${label.toLowerCase().replaceAll(' ', '-')}-${suffix}@example.test`;
    const password = 'Membership-session-42!';
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, displayName: label, password })
      .expect(201);
    const setCookie = response.headers['set-cookie'];
    const refreshCookie = (Array.isArray(setCookie) ? setCookie[0] : setCookie)?.split(';')[0];
    expect(refreshCookie).toMatch(/^sst_refresh=/);
    return {
      email,
      password,
      refreshCookie: refreshCookie!,
      token: response.body.accessToken as string,
      userId: response.body.user.id as string,
    };
  }

  async function organization(token: string, label: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `${label} ${suffix}`, country: 'Ecuador' })
      .expect(201);
    return response.body.id as string;
  }

  function api(token: string, organizationId: string) {
    const operation = (method: 'get' | 'post' | 'patch', path: string) => {
      const client = request(app.getHttpServer());
      const pending =
        method === 'get'
          ? client.get(`/api/v1${path}`)
          : method === 'patch'
            ? client.patch(`/api/v1${path}`)
            : client.post(`/api/v1${path}`);
      return pending
        .set('Authorization', `Bearer ${token}`)
        .set('x-organization-id', organizationId);
    };
    return {
      get: (path: string) => operation('get', path),
      post: (path: string) => operation('post', path),
      patch: (path: string) => operation('patch', path),
    };
  }

  function invitation(token: string, path: 'inspect' | 'accept') {
    return request(app.getHttpServer())
      .post(`/api/v1/organization-invitations/${path}`)
      .set('Authorization', `Bearer ${token}`);
  }

  async function invite(
    ownerToken: string,
    organizationId: string,
    email: string,
    role = 'SST_MANAGER',
  ) {
    return api(ownerToken, organizationId)
      .post(`/organizations/${organizationId}/invitations`)
      .send({ email, role })
      .expect(201);
  }

  it('stores only the token hash and binds single-use acceptance to normalized email', async () => {
    const owner = await register('Team Owner Acceptance');
    const member = await register('Team Member Acceptance');
    const wrongUser = await register('Team Wrong User');
    const organizationId = await organization(owner.token, 'Team Acceptance');

    const created = await invite(owner.token, organizationId, `  ${member.email.toUpperCase()}  `);
    const rawToken = created.body.token as string;
    expect(rawToken).toHaveLength(43);
    expect(created.body).toMatchObject({
      emailNormalized: member.email,
      role: 'SST_MANAGER',
      status: 'PENDING',
      delivery: 'MANUAL_COPY_LINK',
    });

    const stored = await prisma.organizationInvitation.findUniqueOrThrow({
      where: { id: created.body.id as string },
    });
    expect(stored.tokenHash).toBe(createHash('sha256').update(rawToken).digest('hex'));
    expect(JSON.stringify(stored)).not.toContain(rawToken);
    const storedTtl = stored.expiresAt.getTime() - stored.createdAt.getTime();
    expect(storedTtl).toBeGreaterThan(7 * 24 * 60 * 60 * 1000 - 5_000);
    expect(storedTtl).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000);

    await invitation(wrongUser.token, 'inspect')
      .send({ token: rawToken })
      .expect(403)
      .expect(({ body }) => expect(body.code).toBe('INVITATION_EMAIL_MISMATCH'));
    await invitation(wrongUser.token, 'accept').send({ token: rawToken }).expect(403);

    await invitation(member.token, 'inspect')
      .send({ token: rawToken })
      .expect(201)
      .expect(({ body }) =>
        expect(body).toMatchObject({
          emailNormalized: member.email,
          role: 'SST_MANAGER',
          status: 'PENDING',
        }),
      );
    await invitation(member.token, 'accept')
      .send({ token: rawToken })
      .expect(201)
      .expect(({ body }) => {
        expect(body.kind).toBe('ACCEPTED_NOW');
        expect(body.organization.id).toBe(organizationId);
      });
    await invitation(member.token, 'accept')
      .send({ token: rawToken })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('INVITATION_ALREADY_USED'));

    expect(
      await prisma.membership.count({
        where: { organizationId, userId: member.userId, status: 'ACTIVE' },
      }),
    ).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: {
          organizationId,
          action: {
            in: [
              'ORGANIZATION_INVITATION_CREATED',
              'ORGANIZATION_INVITATION_ACCEPTED',
              'MEMBERSHIP_CREATED',
            ],
          },
        },
      }),
    ).toBeGreaterThanOrEqual(3);
  });

  it('enforces tenant and role administration boundaries', async () => {
    const ownerA = await register('Team Boundary Owner A');
    const ownerB = await register('Team Boundary Owner B');
    const viewer = await register('Team Boundary Viewer');
    const invited = await register('Team Boundary Invited');
    const orgA = await organization(ownerA.token, 'Team Boundary A');
    const orgB = await organization(ownerB.token, 'Team Boundary B');
    await prisma.membership.create({
      data: { organizationId: orgA, userId: viewer.userId, role: 'VIEWER', status: 'ACTIVE' },
    });

    await api(ownerA.token, orgA).get(`/organizations/${orgA}/members`).expect(200);
    await api(ownerA.token, orgB).get(`/organizations/${orgB}/members`).expect(403);
    await api(ownerA.token, orgB)
      .post(`/organizations/${orgB}/invitations`)
      .send({ email: invited.email, role: 'SST_MANAGER' })
      .expect(403);
    await api(viewer.token, orgA)
      .post(`/organizations/${orgA}/invitations`)
      .send({ email: invited.email, role: 'SST_MANAGER' })
      .expect(403);
    await api(ownerA.token, orgA)
      .post(`/organizations/${orgA}/invitations`)
      .send({ email: invited.email, role: 'ORG_OWNER' })
      .expect(403)
      .expect(({ body }) => expect(body.code).toBe('INVITATION_ROLE_FORBIDDEN'));

    const created = await invite(ownerB.token, orgB, invited.email);
    await api(ownerA.token, orgA)
      .post(`/organizations/${orgA}/invitations/${created.body.id as string}/revoke`)
      .expect(404);
    const ownerBMembership = await prisma.membership.findUniqueOrThrow({
      where: { userId_organizationId: { userId: ownerB.userId, organizationId: orgB } },
    });
    await api(ownerA.token, orgA)
      .patch(`/organizations/${orgA}/members/${ownerBMembership.id}/role`)
      .send({ role: 'VIEWER' })
      .expect(404);
  });

  it('revokes and expires pending invitations deterministically', async () => {
    const owner = await register('Team Owner Terminal');
    const revokedUser = await register('Team Revoked User');
    const expiredUser = await register('Team Expired User');
    const revokedOrganization = await organization(owner.token, 'Team Revocation');
    const expiredOrganization = await organization(owner.token, 'Team Expiry');

    const revoked = await invite(owner.token, revokedOrganization, revokedUser.email);
    await api(owner.token, revokedOrganization)
      .post(`/organizations/${revokedOrganization}/invitations/${revoked.body.id as string}/revoke`)
      .expect(201)
      .expect(({ body }) => expect(body.status).toBe('REVOKED'));
    await invitation(revokedUser.token, 'accept')
      .send({ token: revoked.body.token as string })
      .expect(410)
      .expect(({ body }) => expect(body.code).toBe('INVITATION_REVOKED'));

    const expired = await invite(owner.token, expiredOrganization, expiredUser.email);
    await prisma.organizationInvitation.update({
      where: { id: expired.body.id as string },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    await invitation(expiredUser.token, 'inspect')
      .send({ token: expired.body.token as string })
      .expect(201)
      .expect(({ body }) => expect(body.status).toBe('EXPIRED'));
    await invitation(expiredUser.token, 'accept')
      .send({ token: expired.body.token as string })
      .expect(410)
      .expect(({ body }) => expect(body.code).toBe('INVITATION_EXPIRED'));
    expect(
      await prisma.organizationInvitation.findUniqueOrThrow({
        where: { id: expired.body.id as string },
        select: { status: true },
      }),
    ).toEqual({ status: 'EXPIRED' });
  });

  it('serializes parallel accept and accept-versus-revoke races', async () => {
    const owner = await register('Team Owner Concurrency');
    const doubleUser = await register('Team Double Accept');
    const raceUser = await register('Team Revoke Race');
    const doubleOrganization = await organization(owner.token, 'Team Double Acceptance');
    const raceOrganization = await organization(owner.token, 'Team Terminal Race');
    const doubleInvitation = await invite(owner.token, doubleOrganization, doubleUser.email);

    const doubleResponses = await Promise.all([
      invitation(doubleUser.token, 'accept').send({ token: doubleInvitation.body.token as string }),
      invitation(doubleUser.token, 'accept').send({ token: doubleInvitation.body.token as string }),
    ]);
    expect(doubleResponses.map(({ status }) => status).sort()).toEqual([201, 409]);
    expect(
      await prisma.membership.count({
        where: { organizationId: doubleOrganization, userId: doubleUser.userId },
      }),
    ).toBe(1);

    const raceInvitation = await invite(owner.token, raceOrganization, raceUser.email);
    const raceResponses = await Promise.all([
      invitation(raceUser.token, 'accept').send({ token: raceInvitation.body.token as string }),
      api(owner.token, raceOrganization)
        .post(
          `/organizations/${raceOrganization}/invitations/${raceInvitation.body.id as string}/revoke`,
        )
        .send(),
    ]);
    expect(raceResponses.filter(({ status }) => status === 201)).toHaveLength(1);
    expect(raceResponses.filter(({ status }) => status === 409 || status === 410)).toHaveLength(1);
    const terminal = await prisma.organizationInvitation.findUniqueOrThrow({
      where: { id: raceInvitation.body.id as string },
      select: { status: true },
    });
    expect(['ACCEPTED', 'REVOKED']).toContain(terminal.status);
    expect(
      await prisma.membership.count({
        where: { organizationId: raceOrganization, userId: raceUser.userId },
      }),
    ).toBe(terminal.status === 'ACCEPTED' ? 1 : 0);
  });

  it('changes and deactivates non-owner roles without deleting historical membership', async () => {
    const owner = await register('Team Owner Lifecycle');
    const member = await register('Team Member Lifecycle');
    const unrelated = await register('Team Unrelated Lifecycle');
    const organizationId = await organization(owner.token, 'Team Member Lifecycle');
    const created = await invite(owner.token, organizationId, member.email, 'SST_TECHNICIAN');
    await invitation(member.token, 'accept')
      .send({ token: created.body.token as string })
      .expect(201);
    const membership = await prisma.membership.findUniqueOrThrow({
      where: { userId_organizationId: { userId: member.userId, organizationId } },
    });

    await api(owner.token, organizationId)
      .patch(`/organizations/${organizationId}/members/${membership.id}/role`)
      .send({ role: 'SST_MANAGER' })
      .expect(200)
      .expect(({ body }) => expect(body.role).toBe('SST_MANAGER'));
    await api(owner.token, organizationId)
      .post(`/organizations/${organizationId}/members/${membership.id}/deactivate`)
      .expect(201)
      .expect(({ body }) => expect(body.status).toBe('SUSPENDED'));
    expect(
      await prisma.membership.findUniqueOrThrow({
        where: { id: membership.id },
        select: { id: true, role: true, status: true },
      }),
    ).toEqual({ id: membership.id, role: 'SST_MANAGER', status: 'SUSPENDED' });
    await api(member.token, organizationId)
      .get(`/organizations/${organizationId}/members`)
      .expect(403);
    const reactivation = await invite(owner.token, organizationId, member.email, 'CONSULTANT');
    await invitation(unrelated.token, 'accept')
      .send({ token: reactivation.body.token as string })
      .expect(403)
      .expect(({ body }) => expect(body.code).toBe('INVITATION_EMAIL_MISMATCH'));
    expect(
      await prisma.membership.findUniqueOrThrow({
        where: { id: membership.id },
        select: { id: true, role: true, status: true },
      }),
    ).toEqual({ id: membership.id, role: 'SST_MANAGER', status: 'SUSPENDED' });
    await invitation(member.token, 'accept')
      .send({ token: reactivation.body.token as string })
      .expect(201);
    expect(
      await prisma.membership.findUniqueOrThrow({
        where: { id: membership.id },
        select: { id: true, role: true, status: true },
      }),
    ).toEqual({ id: membership.id, role: 'CONSULTANT', status: 'ACTIVE' });
    expect(
      await prisma.auditLog.count({
        where: {
          organizationId,
          action: {
            in: ['MEMBERSHIP_ROLE_CHANGED', 'MEMBERSHIP_DEACTIVATED', 'MEMBERSHIP_REACTIVATED'],
          },
        },
      }),
    ).toBe(3);
  });

  it('applies suspension and role downgrade immediately to existing and refreshed sessions', async () => {
    const owner = await registerWithSession('Live Policy Owner');
    const member = await registerWithSession('Live Suspended Member');
    const admin = await registerWithSession('Live Downgraded Admin');
    const suspensionOrganization = await organization(owner.token, 'Live Suspension');
    const memberOtherOrganization = await organization(member.token, 'Live Other Membership');
    const roleOrganization = await organization(owner.token, 'Live Role Downgrade');

    const memberInvitation = await invite(
      owner.token,
      suspensionOrganization,
      member.email,
      'SST_MANAGER',
    );
    await invitation(member.token, 'accept')
      .send({ token: memberInvitation.body.token as string })
      .expect(201);
    const memberMembership = await prisma.membership.findUniqueOrThrow({
      where: {
        userId_organizationId: {
          userId: member.userId,
          organizationId: suspensionOrganization,
        },
      },
    });

    await api(member.token, suspensionOrganization)
      .get(`/organizations/${suspensionOrganization}/members`)
      .expect(200);
    await api(owner.token, suspensionOrganization)
      .post(`/organizations/${suspensionOrganization}/members/${memberMembership.id}/deactivate`)
      .expect(201);
    await api(member.token, suspensionOrganization)
      .get(`/organizations/${suspensionOrganization}/members`)
      .expect(403);
    await api(member.token, memberOtherOrganization)
      .get(`/organizations/${memberOtherOrganization}/members`)
      .expect(200);

    const refreshed = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', member.refreshCookie)
      .expect(201);
    const refreshedAccessToken = refreshed.body.accessToken as string;
    await api(refreshedAccessToken, suspensionOrganization)
      .get(`/organizations/${suspensionOrganization}/members`)
      .expect(403);
    await api(refreshedAccessToken, memberOtherOrganization)
      .get(`/organizations/${memberOtherOrganization}/members`)
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${refreshedAccessToken}`)
      .expect(200)
      .expect(({ body }) => {
        const organizationIds = body.memberships.map(
          (item: { organization: { id: string } }) => item.organization.id,
        );
        expect(organizationIds).toContain(memberOtherOrganization);
        expect(organizationIds).not.toContain(suspensionOrganization);
      });

    const adminInvitation = await invite(owner.token, roleOrganization, admin.email, 'ORG_ADMIN');
    await invitation(admin.token, 'accept')
      .send({ token: adminInvitation.body.token as string })
      .expect(201);
    const adminMembership = await prisma.membership.findUniqueOrThrow({
      where: {
        userId_organizationId: { userId: admin.userId, organizationId: roleOrganization },
      },
    });
    await api(admin.token, roleOrganization)
      .patch(`/organizations/${roleOrganization}`)
      .send({ name: `Admin active ${suffix}` })
      .expect(200);
    await api(owner.token, roleOrganization)
      .patch(`/organizations/${roleOrganization}/members/${adminMembership.id}/role`)
      .send({ role: 'VIEWER' })
      .expect(200);
    await api(admin.token, roleOrganization)
      .patch(`/organizations/${roleOrganization}`)
      .send({ name: `Admin stale ${suffix}` })
      .expect(403)
      .expect(({ body }) => expect(body.code).toBe('ROLE_REQUIRED'));
    await api(admin.token, roleOrganization)
      .get(`/organizations/${roleOrganization}/members`)
      .expect(200);

    const ownerMembership = await prisma.membership.findUniqueOrThrow({
      where: {
        userId_organizationId: { userId: owner.userId, organizationId: roleOrganization },
      },
    });
    await api(owner.token, roleOrganization)
      .patch(`/organizations/${roleOrganization}/members/${ownerMembership.id}/role`)
      .send({ role: 'VIEWER' })
      .expect(403);
    await api(owner.token, roleOrganization)
      .post(`/organizations/${roleOrganization}/members/${ownerMembership.id}/deactivate`)
      .expect(403);
  });
});
