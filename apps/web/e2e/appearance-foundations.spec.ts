import { expect, test, type APIRequestContext } from '@playwright/test';
import { createE2eOrganization, markE2eOrganizationLegacyConfigured } from './support/e2e-api';
import { activateE2eUserSession, registerE2eUser } from './support/register-e2e-user';

async function registerUser(page: import('@playwright/test').Page, email: string) {
  const registration = await registerE2eUser({
    displayName: 'Usuario Apariencia E2E',
    email,
    password: 'appearance-e2e-password-123',
  });
  expect(registration.statusCode, registration.body).toBe(201);
  return registration;
}

async function prepareLegacyOrganization(
  page: import('@playwright/test').Page,
  request: APIRequestContext,
  registration: Awaited<ReturnType<typeof registerUser>>,
  name: string,
) {
  const context = await createE2eOrganization(request, registration, name);
  await markE2eOrganizationLegacyConfigured(context.organization.id, context.session.user.id);
  await activateE2eUserSession(page, registration);
}

async function navigateWithinApp(page: import('@playwright/test').Page, pathname: string) {
  await page.evaluate((nextPathname) => {
    window.history.pushState(null, '', nextPathname);
  }, pathname);
  await expect.poll(() => page.evaluate(() => window.location.pathname)).toBe(pathname);
}

test('theme, no-flash reload, focus scope, public forcing and user isolation', async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(90_000);
  const suffix = Date.now();
  const firstEmail = `appearance-a-${suffix}@example.test`;
  const secondEmail = `appearance-b-${suffix}@example.test`;

  await page.addInitScript(() => {
    window.localStorage.setItem('sst:appearance:active-user', 'stale-public-user');
    window.localStorage.setItem('sst:appearance:user:stale-public-user:theme', 'noche');
    window.localStorage.setItem('sst:appearance:user:stale-public-user:focus:workspace', 'on');
  });
  await page.goto('/diagnostico');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'operativo');
  await expect(page.locator('html')).toHaveAttribute('data-focus', 'off');
  await expect(page.getByLabel('Tema visual')).toHaveCount(0);

  const firstRegistration = await registerUser(page, firstEmail);
  await prepareLegacyOrganization(
    page,
    request,
    firstRegistration,
    `Fundaciones visuales ${suffix}`,
  );
  await expect(page.getByLabel('Tema visual')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Centro de comando' })).toBeVisible();
  await expect(
    page.getByText(`Fundaciones visuales ${suffix}`, { exact: true }).first(),
  ).toBeVisible();

  for (const visualTheme of ['operativo', 'sereno', 'noche', 'contraste']) {
    await page.getByLabel('Tema visual').selectOption(visualTheme);
    await expect(page.locator('html')).toHaveAttribute('data-theme', visualTheme);
    await page.screenshot({
      path: testInfo.outputPath(`dashboard-${visualTheme}.png`),
      fullPage: true,
    });
  }

  await page.setViewportSize({ width: 320, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await expect(page.getByLabel('Organización activa')).toBeVisible();
  await expect(page.getByLabel('Tema visual')).toBeVisible();
  await expect(page.getByRole('switch', { name: /Enfoque/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Salir' })).toBeVisible();
  await page.getByRole('button', { name: 'Abrir navegación' }).click();
  await expect(page.getByRole('link', { name: 'Inicio', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cerrar navegación' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await page.getByRole('button', { name: 'Cerrar navegación' }).click();
  await page.screenshot({ path: testInfo.outputPath('dashboard-320px.png'), fullPage: true });
  await page.setViewportSize({ width: 640, height: 720 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('dashboard-200-percent-reflow.png'),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 720 });

  await page.getByLabel('Tema visual').selectOption('noche');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'noche');
  await expect(page.locator('html')).toHaveAttribute('data-focus', 'off');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'noche');
  await expect(page.getByLabel('Tema visual')).toHaveValue('noche');

  await page.getByRole('switch', { name: /Enfoque/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-focus', 'on');
  await page.screenshot({ path: testInfo.outputPath('workspace-focus-on.png'), fullPage: true });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'noche');

  await navigateWithinApp(page, '/app/inspections/new');
  await expect(page.locator('html')).toHaveAttribute('data-focus', 'off');
  await page.getByRole('switch', { name: /Enfoque/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-focus', 'on');

  const missingInspectionId = '00000000-0000-4000-8000-000000000001';
  await navigateWithinApp(page, `/app/inspections/${missingInspectionId}/findings/new`);
  await expect(page.locator('html')).toHaveAttribute('data-focus', 'off');

  await navigateWithinApp(page, '/app/inspections/new');
  await expect(page.locator('html')).toHaveAttribute('data-focus', 'on');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'noche');

  await navigateWithinApp(page, '/app/technical-risk/new');
  await expect(page.locator('html')).toHaveAttribute('data-focus', 'off');
  await page.getByRole('switch', { name: /Enfoque/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-focus', 'on');

  const missingAssessmentId = '00000000-0000-4000-8000-000000000002';
  await navigateWithinApp(page, `/app/technical-risk/${missingAssessmentId}/review`);
  await expect(page.locator('html')).toHaveAttribute('data-focus', 'off');

  await navigateWithinApp(page, '/app/technical-risk/new');
  await expect(page.locator('html')).toHaveAttribute('data-focus', 'on');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'noche');

  await page.getByLabel('Tema visual').selectOption('contraste');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'contraste');
  await expect(page.getByRole('switch', { name: /Enfoque/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );

  await page.getByRole('button', { name: 'Salir' }).click();
  await expect(page).toHaveURL(/\/(?:auth\/login(?:\?.*)?)?$/);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'operativo');
  await expect(page.locator('html')).toHaveAttribute('data-focus', 'off');
  const secondRegistration = await registerUser(page, secondEmail);
  await activateE2eUserSession(page, secondRegistration);
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'operativo');
  await expect(page.locator('html')).toHaveAttribute('data-focus', 'off');
});
