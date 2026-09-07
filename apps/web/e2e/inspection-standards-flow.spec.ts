import { expect, test, type Page } from '@playwright/test';
import { activateE2eUserSession, registerE2eUser } from './support/register-e2e-user';

async function provisionDemoSession(page: Page, suffix: number) {
  await page.goto('/diagnostico');
  await page.getByRole('button', { name: 'Comenzar' }).click();
  for (let step = 1; step <= 5; step += 1) {
    await expect(page.getByText(`Paso ${step} de 6`)).toBeVisible();
    if (step === 2) await page.getByLabel('Riesgo de incendio').check();
    if (step === 3) await page.getByLabel('Hallazgos recurrentes').check();
    await page.getByRole('button', { name: 'Guardar y continuar' }).click();
  }
  await expect(page.getByText('Paso 6 de 6')).toBeVisible();
  await page.getByRole('button', { name: 'Ver recomendación' }).click();
  const registrationHref = await page
    .getByRole('link', { name: 'Crear cuenta y continuar' })
    .getAttribute('href');
  const sessionId = registrationHref
    ? new URL(registrationHref, 'http://e2e.local').searchParams.get('sessionId')
    : null;
  if (!sessionId) throw new Error('E2E_DIAGNOSTIC_SESSION_ID_MISSING');
  const registration = await registerE2eUser({
    displayName: 'Responsable Estándares E2E',
    email: `inspection-standards-e2e-${suffix}@example.test`,
    password: 'inspection-standards-e2e-password-123',
  });
  expect(registration.statusCode, registration.body).toBe(201);
  await activateE2eUserSession(
    page,
    registration,
    `/app/organizations?sessionId=${encodeURIComponent(sessionId)}`,
  );
  await page.getByLabel('Nombre de empresa').fill(`Estándares SST ${suffix}`);
  await page.getByLabel('Sector').fill('Manufactura');
  await page.getByRole('button', { name: 'Crear y activar demo' }).click();
  await expect(page.getByText(/Demostración conceptual activa/)).toBeVisible();
}

async function saveElectricalPolicy(page: Page, standardLabel: string, reason: string) {
  await page.goto('/app/settings/inspection-standards');
  await expect(page.getByRole('heading', { name: 'Estándares de inspección' })).toBeVisible();
  const electricalCard = page
    .locator('.inspection-standard-domain-card')
    .filter({ hasText: 'Instalaciones eléctricas' });
  await electricalCard.getByRole('combobox').selectOption({ label: standardLabel });
  await page.getByLabel('Motivo del cambio (opcional)').fill(reason);
  const policyResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      new URL(response.url()).pathname === '/api/v1/inspection-standards/organization/policy',
  );
  await page.getByRole('button', { name: 'Guardar nueva versión' }).click();
  expect((await policyResponse).ok()).toBe(true);
  await expect(page.getByText('Nueva versión de política guardada.')).toBeVisible();
}

