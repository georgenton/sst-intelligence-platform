import { expect, test } from '@playwright/test';
import { activateE2eUserSession, registerE2eUser } from './support/register-e2e-user';

test('borrador, ejecución, resultado y revisión profesional de riesgo técnico', async ({
  page,
}) => {
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
  const registrationHref = await page
    .getByRole('link', { name: 'Crear cuenta y continuar' })
    .getAttribute('href');
  const sessionId = registrationHref
    ? new URL(registrationHref, 'http://e2e.local').searchParams.get('sessionId')
    : null;
  if (!sessionId) throw new Error('E2E_DIAGNOSTIC_SESSION_ID_MISSING');

  const email = `technical-risk-e2e-${suffix}@example.test`;
  const password = 'technical-risk-e2e-password-123';
  const registration = await registerE2eUser({
    displayName: 'Responsable Riesgo Técnico E2E',
    email,
    password,
  });
  expect(registration.statusCode, registration.body).toBe(201);

  await activateE2eUserSession(
    page,
    registration,
    `/app/organizations?sessionId=${encodeURIComponent(sessionId)}`,
  );
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
  await page
    .getByLabel('Metodología de valoración del riesgo')
    .selectOption({ label: 'Matriz 5×5 guiada · v1.0.0' });
  await expect(page.getByText(/No constituye una evaluación regulatoria validada/)).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();

  await page
    .getByLabel('Centro de trabajo')
    .selectOption({ label: 'Centro Guayaquil (demostración)' });
  await page.getByLabel('Área').selectOption({ label: 'Planta A' });
  await page.getByLabel('Título').fill(`Evaluación técnica crítica ${suffix}`);
  await page.getByLabel('Descripción · opcional').fill('Actividad sintética para E2E.');
  await page
    .getByRole('combobox', { name: 'Probabilidad', exact: true })
    .selectOption({ label: 'Probable · 4' });
  await page
    .getByRole('combobox', { name: 'Severidad humana' })
    .selectOption({ label: 'Catastrófica · 5' });
  await page
    .getByLabel('Justificación profesional')
    .fill('Exposición frecuente y consecuencia humana potencialmente fatal.');
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
  await page
    .getByRole('group', { name: 'Consecuencia' })
    .getByRole('radio', { name: /5 Mayor/ })
    .check();

  await page.getByLabel('Nota').fill('Evidencia sintética E2E.');
  await page.getByRole('button', { name: 'Guardar evidencia' }).click();
  await expect(
    page.getByText('Evidencia guardada. La evaluación permanece En curso.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Guardar respuestas' }).click();
  await expect(
    page.getByText('Respuestas guardadas. La evaluación permanece En curso.'),
  ).toBeVisible();
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
  await page.getByRole('link', { name: 'Volver al resultado' }).click();
  await expect(page.getByRole('heading', { name: 'Requiere ajustes' })).toBeVisible();
  await page.getByRole('button', { name: 'Atender ajustes' }).click();
  await expect(page.getByRole('heading', { name: 'Cambios solicitados' })).toBeVisible();
  await expect(page.getByText('Ajustar el contexto antes de aprobar.')).toBeVisible();
  await page.getByRole('button', { name: 'Iniciar evaluación' }).click();
  await page.getByRole('group', { name: 'Probabilidad' }).getByRole('radio', { name: '3' }).check();
  await page.getByRole('button', { name: 'Completar evaluación' }).click();
  await page.getByRole('link', { name: 'Abrir revisión profesional' }).click();
  await page.getByLabel('Aprobar revisión').check();
  await page.getByLabel(/Comentario/).fill('Revisión profesional E2E.');
  await page.getByLabel('Confirmo esta autorrevisión y su trazabilidad.').check();
  await page.getByRole('button', { name: 'Registrar decisión' }).click();
  const approvalDialog = page.getByRole('dialog', { name: 'Confirmar aprobación profesional' });
  await expect(approvalDialog).toBeVisible();
  await approvalDialog.getByRole('button', { name: 'Registrar decisión' }).click();
  await expect(page.getByText(/La evaluación ahora está Revisada/)).toBeVisible();
  await expect(page.getByText(/Revisada/).first()).toBeVisible();
  await expect(
    page.getByLabel('Historial de revisión').first().getByText('Revisión profesional E2E.'),
  ).toBeVisible();

  await page.goto('/app/technical-risk/new');
  await page
    .getByLabel('Método técnico')
    .selectOption({ label: 'Evaluación técnica demostrativa · v1.0.0' });
  await page
    .getByLabel('Metodología de valoración del riesgo')
    .selectOption({ label: 'GTC 45 — edición 2010 · v1.0.0' });
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page
    .getByLabel('Centro de trabajo')
    .selectOption({ label: 'Centro Guayaquil (demostración)' });
  await page.getByLabel('Área').selectOption({ label: 'Planta A' });
  await page.getByLabel('Título').fill(`Evaluación técnica GTC45 ${suffix}`);
  await page.getByLabel('Nivel de deficiencia').selectOption('HIGH');
  await page.getByLabel('Nivel de exposición').selectOption('4');
  await page.getByLabel('Nivel de consecuencia').selectOption('100');
  await page
    .getByLabel('Justificación profesional')
    .fill('Deficiencia alta, exposición continua y consecuencia potencialmente mortal.');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await Promise.all([
    page.waitForURL(/\/app\/technical-risk\/[0-9a-f-]+$/),
    page.getByRole('button', { name: 'Crear borrador' }).click(),
  ]);
  await page.getByRole('button', { name: 'Iniciar evaluación' }).click();
  await page.getByLabel('Descripción de la actividad').fill('Actividad GTC45 sintética E2E.');
  await page.getByLabel(/Controles existentes/).fill('Control parcial observado.');
  await page.getByRole('group', { name: 'Probabilidad' }).getByRole('radio', { name: '3' }).check();
  await page
    .getByRole('group', { name: 'Consecuencia' })
    .getByRole('radio', { name: '4', exact: true })
    .check();
  await page.getByRole('button', { name: 'Completar evaluación' }).click();
  await expect(page.getByRole('heading', { name: 'GTC 45 — edición 2010' })).toBeVisible();
  await expect(page.getByText('I · 2400')).toBeVisible();
  await page.getByRole('link', { name: 'Abrir revisión profesional' }).click();
  await page.getByLabel('Aprobar revisión').check();
  await page.getByLabel(/Comentario/).fill('Revisión profesional GTC45 E2E.');
  await page.getByLabel('Confirmo esta autorrevisión y su trazabilidad.').check();
  await page.getByRole('button', { name: 'Registrar decisión' }).click();
  await page
    .getByRole('dialog', { name: 'Confirmar aprobación profesional' })
    .getByRole('button', { name: 'Registrar decisión' })
    .click();
  await expect(page.getByText(/La evaluación ahora está Revisada/)).toBeVisible();
});
