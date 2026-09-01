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
    displayName: 'Profesional Metodologías E2E',
    email: `risk-methods-e2e-${suffix}@example.test`,
    password: 'risk-methods-e2e-password-123',
  });
  expect(registration.statusCode, registration.body).toBe(201);
  await activateE2eUserSession(
    page,
    registration,
    `/app/organizations?sessionId=${encodeURIComponent(sessionId)}`,
  );
  await page.getByLabel('Nombre de empresa').fill(`Métodos SST ${suffix}`);
  await page.getByLabel('Sector').fill('Manufactura');
  await page.getByRole('button', { name: 'Crear y activar demo' }).click();
  await expect(page.getByText(/Demostración conceptual activa/)).toBeVisible();
}

async function createAndStartInspection(page: Page, title: string, methodName: RegExp) {
  await page.goto('/app/inspections/new');
  await page.getByLabel('Dominio de inspección').selectOption('ELECTRICAL');
  await page
    .getByLabel('Centro de trabajo')
    .selectOption({ label: 'Centro Guayaquil (demostración)' });
  await page.getByLabel('Área (opcional)').selectOption({ label: 'Planta A' });
  await page.getByLabel('Título').fill(title);
  await page.getByRole('radio', { name: methodName }).check();
  await Promise.all([
    page.waitForURL(/\/app\/inspections\/[0-9a-f-]+$/),
    page.getByRole('button', { name: 'Crear inspección' }).click(),
  ]);
  await page.getByRole('button', { name: 'Iniciar inspección' }).click();
  await expect(page.getByText('En progreso').first()).toBeVisible();
  await page.getByRole('link', { name: 'Registrar hallazgo' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
}

async function fillFindingIdentity(page: Page, title: string) {
  await page.getByLabel('Título').fill(title);
  await page.getByLabel('Descripción').fill('Hallazgo sintético para validar el método elegido.');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Categoría del hallazgo').selectOption('ELECTRICAL');
  await page.getByRole('button', { name: 'Continuar' }).click();
}

async function saveFinding(page: Page, assertReview?: () => Promise<void>) {
  await page.getByRole('button', { name: 'Continuar' }).click();
  await assertReview?.();
  const response = page.waitForResponse(
    (candidate) =>
      candidate.request().method() === 'POST' &&
      /\/inspections\/[0-9a-f-]+\/findings$/.test(candidate.url()),
  );
  await page.getByRole('button', { name: 'Guardar hallazgo' }).click();
  expect((await response).ok()).toBe(true);
  await expect(page.getByText('Resultado calculado automáticamente')).toBeVisible();
}

test('multi-method runtime, exact residual binding and read-only library', async ({ page }) => {
  test.setTimeout(180_000);
  const suffix = Date.now();
  await provisionDemoSession(page, suffix);

  await page.goto('/app/risk-methods');
  await expect(page.getByRole('heading', { name: 'Metodologías de evaluación' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Matriz demostrativa 5×5 histórica' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Matriz 5×5 guiada' })).toBeVisible();
  const gtcCard = page.locator('.risk-method-library-card').filter({ hasText: 'GTC 45' });
  await expect(gtcCard.getByText('Fuente técnica')).toBeVisible();
  await expect(gtcCard.getByText('Contexto regulatorio')).toBeVisible();
  await expect(
    gtcCard.getByText(/no demuestra que Ecuador haya adoptado o exigido GTC45/),
  ).toBeVisible();
  await expect(page.getByText('Normativa obligatoria Ecuador')).toHaveCount(0);

  await createAndStartInspection(page, `Inspección guiada ${suffix}`, /Matriz 5×5 guiada/);
  await fillFindingIdentity(page, `Hallazgo guiado ${suffix}`);
  await page.getByRole('radio', { name: /Probable/ }).check();
  await page.getByText('¿Por qué elegir este nivel? Ver señales de decisión').click();
  await page.getByLabel('La exposición es frecuente.').check();
  await page.getByRole('radio', { name: /Catastrófica/ }).check();
  await page.getByText('¿Por qué elegir esta severidad? Ver señales').click();
  await page.getByLabel('La peor consecuencia incluye fatalidad.').check();
  await page
    .getByLabel('Justificación profesional')
    .fill('La exposición frecuente y la consecuencia humana justifican la selección.');
  await saveFinding(page);
  await expect(page.getByText(/Metodología utilizada: Matriz 5×5 guiada/)).toBeVisible();
  await expect(page.getByText('Crítico').first()).toBeVisible();

  await Promise.all([
    page.waitForURL(/\/app\/inspections\/[0-9a-f-]+\/findings\/[0-9a-f-]+$/),
    page.getByRole('button', { name: 'Crear acción correctiva' }).click(),
  ]);
  await page.getByRole('button', { name: 'Crear acción correctiva' }).click();
  const actionDialog = page.getByRole('dialog', { name: 'Crear acción correctiva' });
  await actionDialog.getByRole('textbox', { name: 'Acción' }).fill('Instalar barrera verificable');
  await actionDialog.getByRole('button', { name: 'Guardar acción' }).click();
  await page.getByRole('button', { name: 'Iniciar acción' }).click();
  await page.getByRole('button', { name: 'Enviar a verificación' }).click();
  await page.getByRole('button', { name: 'Añadir evidencia' }).click();
  await page
    .getByLabel('Nota')
    .fill('Barrera instalada y observada en campo durante el recorrido.');
  await page.getByRole('button', { name: 'Guardar evidencia' }).click();
  await page.getByRole('button', { name: 'Verificar riesgo residual' }).click();
  const verifyDialog = page.getByRole('dialog', { name: 'Verificar riesgo residual' });
  await verifyDialog.getByLabel('Probabilidad residual').selectOption('1');
  await verifyDialog.getByLabel('Severidad humana residual').selectOption('2');
  await verifyDialog
    .getByLabel('Justificación profesional posterior')
    .fill('La barrera posterior reduce la exposición y la consecuencia razonable.');
  await verifyDialog.getByLabel('Base de verificación').selectOption('RECORDED_EVIDENCE');
  const verification = page.waitForResponse(
    (candidate) =>
      candidate.request().method() === 'POST' &&
      /\/findings\/[0-9a-f-]+\/verify$/.test(candidate.url()),
  );
  await verifyDialog.getByRole('button', { name: 'Verificar riesgo residual' }).click();
  expect((await verification).ok()).toBe(true);
  await expect(page.getByText('Cerrado').first()).toBeVisible();
  await expect(page.getByText('Matriz 5×5 guiada').first()).toBeVisible();

  await createAndStartInspection(page, `Inspección GTC45 ${suffix}`, /GTC 45 — edición 2010/);
  await fillFindingIdentity(page, `Hallazgo GTC45 ${suffix}`);
  await page.getByLabel('Nivel de deficiencia').selectOption('HIGH');
  await page.getByLabel('Nivel de exposición').selectOption('4');
  await page.getByLabel('Control en la fuente').fill('Resguardo parcial observado.');
  await page.getByText('¿Por qué? Abrir guía experta candidata').click();
  await page
    .getByLabel('¿Qué evidencia observaste sobre efectividad de controles?')
    .fill('Cobertura parcial documentada en campo.');
  await page.getByLabel('Nivel de consecuencia').selectOption('100');
  await page
    .getByLabel('Justificación profesional')
    .fill('La deficiencia alta, exposición continua y consecuencia mortal sustentan la selección.');
  await saveFinding(page, async () => {
    await expect(
      page.getByText('Deficiencia Alto · Exposición Continua · Consecuencia Mortal o catastrófica'),
    ).toBeVisible();
    await expect(page.getByText('HIGH', { exact: true })).toHaveCount(0);
  });
  await expect(page.getByText('Nivel de intervención I').first()).toBeVisible();
  await expect(page.getByText(/Metodología utilizada: GTC 45/)).toBeVisible();

  await createAndStartInspection(
    page,
    `Inspección histórica ${suffix}`,
    /Matriz demostrativa 5×5 histórica/,
  );
  await fillFindingIdentity(page, `Hallazgo histórico ${suffix}`);
  await page.getByRole('group', { name: 'Probabilidad' }).locator('input[value="2"]').check();
  await page.getByRole('group', { name: 'Consecuencia' }).locator('input[value="3"]').check();
  await saveFinding(page);
  await expect(page.getByText('Probabilidad 2 × consecuencia 3')).toBeVisible();
  await expect(page.getByText(/Metodología utilizada: Matriz demostrativa 5×5/)).toBeVisible();
});
