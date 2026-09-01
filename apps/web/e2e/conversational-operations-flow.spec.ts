import { expect, test, type Page } from '@playwright/test';
import { activateE2eUserSession, registerE2eUser } from './support/register-e2e-user';

async function prepareDemoRegistration(page: Page) {
  await page.goto('/diagnostico');
  await page.getByRole('button', { name: 'Comenzar' }).click();
  for (const step of [1, 2, 3, 4, 5]) {
    await expect(page.getByText(`Paso ${step} de 6`)).toBeVisible();
    if (step === 2) await page.getByLabel('Riesgo de incendio').check();
    if (step === 3) await page.getByLabel('Hallazgos recurrentes').check();
    await page.getByRole('button', { name: 'Guardar y continuar' }).click();
  }
  await expect(page.getByText('Paso 6 de 6')).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/diagnostico\/[0-9a-f-]+\/resultado$/),
    page.getByRole('button', { name: 'Ver recomendación' }).click(),
  ]);
  const href = await page
    .getByRole('link', { name: 'Crear cuenta y continuar' })
    .getAttribute('href');
  const sessionId = href ? new URL(href, 'http://e2e.local').searchParams.get('sessionId') : null;
  if (!sessionId) throw new Error('E2E_DIAGNOSTIC_SESSION_ID_MISSING');
  return sessionId;
}

async function confirmLatestAction(page: Page) {
  const card = page.locator('.conversation-confirmation-card').last();
  await expect(card.getByText('El dominio todavía no ha recibido ningún cambio.')).toBeVisible();
  await card.getByRole('button', { name: 'Confirmar acción' }).click();
  await expect(
    page.getByText('La decisión fue procesada por el servicio de dominio.'),
  ).toBeVisible();
  await expect(card).toHaveCount(0);
}

