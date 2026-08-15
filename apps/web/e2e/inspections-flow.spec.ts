import { expect, test } from '@playwright/test';
import { appearanceFocusStorageKey, appearanceSessionUserKey } from '../lib/appearance';

test('inspección, hallazgo, acción, verificación y recurrencia demo', async ({ page }) => {
  test.setTimeout(90_000);
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

  await page.getByRole('link', { name: 'Inspecciones', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Inspecciones', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Nueva inspección' }).click();
  await page
    .getByLabel('Centro de trabajo')
    .selectOption({ label: 'Centro Guayaquil (demostración)' });
  await page.getByLabel('Área (opcional)').selectOption({ label: 'Planta A' });
  await page.getByLabel('Título').fill(`Inspección de campo ${suffix}`);
  await page.getByLabel('Descripción').fill('Recorrido operacional E2E.');
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
  await expect(page.getByText('Resultado calculado por el servidor')).toBeVisible();
  await expect(page.getByText('Probabilidad 4 × consecuencia 5')).toBeVisible();
  await expect(page.getByText('Crítico').first()).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/app\/inspections\/[0-9a-f-]+\/findings\/[0-9a-f-]+$/),
    page.getByRole('button', { name: 'Crear acción correctiva' }).click(),
  ]);
  const findingUrl = page.url();

  await page.getByRole('button', { name: 'Nueva acción' }).click();
  await page.getByLabel('Acción').fill('Aislar conductor y verificar protección');
  await page
    .getByLabel('Responsable')
    .selectOption({ label: 'Técnico Inspecciones E2E · ORG_OWNER' });
  await page.getByLabel('Prioridad').selectOption('URGENT');
  await page.getByRole('button', { name: 'Guardar acción' }).click();
  await page.getByRole('button', { name: 'Iniciar acción' }).click();
  await page.getByRole('button', { name: 'Añadir evidencia' }).click();
  await page.getByLabel('Nota').fill('Protección aislada y revisada durante la prueba E2E.');
  await page.getByRole('button', { name: 'Guardar evidencia' }).click();
  await expect(
    page.getByText('Protección aislada y revisada durante la prueba E2E.'),
  ).toBeVisible();
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
  await page
    .getByRole('group', { name: 'Probabilidad residual' })
    .locator('input[value="1"]')
    .check();
  await page
    .getByRole('group', { name: 'Consecuencia residual' })
    .locator('input[value="1"]')
    .check();
  const [verificationResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /\/inspections\/[0-9a-f-]+\/findings\/[0-9a-f-]+\/verify$/.test(response.url()),
    ),
    page.getByRole('dialog').getByRole('button', { name: 'Verificar riesgo residual' }).click(),
  ]);
  expect(verificationResponse.ok(), await verificationResponse.text()).toBe(true);
  await expect(page.getByText('Cerrado').first()).toBeVisible();
  await expect(page.getByText('Bajo').first()).toBeVisible();

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
});
