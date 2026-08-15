import { expect, test } from '@playwright/test';

test('borrador, ejecución, resultado y revisión profesional de riesgo técnico', async ({ page }) => {
  test.setTimeout(90_000);
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
  await expect(page.getByRole('heading', { name: 'Riesgo técnico', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Nueva evaluación técnica' }).click();
  await page
    .getByLabel('Método técnico')
    .selectOption({ label: 'Evaluación técnica demostrativa · v1.0.0' });
  await expect(page.getByText(/No constituye una evaluación regulatoria validada/)).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();

  await page
    .getByLabel('Centro de trabajo')
    .selectOption({ label: 'Centro Guayaquil (demostración)' });
  await page.getByLabel('Área').selectOption({ label: 'Planta A' });
  await page.getByLabel('Título').fill(`Evaluación técnica crítica ${suffix}`);
  await page.getByLabel('Descripción · opcional').fill('Actividad sintética para E2E.');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('heading', { name: 'Confirma el borrador' })).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/app\/technical-risk\/[0-9a-f-]+$/),
    page.getByRole('button', { name: 'Crear borrador' }).click(),
  ]);

  await expect(page.getByText(/Borrador/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Iniciar evaluación' }).click();
  await expect(page.getByText(/En curso/).first()).toBeVisible();
  await page.getByLabel('Descripción de la actividad').fill('Actividad sintética para E2E.');
  await page.getByLabel(/Controles existentes/).fill('Control sintético existente.');
  await page.getByRole('group', { name: 'Probabilidad' }).getByRole('radio', { name: '4' }).check();
  await page.getByRole('group', { name: 'Consecuencia' }).getByRole('radio', { name: /5 Mayor/ }).check();

  await page.getByLabel('Nota').fill('Evidencia sintética E2E.');
  await page.getByRole('button', { name: 'Guardar evidencia' }).click();
  await expect(page.getByText('Evidencia guardada. La evaluación permanece En curso.')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar respuestas' }).click();
  await expect(page.getByText('Respuestas guardadas. La evaluación permanece En curso.')).toBeVisible();
  await page.getByRole('button', { name: 'Completar evaluación' }).click();

  const result = page.getByRole('region', { name: 'Resultado técnico' });
  await expect(result.getByRole('heading', { name: 'Resultado técnico' })).toBeVisible();
  await expect(result.getByText('20', { exact: true }).first()).toBeVisible();
  await expect(result.getByText('Crítico', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Revisión pendiente', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Abrir revisión profesional' }).click();
  await expect(page).toHaveURL(/\/app\/technical-risk\/[0-9a-f-]+\/review$/);
  await expect(page.getByRole('heading', { name: 'Revisión profesional' })).toBeVisible();
  await expect(page.getByText('Evidencia sintética E2E.')).toBeVisible();
  await page.getByLabel('Solicitar cambios').check();
  await page.getByLabel('Comentario').fill('Ajustar el contexto antes de aprobar.');
  await page.getByRole('button', { name: 'Registrar decisión' }).click();
  const revisionDialog = page.getByRole('dialog', { name: 'Confirmar solicitud de cambios' });
  await expect(revisionDialog).toBeVisible();
  await revisionDialog.getByRole('button', { name: 'Registrar decisión' }).click();
  await expect(page.getByText('La evaluación permanece Completada.')).toBeVisible();
  await expect(page.getByText(/Completada/).first()).toBeVisible();

  await page.getByLabel('Aprobar revisión').check();
  await page.getByLabel(/Comentario/).fill('Revisión profesional E2E.');
  await page.getByRole('button', { name: 'Registrar decisión' }).click();
  const approvalDialog = page.getByRole('dialog', { name: 'Confirmar aprobación profesional' });
  await expect(approvalDialog).toBeVisible();
  await approvalDialog.getByRole('button', { name: 'Registrar decisión' }).click();
  await expect(page.getByText(/La evaluación ahora está Revisada/)).toBeVisible();
  await expect(page.getByText(/Revisada/).first()).toBeVisible();
  await expect(
    page.getByLabel('Historial de revisión').first().getByText('Revisión profesional E2E.'),
  ).toBeVisible();
});
