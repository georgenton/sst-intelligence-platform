import type { APIRequestContext } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

type Registration = { body: string; statusCode: number | undefined };

export function parseRegistration(registration: Registration) {
  if (registration.statusCode !== 201)
    throw new Error(`E2E_REGISTRATION_FAILED:${registration.body}`);
  return JSON.parse(registration.body) as {
    accessToken: string;
    user: { id: string; displayName: string; email: string };
  };
}

export async function createE2eOrganization(
  api: APIRequestContext,
  registration: Registration,
  name: string,
) {
  const session = parseRegistration(registration);
  const response = await api.post('http://127.0.0.1:3101/api/v1/organizations', {
    headers: { authorization: `Bearer ${session.accessToken}` },
    data: { name, country: 'Ecuador', sector: 'Operación preventiva' },
  });
  if (response.status() !== 201)
    throw new Error(`E2E_ORGANIZATION_FAILED:${await response.text()}`);
  const organization = (await response.json()) as { id: string; name: string };
  return {
    session,
    organization,
    headers: {
      authorization: `Bearer ${session.accessToken}`,
      'x-organization-id': organization.id,
    },
  };
}

export async function setE2eOrganizationPlan(
  organizationId: string,
  planKey: 'STARTER' | 'GROWTH',
) {
  const prisma = new PrismaClient();
  try {
    const plan = await prisma.plan.findUniqueOrThrow({ where: { key: planKey } });
    await prisma.subscription.updateMany({
      where: { organizationId, status: 'ACTIVE' },
      data: { planId: plan.id },
    });
  } finally {
    await prisma.$disconnect();
  }
}

export async function markE2eOrganizationLegacyConfigured(
  organizationId: string,
  createdById: string,
) {
  const prisma = new PrismaClient();
  try {
    await prisma.operationalPlan.create({ data: { organizationId, createdById } });
  } finally {
    await prisma.$disconnect();
  }
}
