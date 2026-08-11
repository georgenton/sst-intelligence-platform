import { expect, test } from '@playwright/test';

test('inspección, hallazgo, acción, verificación y recurrencia demo', async ({ page }) => {
  const suffix = Date.now();
  const organizationName = `Inspecciones Demo ${suffix}`;

  await page.goto('/diagnostico');
  await page.getByRole('button', { name: 'Comenzar' }).click();
  await expect(page.getByText('Paso 1 de 6')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar y continuar' }).click();
  await expect(page.getByText('Paso 2 de 6')).toBeVisible();
  await page.getByLabel('Riesgo de incendio').check();
  await page.getByRole('button', { name: 'Guardar y continuar' }).click();
  await expect(page.getByText('Paso 3 de 6')).toBeVisible();
  await page.getByLabel('Hallazgos recurrentes').check();
  await page.getByRole('button', { name: 'Guardar y continuar' }).click();
  await expect(page.getByText('Paso 4 de 6')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar y continuar' }).click();
  await expect(page.getByText('Paso 5 de 6')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar y continuar' }).click();
  await expect(page.getByText('Paso 6 de 6')).toBeVisible();
  await page.getByRole('button', { name: 'Ver recomendación' }).click();
  await page.getByRole('link', { name: 'Crear cuenta y continuar' }).click();
  await page.getByLabel('Nombre').fill('Técnico Inspecciones E2E');
  await page.getByLabel('Correo').fill(`inspections-e2e-${suffix}@example.test`);
  await page.getByLabel('Contraseña').fill('inspections-e2e-password-123');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await page.getByLabel('Nombre de empresa').fill(organizationName);
  await page.getByLabel('Sector').fill('Manufactura');
  await page.getByRole('button', { name: 'Crear y activar demo' }).click();
  await expect(page.getByText(/Demostración conceptual activa/)).toBeVisible();

  await page.getByRole('link', { name: 'Inspecciones' }).click();
  await expect(page.getByRole('heading', { name: 'Operación en campo' })).toBeVisible();
  await page.getByRole('link', { name: 'Nueva inspección' }).click();
  await page
    .getByLabel('Centro de trabajo')
    .selectOption({ label: 'Centro Guayaquil (demostración)' });
  await page.getByLabel('Área (opcional)').selectOption({ label: 'Planta A' });
  await page.getByLabel('Título').fill(`Inspección de campo ${suffix}`);
  await page.getByLabel('Descripción').fill('Recorrido operacional E2E.');
  await page.getByRole('button', { name: 'Crear inspección' }).click();
  await expect(page.getByRole('heading', { name: `Inspección de campo ${suffix}` })).toBeVisible();
  await page.getByRole('button', { name: 'Iniciar inspección' }).click();
  await expect(page.getByText('En progreso').first()).toBeVisible();
  await page.getByRole('link', { name: 'Registrar hallazgo' }).click();

  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Título').fill(`Conductor expuesto ${suffix}`);
  await page.getByLabel('Descripción').fill('Conductor sintético identificado durante E2E.');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Categoría del hallazgo').selectOption('ELECTRICAL');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Probabilidad').selectOption('4');
  await page.getByLabel('Consecuencia').selectOption('5');
  await expect(page.getByLabel('Probabilidad')).toHaveValue('4');
  await expect(page.getByLabel('Consecuencia')).toHaveValue('5');
  await page.getByRole('button', { name: 'Registrar hallazgo' }).click({ force: true });
  await expect(page.getByText('Resultado: 20 · Crítico')).toBeVisible();
  await page.getByRole('button', { name: 'Sí, crear acción' }).click();

  await page.getByRole('button', { name: 'Nueva acción' }).click();
  await page.getByLabel('Acción').fill('Aislar conductor y verificar protección');
  await page.getByLabel('Responsable').selectOption({ label: 'Técnico Inspecciones E2E' });
  await page.getByLabel('Prioridad').selectOption('URGENT');
  await page.getByRole('button', { name: 'Guardar acción' }).click();
  await page.getByRole('button', { name: 'Marcar terminada' }).click();
  await expect(page.getByText('Pendiente de verificación').first()).toBeVisible();
  await page.getByRole('button', { name: 'Verificar corrección' }).click();
  await page.getByLabel('Probabilidad residual').selectOption('1');
  await page.getByLabel('Consecuencia residual').selectOption('1');
  await page.getByRole('button', { name: 'Confirmar verificación' }).click();
  await expect(page.getByText('Cerrado').first()).toBeVisible();
  await expect(page.getByText('Riesgo Bajo')).toBeVisible();

  await page.goto('/app/inspections/alerts');
  await expect(
    page.getByText('Este aviso indica recurrencia, no confirma una causa raíz.').first(),
  ).toBeVisible();
});