test('opera una inspección con base multifuente, citas y confirmaciones explícitas', async ({
  page,
}) => {
  const suffix = Date.now();
  const sessionId = await prepareDemoRegistration(page);
  const registration = await registerE2eUser({
    displayName: 'Owner Conversacional E2E',
    email: `conversation-owner-${suffix}@example.test`,
    password: 'conversation-e2e-password-strong-123',
  });
  expect(registration.statusCode, registration.body).toBe(201);
  await activateE2eUserSession(
    page,
    registration,
    `/app/organizations?sessionId=${encodeURIComponent(sessionId)}`,
  );
  await page.getByLabel('Nombre de empresa').fill(`Organización Conversacional ${suffix}`);
  await page.getByLabel('Sector').fill('Operación eléctrica sintética');
  await page.getByRole('button', { name: 'Crear y activar demo' }).click();
  await expect(page.getByText(/Demostración conceptual activa/)).toBeVisible();

  await page.getByRole('link', { name: 'Bases de inspección' }).click();
  await expect(page.getByRole('heading', { name: 'Bases de inspección' })).toBeVisible();
  await page.getByLabel('Nombre de la base').fill(`Base eléctrica multifuente ${suffix}`);
  const primarySelect = page.getByLabel('Base técnica principal');
  const retieValue = await primarySelect
    .locator('option')
    .filter({ hasText: 'RETIE' })
    .getAttribute('value');
  if (!retieValue) throw new Error('E2E_RETIE_OPTION_MISSING');
  await primarySelect.selectOption(retieValue);
  await page
    .getByRole('group', { name: 'Fuentes técnicas suplementarias' })
    .getByLabel(/REBT/)
    .check();
  await page.getByLabel('Razón de configuración').fill('Piloto técnico E2E pendiente de revisión.');
  await page.getByRole('button', { name: 'Crear y activar versión' }).click();
  await expect(
    page.getByText('Base de inspección activada; las versiones históricas permanecen inmutables.'),
  ).toBeVisible();

  await page.getByRole('link', { name: 'Preguntar / Operar' }).click();
  await expect(page.getByRole('heading', { name: 'Preguntar / Operar' })).toBeVisible();
  await page.getByRole('button', { name: '¿Qué tengo pendiente?' }).click();
  await expect(
    page.getByText(/No encontré elementos pendientes|Encontré .* elementos/),
  ).toBeVisible();
  await expect(page.getByText('Proveedor: determinístico / sin IA externa')).toBeVisible();

  const guided = page.getByRole('complementary', { name: 'Operación guiada' });
  await expect(guided.getByText(`Base eléctrica multifuente ${suffix}`)).toBeVisible();
  await expect(guided.getByText(/RETIE/)).toBeVisible();
  await expect(guided.getByText(/REBT/)).toBeVisible();
  await expect(guided.getByText(/Jurisdicción: CO|Jurisdicción: Colombia/)).toBeVisible();
  await guided.getByLabel('Centro de trabajo').selectOption({ index: 1 });
  const riskMethodSelect = guided.getByLabel('Metodología de riesgo');
  const demoMethodValue = await riskMethodSelect
    .locator('option')
    .filter({ hasText: 'Matriz demostrativa' })
    .getAttribute('value');
  if (!demoMethodValue) throw new Error('E2E_DEMO_RISK_METHOD_MISSING');
  await riskMethodSelect.selectOption(demoMethodValue);
  const inspectionTitle = `Inspección conversacional ${suffix}`;
  await guided.getByLabel('Título').fill(inspectionTitle);
  await guided.getByRole('button', { name: 'Preparar creación' }).click();
  await confirmLatestAction(page);
  await expect(guided.getByRole('heading', { name: inspectionTitle })).toBeVisible();

  await guided.getByRole('button', { name: 'Preparar inicio' }).click();
  await confirmLatestAction(page);
  await expect(guided.getByText('Criterio 1 de 4')).toBeVisible();
  await guided.getByRole('button', { name: '¿Por qué este criterio?' }).click();
  await expect(
    page.getByText('Esta explicación usa únicamente las relaciones de procedencia almacenadas.'),
  ).toBeVisible();
  await expect(
    page.locator('.conversation-citation').filter({ hasText: /RETIE/ }).first(),
  ).toBeVisible();

  await guided.getByRole('button', { name: 'No conforme' }).click();
  await confirmLatestAction(page);
  await expect(guided.getByText('NO CONFORME', { exact: true })).toBeVisible();

  await guided
    .getByLabel('Referencia de evidencia')
    .fill(`evidence://inspection/${suffix}/criterion-1`);
  await guided.getByRole('button', { name: 'Preparar vínculo' }).click();
  await confirmLatestAction(page);
  await expect(page.getByText(/Evidencia vinculada:/).last()).toContainText(`criterion-1`);

  const findingForm = guided.locator('.conversation-finding-form');
  await findingForm.getByLabel('Descripción').fill('Condición eléctrica sintética observada.');
  await findingForm.getByLabel('Probabilidad').selectOption('4');
  await findingForm.getByLabel('Consecuencia').selectOption('5');
  await findingForm.getByRole('button', { name: 'Preparar hallazgo' }).click();
  await confirmLatestAction(page);
  await expect(guided.getByText('Hallazgo canónico')).toBeVisible();

  const actionTitle = `Corregir condición ${suffix}`;
  await guided
    .getByRole('heading', { name: 'Crear y asignar acción' })
    .locator('..')
    .getByLabel('Título')
    .fill(actionTitle);
  const assigneeSelect = guided.getByLabel('Responsable');
  const ownerValue = await assigneeSelect
    .locator('option')
    .filter({ hasText: 'Owner Conversacional E2E' })
    .getAttribute('value');
  if (!ownerValue) throw new Error('E2E_OWNER_ASSIGNEE_MISSING');
  await assigneeSelect.selectOption(ownerValue);
  await guided.getByLabel('Prioridad').selectOption('HIGH');
  await guided.getByRole('button', { name: 'Preparar acción' }).click();
  await confirmLatestAction(page);
  await expect(page.getByText(new RegExp(`Acción ${actionTitle} creada`))).toBeVisible();

  await page.getByRole('button', { name: '¿Qué tengo pendiente?' }).click();
  const queueItem = page.locator('.conversation-work-item').filter({ hasText: actionTitle });
  await expect(queueItem).toBeVisible();
  await expect(queueItem.getByText('HIGH')).toBeVisible();
  await expect(queueItem.getByText('Owner Conversacional E2E')).toBeVisible();
  await queueItem.getByRole('button', { name: '¿Por qué está pendiente?' }).click();
  await expect(page.getByText(new RegExp(`${actionTitle}:`))).toBeVisible();

  for (const width of [320, 640]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
});
