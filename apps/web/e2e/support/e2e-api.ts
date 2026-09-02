import type { APIRequestContext } from '@playwright/test';

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
