import { expect, test } from '@playwright/test';

test('diagnóstico, registro, demo, cambio de organización y bloqueo', async ({ page }) => {
  test.setTimeout(90_000);
  const suffix = Date.now();
  const firstOrganization = `Industria Demo ${suffix}`;
  const secondOrganization = `Consultoría ${suffix}`;

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
  await expect(page.getByRole('heading', { name: /ruta SST modular/i })).toBeVisible();
  await page.getByRole('link', { name: 'Crear cuenta y continuar' }).click();

  await page.getByLabel('Nombre').fill('Usuario E2E');
  await page.getByLabel('Correo').fill(`e2e-${suffix}@example.test`);
  await page.getByLabel('Contraseña').fill('e2e-password-strong-123');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await page.getByLabel('Nombre de empresa').fill(firstOrganization);
  await page.getByLabel('Sector').fill('Manufactura');
  await page.getByRole('button', { name: 'Crear y activar demo' }).click();
  await expect(page.getByText(/Demostración conceptual activa/)).toBeVisible();
  await expect(page.getByRole('heading', { name: firstOrganization })).toBeVisible();
  await expect(page.getByText('DEMO').first()).toBeVisible();

  await page.getByRole('link', { name: 'Organizaciones' }).click();
  await page.getByLabel('Nombre de empresa').fill(secondOrganization);
  await page.getByRole('button', { name: 'Crear organización' }).click();
  await expect(page.getByText('Organización creada correctamente.')).toBeVisible();
  await page.getByLabel('Organización activa').selectOption({ label: firstOrganization });
  await expect(page.getByText(/Demostración conceptual activa/)).toBeVisible();
  await page.getByLabel('Organización activa').selectOption({ label: secondOrganization });
  await page.getByRole('link', { name: 'Módulos' }).click();
  await expect(page.getByText('NO INCLUIDO').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Solicitar mejora →' }).first()).toBeVisible();
});
