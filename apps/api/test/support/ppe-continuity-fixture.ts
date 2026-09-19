import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OrganizationsService } from '../../src/organizations/organizations.service';
import { PrismaService } from '../../src/prisma/prisma.service';

// Synthetic persistence fixture; the primary browser journey creates its own data.
export async function ppeContinuityFixture(app: INestApplication) {
  const prisma = app.get(PrismaService);
  const user = await prisma.user.create({
    data: {
      email: `ppe-continuity-${randomUUID()}@example.test`,
      displayName: 'Actor sintético EPP',
      passwordHash: 'test-fixture-not-for-login',
    },
  });
  const organization = await app
    .get(OrganizationsService)
    .create(
      user.id,
      { name: 'Continuidad EPP sintética', country: 'Ecuador' },
      { requestId: randomUUID() },
    );
  const organizationId = organization.id;
  await prisma.organization.update({
    where: { id: organizationId },
    data: { demoExpiresAt: new Date(Date.now() + 86_400_000) },
  });
  const center = await prisma.workCenter.findFirstOrThrow({ where: { organizationId } });
  const position = await prisma.position.create({
    data: { organizationId, name: 'Cargo sintético', createdById: user.id },
  });
  const worker = await prisma.worker.create({
    data: {
      organizationId,
      displayName: 'Persona sin cuenta',
      positionId: position.id,
      workCenterId: center.id,
      createdById: user.id,
    },
  });
  const item = await prisma.ppeCatalogItem.create({
    data: { organizationId, name: 'Elemento sintético', category: 'HEAD', createdById: user.id },
  });
  const token = await app
    .get(JwtService)
    .signAsync({ id: user.id, sub: user.id, email: user.email });
  return { prisma, organizationId, user, center, position, worker, item, token };
}
