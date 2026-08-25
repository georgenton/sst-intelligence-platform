import { expect, test, type Page } from '@playwright/test';

async function createDemoOrganization(page: Page, suffix: number, organizationName: string) {
  await page.goto('/diagnostico');
  await page.getByRole('button', { name: 'Comenzar' }).click();
  await expect(page.getByText('Paso 1 de 6')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar y continuar' }).click();
  await expect(page.getByText('Paso 2 de 6')).toBeVisible();
  await page.getByLabel('Actividades críticas').check();
  await page.getByLabel('Riesgo de incendio').check();
  await page.getByRole('button', { name: 'Guardar y continuar' }).click();
  await expect(page.getByText('Paso 3 de 6')).toBeVisible();
  await page.getByLabel('Permisos manuales').check();
  await page.getByLabel('Dificultad para encontrar evidencias').check();
  await page.getByLabel('Hallazgos recurrentes').check();
  await page.getByRole('button', { name: 'Guardar y continuar' }).click();
  await expect(page.getByText('Paso 4 de 6')).toBeVisible();
  await page.getByLabel('Múltiples turnos').check();
  await page.getByRole('button', { name: 'Guardar y continuar' }).click();
  await expect(page.getByText('Paso 5 de 6')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar y continuar' }).click();
  await expect(page.getByText('Paso 6 de 6')).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/diagnostico\/[0-9a-f-]+\/resultado$/),
    page.getByRole('button', { name: 'Ver recomendación' }).click(),
  ]);
  await page.getByRole('link', { name: 'Crear cuenta y continuar' }).click();
  await page.getByLabel('Nombre').fill('Usuario AppShell E2E');
  await page.getByLabel('Correo').fill(`app-shell-${suffix}@example.test`);
  await page.getByLabel('Contraseña').fill('app-shell-e2e-password-123');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await page.getByLabel('Nombre de empresa').fill(organizationName);
  await page.getByLabel('Sector').fill('Manufactura');
  await page.getByRole('button', { name: 'Crear y activar demo' }).click();
  await expect(page.getByRole('heading', { name: 'Centro de comando' })).toBeVisible();
}

test('authenticated shell navigation, command center and isolated organization switch', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const suffix = Date.now();
  const firstOrganization = `Operación central ${suffix}`;
  const secondOrganization = `Operación alterna ${suffix}`;

  await createDemoOrganization(page, suffix, firstOrganization);
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
  await page.getByRole('link', { name: 'Inicio', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Centro de comando' })).toBeVisible();

  await page.getByRole('link', { name: 'Inspecciones', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/inspections$/);
  await expect(page.getByRole('link', { name: 'Inspecciones', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );

  await page.getByRole('link', { name: 'Riesgo técnico', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/technical-risk$/);
  await expect(page.getByRole('link', { name: 'Riesgo técnico', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );

  await page.getByRole('link', { name: 'Inicio', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Centro de comando' })).toBeVisible();

  await page.getByRole('link', { name: 'Organizaciones', exact: true }).click();
  await page.getByLabel('Nombre de empresa').fill(secondOrganization);
  await page.getByRole('button', { name: 'Crear organización' }).click();
  await expect(page.getByText('Organización creada correctamente.')).toBeVisible();
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
    page.getByRole('status').filter({ hasText: 'Cambiando organización' }),
  ).toBeVisible();
  await expect(page.locator('#main-content')).not.toContainText(firstOrganization);
  await expect(page.getByText(secondOrganization, { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Centro de comando' })).toBeVisible();
  await expect(page.locator('#main-content')).not.toContainText(firstOrganization);
  await expect(
    page.getByRole('heading', { name: 'Completa la configuración inicial de SST' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Comenzar configuración SST' })).toBeVisible();
  await expect(page.getByText('Sin elementos que requieran atención hoy')).toHaveCount(0);

  await page.getByRole('link', { name: 'Módulos', exact: true }).click();
  await expect(page.getByText('NO INCLUIDO').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Solicitar mejora →' }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Salir' }).click();
  await expect(page).toHaveURL(/\/(?:auth\/login(?:\?.*)?)?$/);
});
