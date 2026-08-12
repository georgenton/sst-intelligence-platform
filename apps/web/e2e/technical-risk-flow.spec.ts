import { expect, test } from '@playwright/test';

test('método técnico demo, cálculo crítico y revisión profesional', async ({ page }) => {
  const suffix = Date.now();

  await page.goto('/diagnostico');
  await page.getByRole('button', { name: 'Comenzar' }).click();
  await expect(page.getByText('Paso 1 de 6')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar y continuar' }).click();
  await expect(page.getByText('Paso 2 de 6')).toBeVisible();
  await page.getByLabel('Riesgo de incendio').check();
  await page.getByRole('button', { name: 'Guardar y continuar' }).click();
  await expect(page.getByText('Paso 3 de 6')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar y continuar' }).click();
  await expect(page.getByText('Paso 4 de 6')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar y continuar' }).click();
  await expect(page.getByText('Paso 5 de 6')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar y continuar' }).click();
  await expect(page.getByText('Paso 6 de 6')).toBeVisible();
  await page.getByRole('button', { name: 'Ver recomendación' }).click();
  await page.getByRole('link', { name: 'Crear cuenta y continuar' }).click();
  await page.getByLabel('Nombre').fill('Responsable Riesgo Técnico E2E');
  await page.getByLabel('Correo').fill(`technical-risk-e2e-${suffix}@example.test`);
  await page.getByLabel('Contraseña').fill('technical-risk-e2e-password-123');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await page.getByLabel('Nombre de empresa').fill(`Riesgo Técnico Demo ${suffix}`);
  await page.getByLabel('Sector').fill('Manufactura');
  await page.getByRole('button', { name: 'Crear y activar demo' }).click();
  await expect(page.getByText(/Demostración conceptual activa/)).toBeVisible();

  await page.getByRole('link', { name: 'Riesgo técnico', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Evaluaciones técnicas' })).toBeVisible();
  await page.getByRole('link', { name: 'Nueva evaluación' }).click();
  await page
    .getByLabel('Método técnico')
    .selectOption({ label: 'Evaluación técnica demostrativa · v1.0.0' });
  await expect(page.getByText('No constituye una evaluación regulatoria validada.')).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();

  await page
    .getByLabel('Centro de trabajo')
    .selectOption({ label: 'Centro Guayaquil (demostración)' });
  await page.getByLabel('Área (opcional)').selectOption({ label: 'Planta A' });
  await page.getByLabel('Título').fill(`Evaluación técnica crítica ${suffix}`);
  await page.getByRole('button', { name: 'Continuar' }).click();

  await page.getByLabel('Descripción de la actividad').fill('Actividad sintética para E2E.');
  await page.getByLabel('Controles existentes (opcional)').fill('Control sintético existente.');
  await page.getByRole('button', { name: 'Continuar' }).click();

  await page.getByLabel('Probabilidad').selectOption('4');
  await page.getByLabel('Consecuencia').selectOption('5');
  await page.getByLabel('Nota de evidencia').fill('Evidencia sintética E2E.');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(
    page.getByText('El resultado será calculado por el sistema según la versión seleccionada.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Calcular resultado' }).click();

  await expect(
    page.getByRole('heading', { name: `Evaluación técnica crítica ${suffix}` }),
  ).toBeVisible();
  await expect(page.getByText('20', { exact: true })).toBeVisible();
  await expect(page.getByText('Crítico', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Revisar evaluación' }).click();
  await expect(page.getByRole('heading', { name: 'Revisión profesional' })).toBeVisible();
  await expect(page.getByText('Evidencia sintética E2E.')).toBeVisible();
  await page.getByLabel('Comentario (opcional)').fill('Revisión profesional E2E.');
  await page.getByRole('button', { name: 'Aprobar revisión' }).click();
  await expect(page.getByText('Revisada').first()).toBeVisible();
  await expect(page.getByText('Revisada por usuario autorizado')).toBeVisible();
});
