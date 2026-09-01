import { expect, test, type Page } from '@playwright/test';
import { registerE2eUser } from './support/register-e2e-user';

async function createOrganization(page: Page, name: string) {
  await page.getByRole('link', { name: 'Organizaciones', exact: true }).click();
  await page.getByLabel('Nombre de empresa').fill(name);
  await page.getByLabel('Sector').fill('Operación industrial sintética');
  await page.getByRole('button', { name: 'Crear organización' }).click();
  await expect(page.getByText('Organización creada correctamente.')).toBeVisible();
}

test.describe.serial('workforce safety operations', () => {
  test('registra y desactiva un trabajador sin consumir un asiento de acceso', async ({ page }) => {
    test.setTimeout(120_000);
    const suffix = Date.now();
    const email = `worker-owner-${suffix}@example.test`;
    const password = 'worker-e2e-password-strong-123';
    const organizationName = `Organización Personas ${suffix}`;
    const workerName = `Ana Operadora ${suffix}`;
    const registration = await registerE2eUser({
      displayName: 'Owner Personas E2E',
      email,
      password,
    });
    expect(registration.statusCode, registration.body).toBe(201);

    await page.goto('/auth/login');
    await page.getByLabel('Correo').fill(email);
    await page.getByLabel('Contraseña').fill(password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await createOrganization(page, organizationName);

    await page.getByRole('link', { name: 'Personas / Trabajadores', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Trabajadores', exact: true })).toBeVisible();
    await page.getByLabel('Nombre para la operación').fill(workerName);
    await page.getByLabel('Centro de trabajo asignado').selectOption({ index: 1 });
    await page.getByLabel('Cargo o función').fill('Operadora de mantenimiento');
    await page.getByLabel('Fecha de inicio').fill('2026-08-01');
    await page.getByRole('button', { name: 'Registrar trabajador' }).click();
    await expect(
      page.getByText('Trabajador registrado sin crear un asiento de acceso.'),
    ).toBeVisible();
    const workerRow = page.locator('article').filter({ hasText: workerName });
    await expect(workerRow).toContainText('Activo');
    await workerRow.getByRole('link', { name: 'Abrir espacio de trabajo' }).click();
    await expect(page.getByRole('heading', { name: workerName })).toBeVisible();
    await expect(page.getByText('No requiere cuenta de acceso')).toBeVisible();

    for (const width of [320, 640]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    }

    await page.getByRole('button', { name: 'Desactivar trabajador' }).click();
    await expect(page.getByText('Trabajador desactivado; su historia permanece.')).toBeVisible();
    await expect(page.getByText('Inactivo', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/app');
    await expect(page.getByText('1 personas con acceso')).toBeVisible();
  });
});
