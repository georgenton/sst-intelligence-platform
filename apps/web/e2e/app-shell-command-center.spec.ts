import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import {
  createE2eOrganization,
  markE2eOrganizationLegacyConfigured,
  setE2eOrganizationPlan,
} from './support/e2e-api';
import { activateE2eUserSession, registerE2eUser } from './support/register-e2e-user';

async function navigateFromPrimaryNavigation(page: Page, name: string, pathname: string) {
  const navigation = page.getByRole('navigation', { name: 'Navegación principal' });
  const link = navigation.getByRole('link', { name, exact: true });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', pathname);
  await Promise.all([page.waitForURL((url) => url.pathname === pathname), link.click()]);
}

async function createDemoOrganization(
  page: Page,
  request: APIRequestContext,
  suffix: number,
  organizationName: string,
  secondOrganizationName: string,
) {
  const registration = await registerE2eUser({
    displayName: 'Usuario AppShell E2E',
    email: `app-shell-${suffix}@example.test`,
    password: 'app-shell-e2e-password-123',
  });
  expect(registration.statusCode, registration.body).toBe(201);
  const context = await createE2eOrganization(request, registration, organizationName);
  await setE2eOrganizationPlan(context.organization.id, 'GROWTH');
  await markE2eOrganizationLegacyConfigured(context.organization.id, context.session.user.id);
  await createE2eOrganization(request, registration, secondOrganizationName);
  await activateE2eUserSession(page, registration);
  await expect(page.getByRole('heading', { name: 'Centro de comando' })).toBeVisible();
}

test('authenticated shell navigation, command center and isolated organization switch', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const suffix = Date.now();
  const firstOrganization = `Operación central ${suffix}`;
  const secondOrganization = `Operación alterna ${suffix}`;

  await createDemoOrganization(page, request, suffix, firstOrganization, secondOrganization);
  await expect(page.getByText(firstOrganization, { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Inicio', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await page.getByRole('link', { name: /centros de trabajo\. Abrir centros de trabajo/ }).click();
  await expect(page.getByRole('heading', { name: 'Empresa y centros de trabajo' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Centros de trabajo', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Centro principal', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Centro principal Activo' })).toBeVisible();
  await expect(page.locator('#main-content')).not.toContainText(/inválid|fuera del plan|excede/i);
  await navigateFromPrimaryNavigation(page, 'Inicio', '/app');
  await expect(page.getByRole('heading', { name: 'Centro de comando' })).toBeVisible();

  await navigateFromPrimaryNavigation(page, 'Inspecciones', '/app/inspections');
  await expect(page).toHaveURL(/\/app\/inspections$/);
  await expect(page.getByRole('link', { name: 'Inspecciones', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await navigateFromPrimaryNavigation(page, 'Inicio', '/app');
  await navigateFromPrimaryNavigation(page, 'Cola de trabajo', '/app/work');
  await expect(page.getByRole('heading', { name: 'Cola de trabajo' })).toBeVisible();

  for (const destination of [
    ['Plan operativo', '/app/plans'],
    ['Inspecciones', '/app/inspections'],
    ['Buscar', '/app/search'],
    ['Inteligencia gerencial', '/app/management-intelligence'],
    ['Paquetes de evidencia', '/app/evidence-packages'],
  ] as const) {
    await navigateFromPrimaryNavigation(page, destination[0], destination[1]);
    await expect(page).toHaveURL(new RegExp(`${destination[1]}$`));
  }

  await navigateFromPrimaryNavigation(page, 'Riesgo técnico', '/app/technical-risk');
  await expect(page).toHaveURL(/\/app\/technical-risk$/);
  await expect(page.getByRole('link', { name: 'Riesgo técnico', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );

  await navigateFromPrimaryNavigation(page, 'Inicio', '/app');
  await expect(page.getByRole('heading', { name: 'Centro de comando' })).toBeVisible();

  await page.getByLabel('Organización activa').selectOption({ label: firstOrganization });
  await page.getByRole('link', { name: 'Inicio', exact: true }).click();
  await expect(page.getByText(firstOrganization, { exact: true }).first()).toBeVisible();

  await page.evaluate(() => {
    const original = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) =>
      window.setTimeout(() => {
        window.requestAnimationFrame = original;
        callback(performance.now());
      }, 500);
  });
  await page.getByLabel('Organización activa').selectOption({ label: secondOrganization });
  await expect(
    page.getByRole('status').filter({ hasText: /Cambiando (?:organización|empresa)/ }),
  ).toBeVisible();
  await expect(page.locator('#main-content')).toHaveCount(0);
  await expect(
    page.getByRole('status').filter({ hasText: `Configurando ${secondOrganization}` }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Centro de comando' })).toHaveCount(0);
  await expect(page.locator('#setup-main')).not.toContainText(firstOrganization);
  await expect(
    page.getByRole('heading', { name: 'Conozcamos primero cómo funciona tu empresa.' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Continuar Evaluación SST' })).toBeVisible();
  await expect(page.getByText('Sin elementos que requieran atención hoy')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Módulos', exact: true })).toHaveCount(0);

  await page.getByLabel('Organización activa').selectOption({ label: firstOrganization });
  await expect(page.getByRole('heading', { name: 'Centro de comando' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible();

  await page.getByRole('button', { name: 'Salir' }).click();
  await expect(page).toHaveURL(/\/(?:auth\/login(?:\?.*)?)?$/);
});
