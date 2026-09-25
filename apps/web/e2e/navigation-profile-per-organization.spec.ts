import { expect, test } from '@playwright/test';
import { createE2eOrganization, markE2eOrganizationLegacyConfigured } from './support/e2e-api';
import { activateE2eUserSession, registerE2eUser } from './support/register-e2e-user';

test('navigation profile follows the active organization in one frontend session', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const suffix = Date.now();
  const registration = await registerE2eUser({
    displayName: 'Usuario perfil E2E',
    email: `navigation-profile-${suffix}@example.test`,
    password: 'navigation-profile-e2e-password-123',
  });
  expect(registration.statusCode, registration.body).toBe(201);

  const full = await createE2eOrganization(request, registration, `Empresa completa ${suffix}`);
  const pilot = await createE2eOrganization(request, registration, `Empresa piloto ${suffix}`);
  await markE2eOrganizationLegacyConfigured(full.organization.id, full.session.user.id);
  await markE2eOrganizationLegacyConfigured(pilot.organization.id, pilot.session.user.id);

  const profileResponse = await request.patch(
    `http://127.0.0.1:3101/api/v1/organizations/${pilot.organization.id}`,
    {
      headers: pilot.headers,
      data: { navigationProfile: 'PILOT' },
    },
  );
  expect(profileResponse.status(), await profileResponse.text()).toBe(200);

  await activateE2eUserSession(page, registration);
  await expect(page.getByRole('heading', { name: 'Centro de comando' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Preguntar / Operar', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Portafolio', exact: true })).toBeVisible();

  await page.getByLabel('Organización activa').selectOption({ label: `Empresa piloto ${suffix}` });
  await expect(page.getByRole('heading', { name: 'Centro de comando' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Evaluación SST', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Plan operativo', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Cola de trabajo', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Preguntar / Operar', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Portafolio', exact: true })).toHaveCount(0);

  await page
    .getByLabel('Organización activa')
    .selectOption({ label: `Empresa completa ${suffix}` });
  await expect(page.getByRole('heading', { name: 'Centro de comando' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Preguntar / Operar', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Portafolio', exact: true })).toBeVisible();
});