async function verifyInspectionStandardsAccessibility(page: Page) {
  for (const visualTheme of ['operativo', 'sereno', 'noche', 'contraste']) {
    await page.getByLabel('Tema visual').selectOption(visualTheme);
    await expect(page.locator('html')).toHaveAttribute('data-theme', visualTheme);
    await expect(page.getByRole('heading', { name: 'Estándares de inspección' })).toBeVisible();
  }

  for (const viewport of [
    { width: 320, height: 844 },
    { width: 640, height: 900 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
  }

  const electricalCard = page
    .locator('.inspection-standard-domain-card')
    .filter({ hasText: 'Instalaciones eléctricas' });
  await electricalCard.getByRole('combobox').focus();
  await expect(electricalCard.getByRole('combobox')).toBeFocused();
}

async function createElectricalInspection(page: Page, title: string) {
  await page.goto('/app/inspections/new');
  await page.getByLabel('Dominio de inspección').selectOption('ELECTRICAL');
  await page.getByLabel('Recurso a inspeccionar').selectOption({ label: 'Tomacorriente' });
  await page
    .getByLabel('Centro de trabajo')
    .selectOption({ label: 'Centro Guayaquil (demostración)' });
  await page.getByLabel('Área (opcional)').selectOption({ label: 'Planta A' });
  await page.getByLabel('Título').fill(title);
  await page.getByRole('radio', { name: /Matriz demostrativa 5×5 histórica/ }).check();
  await Promise.all([
    page.waitForURL(/\/app\/inspections\/[0-9a-f-]+$/),
    page.getByRole('button', { name: 'Crear inspección' }).click(),
  ]);
  return page.url();
}

test('política A→B, checklist directo y trazabilidad explícita del hallazgo', async ({ page }) => {
  test.setTimeout(180_000);
  const suffix = Date.now();
  await provisionDemoSession(page, suffix);

  await saveElectricalPolicy(
    page,
    'Demo Electrical Standard A · Versión demo 1',
    'Confirmación E2E del estándar sintético A',
  );
  await expect(page.getByText('DEMO_SYNTHETIC', { exact: true })).toHaveCount(0);
  await expect(page.getByText('ELECTRICAL', { exact: true })).toHaveCount(0);
  await verifyInspectionStandardsAccessibility(page);

  const inspectionATitle = `Inspección estándar A ${suffix}`;
  const inspectionAUrl = await createElectricalInspection(page, inspectionATitle);
  await expect(page.getByRole('heading', { name: 'Demo Electrical Standard A' })).toBeVisible();
  await expect(page.getByText('Metodología de valoración del riesgo')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Matriz demostrativa 5×5 histórica' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Iniciar inspección' }).click();
  await expect(page.getByText('En progreso').first()).toBeVisible();

  const criterionCard = page.locator('.inspection-criterion-card').filter({
    hasText: 'Los cerramientos de tableros permanecen completos y cerrados durante la operación.',
  });
  await criterionCard.getByLabel('Resultado observado').selectOption('NO_CONFORME');
  await criterionCard
    .getByLabel('Observación (obligatoria)')
    .fill('El cerramiento quedó abierto en el escenario sintético E2E.');
  await criterionCard
    .getByLabel('Referencias de evidencia (una por línea, opcional)')
    .fill('Fotografía sintética E2E-1');
  const criterionResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      /\/inspections\/[0-9a-f-]+\/criteria\/[0-9a-f-]+$/.test(response.url()),
  );
  await criterionCard.getByRole('button', { name: 'Guardar resultado' }).click();
  expect((await criterionResponse).ok()).toBe(true);
  await expect(criterionCard.locator('.criterion-outcome')).toHaveText('No conforme');
  await Promise.all([
    page.waitForURL(/\/app\/inspections\/[0-9a-f-]+\/findings\/new\?criterionResultId=/),
    criterionCard.getByRole('link', { name: 'Crear hallazgo' }).click(),
  ]);

  await expect(page.getByText(/Criterio no conforme: Los cerramientos de tableros/)).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Título').fill(`Hallazgo desde estándar A ${suffix}`);
  await page
    .getByLabel('Descripción')
    .fill('Hallazgo sintético creado por decisión explícita de la persona inspectora.');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Categoría del hallazgo').selectOption('ELECTRICAL');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('group', { name: 'Probabilidad' }).locator('input[value="2"]').check();
  await page.getByRole('group', { name: 'Consecuencia' }).locator('input[value="3"]').check();
  await page.getByRole('button', { name: 'Continuar' }).click();
  const findingResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      /\/inspections\/[0-9a-f-]+\/findings$/.test(response.url()),
  );
  await page.getByRole('button', { name: 'Guardar hallazgo' }).click();
  expect((await findingResponse).ok()).toBe(true);
  await expect(page.getByText(/Metodología utilizada: Matriz demostrativa 5×5/)).toBeVisible();

  await saveElectricalPolicy(
    page,
    'Demo Electrical Standard B · Versión demo 1',
    'Cambio E2E controlado al estándar sintético B',
  );
  const inspectionBUrl = await createElectricalInspection(page, `Inspección estándar B ${suffix}`);
  await expect(page.getByRole('heading', { name: 'Demo Electrical Standard B' })).toBeVisible();
  await expect(
    page.getByText(
      'El equipo observado dispone de una referencia interna para su aislamiento operativo.',
    ),
  ).toBeVisible();
  await expect(
    page.getByText(
      'Los cerramientos de tableros permanecen completos y cerrados durante la operación.',
    ),
  ).toHaveCount(0);
  expect(inspectionBUrl).not.toBe(inspectionAUrl);

  await page.goto(inspectionAUrl);
  await expect(page.getByRole('heading', { name: inspectionATitle })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Demo Electrical Standard A' })).toBeVisible();
  await expect(
    page.getByText(
      'Los cerramientos de tableros permanecen completos y cerrados durante la operación.',
    ),
  ).toBeVisible();
});
