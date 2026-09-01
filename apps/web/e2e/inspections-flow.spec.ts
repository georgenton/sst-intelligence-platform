import { expect, test } from '@playwright/test';
import { appearanceFocusStorageKey, appearanceSessionUserKey } from '../lib/appearance';

test('inspección, hallazgo, acción, verificación y recurrencia demo', async ({ page }) => {
  test.setTimeout(90_000);
  const suffix = Date.now();
  const organizationName = `Inspecciones Demo ${suffix}`;

  await page.addInitScript(() => {
    const realNow = Date.now.bind(Date);
    Object.defineProperty(window, '__e2eClockOffsetMs', { value: 0, writable: true });
    Date.now = () =>
      realNow() +
      ((window as typeof window & { __e2eClockOffsetMs: number }).__e2eClockOffsetMs ?? 0);
  });

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

  await page.getByRole('link', { name: 'Inspecciones', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Inspecciones', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Nueva inspección' }).click();
  await page.getByLabel('Dominio de inspección').selectOption('ELECTRICAL');
  await expect(page.getByRole('heading', { name: 'Demo Electrical Standard A' })).toBeVisible();
  await page
    .getByLabel('Centro de trabajo')
    .selectOption({ label: 'Centro Guayaquil (demostración)' });
  await page.getByLabel('Área (opcional)').selectOption({ label: 'Planta A' });
  await page.getByLabel('Título').fill(`Inspección de campo ${suffix}`);
  await page.getByLabel('Descripción').fill('Recorrido operacional E2E.');
  await page.getByRole('radio', { name: /Matriz demostrativa 5×5 histórica/ }).check();
  await Promise.all([
    page.waitForURL(/\/app\/inspections\/[0-9a-f-]+$/),
    page.getByRole('button', { name: 'Crear inspección' }).click(),
  ]);
  const inspectionUrl = page.url();
  await expect(page.getByRole('heading', { name: `Inspección de campo ${suffix}` })).toBeVisible();
  await page.getByRole('button', { name: 'Iniciar inspección' }).click();
  await expect(page.getByText('En progreso').first()).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/app\/inspections\/[0-9a-f-]+\/findings\/new$/),
    page.getByRole('link', { name: 'Registrar hallazgo' }).click(),
  ]);

  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Título').fill(`Conductor expuesto ${suffix}`);
  await page.getByLabel('Descripción').fill('Conductor sintético identificado durante E2E.');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Categoría del hallazgo').selectOption('ELECTRICAL');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('group', { name: 'Probabilidad' }).locator('input[value="4"]').check();
  await page.getByRole('group', { name: 'Consecuencia' }).locator('input[value="5"]').check();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByText('Probabilidad').last()).toBeVisible();
  const [findingResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /\/inspections\/[0-9a-f-]+\/findings$/.test(response.url()),
    ),
    page.getByRole('button', { name: 'Guardar hallazgo' }).click(),
  ]);
  expect(findingResponse.ok(), await findingResponse.text()).toBe(true);
  await expect(page.getByText('Resultado calculado automáticamente')).toBeVisible();
  await expect(page.getByText('Probabilidad 4 × consecuencia 5')).toBeVisible();
  await expect(page.getByText(/Metodología utilizada: Matriz demostrativa 5×5/)).toBeVisible();
  await expect(page.getByText('DEMO_5X5', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Crítico').first()).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/app\/inspections\/[0-9a-f-]+\/findings\/[0-9a-f-]+$/),
    page.getByRole('button', { name: 'Crear acción correctiva' }).click(),
  ]);
  const findingUrl = page.url();

  await page.getByRole('button', { name: 'Crear acción correctiva' }).click();
  const actionDialog = page.getByRole('dialog', { name: 'Crear acción correctiva' });
  await expect(actionDialog).toBeVisible();
  await expect(actionDialog.getByRole('button', { name: 'Cerrar diálogo' })).toBeFocused();
  await actionDialog
    .getByRole('textbox', { name: 'Acción' })
    .fill('Aislar conductor y verificar protección');
  await actionDialog
    .getByLabel('Responsable')
    .selectOption({ label: 'Técnico Inspecciones E2E · Propietario' });
  await actionDialog.getByLabel('Prioridad').selectOption('URGENT');
  await page.evaluate(() => {
    (window as typeof window & { __e2eClockOffsetMs: number }).__e2eClockOffsetMs = 3_600_000;
  });
  const proactiveRefresh = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/api/v1/auth/refresh',
  );
  const protectedActionCreation = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      /\/inspections\/[0-9a-f-]+\/findings\/[0-9a-f-]+\/actions$/.test(response.url()),
  );
  await actionDialog.getByRole('button', { name: 'Guardar acción' }).click();
  expect((await proactiveRefresh).ok()).toBe(true);
  expect((await protectedActionCreation).ok()).toBe(true);
  await page.evaluate(() => {
    (window as typeof window & { __e2eClockOffsetMs: number }).__e2eClockOffsetMs = 0;
  });
  await page.getByRole('button', { name: 'Iniciar acción' }).click();
  await page.getByRole('button', { name: 'Enviar a verificación' }).click();
  await expect(page.getByText('Pendiente de verificación').first()).toBeVisible();
  await expect(page.getByText('Acción completada', { exact: true })).toHaveCount(0);

  await page.setViewportSize({ width: 320, height: 800 });
  await page.getByRole('switch', { name: 'Enfoque inactivo' }).click();
  await expect(page.getByRole('switch', { name: 'Enfoque activo' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.locator('html')).toHaveAttribute('data-focus', 'on');
  const appearanceUserId = await page.evaluate(
    (key) => window.localStorage.getItem(key),
    appearanceSessionUserKey,
  );
  expect(appearanceUserId).not.toBeNull();
  const findingFocusStorageKey = appearanceFocusStorageKey(appearanceUserId!, 'finding');
  await expect
    .poll(() => page.evaluate((key) => window.localStorage.getItem(key), findingFocusStorageKey))
    .toBe('on');
  await expect(page.getByText(organizationName).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Riesgo inicial y residual' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Verificar riesgo residual' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  const refreshRequests = { inspection: 0, finding: 0 };
  let refreshPhase: keyof typeof refreshRequests | null = null;
  page.on('request', (request) => {
    if (
      refreshPhase &&
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/v1/auth/refresh'
    ) {
      refreshRequests[refreshPhase] += 1;
    }
  });

  refreshPhase = 'inspection';
  const inspectionRefresh = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/api/v1/auth/refresh',
  );
  await page.goto(inspectionUrl);
  expect((await inspectionRefresh).ok()).toBe(true);
  await expect(page).toHaveURL(inspectionUrl);
  await expect(page.getByText(organizationName).first()).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-focus', 'off');
  await expect(page.getByRole('switch', { name: 'Enfoque inactivo' })).toHaveAttribute(
    'aria-checked',
    'false',
  );
  expect(refreshRequests.inspection).toBe(1);

  refreshPhase = 'finding';
  const findingRefresh = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/api/v1/auth/refresh',
  );
  await page.goto(findingUrl);
  expect((await findingRefresh).ok()).toBe(true);
  await expect(page).toHaveURL(findingUrl);
  await expect(page.getByText(organizationName).first()).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Enfoque activo' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.locator('html')).toHaveAttribute('data-focus', 'on');
  await expect
    .poll(() => page.evaluate((key) => window.localStorage.getItem(key), findingFocusStorageKey))
    .toBe('on');
  expect(refreshRequests.finding).toBe(1);
  refreshPhase = null;

  await page.getByRole('button', { name: 'Verificar riesgo residual' }).click();
  const verificationDialog = page.getByRole('dialog', { name: 'Verificar riesgo residual' });
  await expect(verificationDialog).toBeVisible();
  await page
    .getByRole('group', { name: 'Probabilidad residual' })
    .locator('input[value="1"]')
    .check();
  await page.getByLabel('Base de verificación').selectOption('RECORDED_EVIDENCE');
  await page.getByLabel('Confirmo esta autoverificación y su trazabilidad.').check();
  await page
    .getByRole('group', { name: 'Consecuencia residual' })
    .locator('input[value="1"]')
    .check();
  const missingEvidenceResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      /\/inspections\/[0-9a-f-]+\/findings\/[0-9a-f-]+\/verify$/.test(response.url()),
  );
  await verificationDialog.getByRole('button', { name: 'Verificar riesgo residual' }).click();
  expect((await missingEvidenceResponse).status()).toBe(400);
  await expect(verificationDialog.getByText('No pudimos registrar la verificación.')).toBeVisible();
  await verificationDialog.getByRole('button', { name: 'Cancelar' }).click();

  await page.getByRole('button', { name: 'Añadir evidencia' }).click();
  await page.getByLabel('Nota').fill('Protección aislada y revisada durante la prueba E2E.');
  await page.getByRole('button', { name: 'Guardar evidencia' }).click();
  await expect(
    page.getByText('Protección aislada y revisada durante la prueba E2E.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Verificar riesgo residual' }).click();
  await verificationDialog
    .getByRole('group', { name: 'Probabilidad residual' })
    .locator('input[value="1"]')
    .check();
  await verificationDialog
    .getByRole('group', { name: 'Consecuencia residual' })
    .locator('input[value="1"]')
    .check();
  await verificationDialog.getByLabel('Base de verificación').selectOption('RECORDED_EVIDENCE');
  await verificationDialog.getByLabel('Confirmo esta autoverificación y su trazabilidad.').check();
  const [verificationResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /\/inspections\/[0-9a-f-]+\/findings\/[0-9a-f-]+\/verify$/.test(response.url()),
    ),
    verificationDialog.getByRole('button', { name: 'Verificar riesgo residual' }).click(),
  ]);
  expect(verificationResponse.ok(), await verificationResponse.text()).toBe(true);
  await expect(page.getByText('Cerrado').first()).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'Riesgo inicial y residual' })
      .locator('.risk-badge.risk-low')
      .filter({ hasText: 'Bajo' }),
  ).toBeVisible();

  for (const theme of ['operativo', 'sereno', 'noche', 'contraste']) {
    await page.getByLabel('Tema visual').selectOption(theme);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.getByRole('heading', { name: `Conductor expuesto ${suffix}` })).toBeVisible();
  }

  await page.getByRole('button', { name: 'Abrir navegación' }).click();
  await Promise.all([
    page.waitForURL('/app/inspections'),
    page
      .getByRole('navigation', { name: 'Navegación principal' })
      .getByRole('link', { name: 'Inspecciones', exact: true })
      .click(),
  ]);
  await expect(page.getByRole('heading', { name: 'Inspecciones', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Abrir navegación' }).click();
  await Promise.all([
    page.waitForURL('/app/inspections/alerts'),
    page
      .getByRole('navigation', { name: 'Navegación principal' })
      .getByRole('link', { name: 'Alertas', exact: true })
      .click(),
  ]);
  await expect(page.getByRole('heading', { name: 'Alertas' })).toBeVisible();
  await expect(
    page.getByText('Este aviso indica recurrencia, no confirma una causa raíz.').first(),
  ).toBeVisible();
  const recurrenceCard = page
    .locator('.inspection-alert-card')
    .filter({ hasText: 'Este aviso indica recurrencia, no confirma una causa raíz.' })
    .first();
  await recurrenceCard.getByRole('button', { name: 'Marcar como revisada' }).click();
  await expect(
    recurrenceCard.getByText(/Revisada por .*Esto no elimina la recurrencia/),
  ).toBeVisible();
  await recurrenceCard.getByRole('button', { name: 'Iniciar revisión sistémica' }).click();
  const systemicReview = recurrenceCard.locator('section.inspection-form-card');
  await expect(systemicReview.getByRole('heading', { name: 'Revisión sistémica' })).toBeVisible();
  await systemicReview
    .getByLabel('¿Las acciones puntuales parecen suficientes?')
    .selectOption('NEEDS_MORE_INFORMATION');
  await systemicReview.getByLabel('¿Se recomienda una revisión más amplia?').selectOption('YES');
  await systemicReview
    .getByLabel('Factores sospechados · opcional')
    .fill('Se requiere análisis profesional adicional de las condiciones repetidas.');
  const [systemicReviewResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /\/inspections\/systemic-reviews\/[0-9a-f-]+\/complete$/.test(response.url()),
    ),
    systemicReview.getByRole('button', { name: 'Completar revisión sistémica' }).click(),
  ]);
  expect(systemicReviewResponse.ok(), await systemicReviewResponse.text()).toBe(true);
  const completedReview = page.getByRole('region', { name: 'Revisión sistémica' }).filter({
    hasText: 'Se requiere análisis profesional adicional de las condiciones repetidas.',
  });
  await expect(
    completedReview.locator('.domain-status').filter({ hasText: 'Completada' }),
  ).toBeVisible();
  await expect(completedReview.getByText('Completada por', { exact: true })).toBeVisible();
});
