import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { freshReleaseRuntime } from './support/fresh-release-runtime';

test.use({ timezoneId: 'America/Guayaquil', trace: 'off', actionTimeout: 15_000 });
let runtime: Awaited<ReturnType<typeof freshReleaseRuntime>>;
const artifacts = resolve(__dirname, '../../../.artifacts/inspection-intelligence-v2');
test.beforeAll(async () => {
  test.setTimeout(120_000);
  runtime = await freshReleaseRuntime();
  await mkdir(artifacts, { recursive: true });
});

test.afterAll(async () => {
  if (runtime) await runtime.close();
});
async function screenshot(page: Page, name: string) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.screenshot({ path: resolve(artifacts, `${name}.png`), fullPage: true });
}
async function reflow(page: Page) {
  const measurements = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    overflow: [...document.querySelectorAll('body *')]
      .filter(
        (element) =>
          element.getBoundingClientRect().right > document.documentElement.clientWidth + 1,
      )
      .slice(-30)
      .map((element) => ({
        tag: element.tagName,
        class: element.className,
        right: element.getBoundingClientRect().right,
        width: element.getBoundingClientRect().width,
      })),
  }));
  if (measurements.scrollWidth > measurements.width) {
    await screenshot(page, 'reflow-failure');
    await writeFile(
      resolve(artifacts, 'reflow-failure.json'),
      JSON.stringify(measurements, null, 2),
    );
  }
  expect(measurements.scrollWidth).toBeLessThanOrEqual(measurements.width);
}

// The primary scenario provisions no customer fixture, module, standard policy,
// mapping, finding or action through Prisma. All writes follow the real UI.
test('fresh production release enters the demo and completes scoped inspection continuity through human acts', async ({
  page,
}) => {
  test.setTimeout(300_000);
  page.setDefaultTimeout(15_000);
  const suffix = randomUUID();
  const organizationName = `Synthetic Inspection ${suffix.slice(0, 8)}`;
  await page.goto(`${runtime.origin}/diagnostico`);
  const entryResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/solution-finder/sessions') &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Comenzar', exact: true }).click();
  expect((await entryResponse).status()).toBe(201);
  for (let step = 1; step <= 5; step++) {
    await expect(page.getByText(`Paso ${step} de 6`)).toBeVisible();
    if (step === 2) await page.getByLabel('Riesgo de incendio').check();
    if (step === 3) await page.getByLabel('Hallazgos recurrentes').check();
    await page.getByRole('button', { name: 'Guardar y continuar' }).click();
  }
  await page.getByRole('button', { name: 'Ver recomendación' }).click();
  await page.getByRole('link', { name: 'Crear cuenta y continuar' }).click();
  expect(page.url()).not.toMatch(/token/i);
  await page.getByLabel('Nombre', { exact: true }).fill('Synthetic Inspection Owner');
  await page
    .getByLabel('Correo', { exact: true })
    .fill(`inspection-continuity-${suffix}@example.test`);
  await page.getByLabel('Contraseña', { exact: true }).fill(randomUUID() + randomUUID());
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await page.getByLabel('Nombre de empresa', { exact: true }).fill(organizationName);
  await page.getByLabel('Sector', { exact: true }).fill('Manufactura sintética');
  let baselineChecked = false;
  await page.route('**/solution-finder/sessions/*/activate-demo', async (route) => {
    const organization = await runtime.prisma.organization.findFirstOrThrow({
      where: { name: organizationName },
      include: {
        memberships: true,
        modules: { include: { module: true } },
        subscriptions: { include: { plan: true } },
      },
    });
    expect(organization.country).toBe('Ecuador');
    expect(organization.sector).toBe('Manufactura sintética');
    expect(organization.memberships).toHaveLength(1);
    expect(organization.memberships[0]!.role).toBe('ORG_OWNER');
    expect(
      organization.modules.map(
        ({
          module,
          status,
          source,
        }: {
          module: { key: string };
          status: string;
          source: string;
        }) => [module.key, status, source],
      ),
    ).toEqual([['CORE', 'ACTIVE', 'PLAN']]);
    expect(organization.subscriptions[0]!.plan.key).toBe('FREE');
    baselineChecked = true;
    await route.continue();
  });
  await page.getByRole('button', { name: 'Crear y activar demo' }).click();
  await expect(page.getByText(/Demostración conceptual activa/)).toBeVisible();
  expect(baselineChecked).toBe(true);
  const organization = await runtime.prisma.organization.findFirstOrThrow({
    where: { name: organizationName },
  });
  expect(await runtime.prisma.organization.count()).toBe(1);
  const moduleState = await runtime.prisma.organizationModule.findMany({
    where: { organizationId: organization.id },
    orderBy: { moduleId: 'asc' },
  });
  const planState = await runtime.prisma.subscription.findMany({
    where: { organizationId: organization.id },
  });
  const recommendationCount = await runtime.prisma.solutionRecommendation.count();
  await page.goto(`${runtime.origin}/app/inspections`);
  await screenshot(page, 'landing');
  await page.getByRole('link', { name: 'Nueva inspección' }).click();
  await expect(page.getByLabel('Centro de trabajo', { exact: true })).toBeVisible();
  await screenshot(page, 'start');
  await page
    .getByLabel('Centro de trabajo', { exact: true })
    .selectOption({ label: 'Centro Guayaquil (demostración)' });
  await page.getByLabel('Área (opcional)', { exact: true }).selectOption({ label: 'Planta A' });
  await page.getByRole('radio', { name: /Instalaciones eléctricas/ }).check();
  await screenshot(page, 'domain-resource');
  await page.getByRole('radio', { name: /Tomacorriente/ }).check();
  await expect(
    page.getByRole('heading', { name: '4 criterios para este recorrido' }),
  ).toBeVisible();
  await expect(page.getByText(/Demostración sintética/).first()).toBeVisible();
  await screenshot(page, 'basis-preview');
  await page.getByLabel('Título', { exact: true }).fill('Synthetic electrical scoped inspection');
  await page.getByRole('radio', { name: /GTC 45/ }).check();
  const createResponse = page.waitForResponse(
    (response) => response.url().endsWith('/inspections') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Crear inspección', exact: true }).click();
  expect((await createResponse).status()).toBe(201);
  await expect(page).toHaveURL(/\/app\/inspections\/[0-9a-f-]+$/);
  const inspectionUrl = page.url();
  const inspectionId = inspectionUrl.split('/').at(-1)!;
  const original = await runtime.prisma.inspection.findUniqueOrThrow({
    where: { id: inspectionId },
    include: { criterionResults: true },
  });
  expect(original.criterionResults).toHaveLength(4);
  expect(
    original.criterionResults.every(
      ({ outcome }: { outcome: string }) => outcome === 'NO_VERIFICADO',
    ),
  ).toBe(true);
  await expect(page.getByText('0 de 4 criterios registrados')).toBeVisible();
  await page.getByRole('button', { name: 'Iniciar inspección', exact: true }).click();
  await expect(page.getByRole('radio', { name: /Conforme Cumple/ })).toBeEnabled();
  await screenshot(page, 'focal-desktop');
  const focal = page.getByRole('region', { name: 'Ejecución de criterios' });
  const firstTitle = await focal.getByRole('heading', { level: 2 }).innerText();
  await expect(focal.getByRole('radio', { name: /No aplica/ })).toBeDisabled();
  await expect(focal.getByText(/No aplica no disponible/)).toBeVisible();
  await page.setViewportSize({ width: 320, height: 800 });
  await reflow(page);
  await screenshot(page, 'focal-320');
  await page.setViewportSize({ width: 390, height: 844 });
  await reflow(page);
  await screenshot(page, 'focal-mobile');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await focal.getByRole('radio', { name: /No conforme/ }).check();
  await focal
    .getByLabel('Observación (obligatoria)', { exact: true })
    .fill('Conductor sintético visible fuera de su canaleta.');
  const saved = page.waitForResponse(
    (response) => /\/criteria\//.test(response.url()) && response.request().method() === 'PATCH',
  );
  await focal.getByRole('button', { name: 'Guardar resultado', exact: true }).click();
  expect((await saved).status()).toBe(200);
  await expect(focal.getByRole('heading', { name: '¿Registrar un hallazgo?' })).toBeVisible();
  expect(await runtime.prisma.inspectionFinding.count({ where: { inspectionId } })).toBe(0);
  await screenshot(page, 'nonconformity');
  await focal.getByRole('link', { name: 'Registrar hallazgo', exact: true }).click();
  await screenshot(page, 'finding-context');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByLabel('Título del hallazgo', { exact: true })).toHaveValue(firstTitle);
  await expect(page.getByLabel('Descripción', { exact: true })).toHaveValue(
    'Conductor sintético visible fuera de su canaleta.',
  );
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByLabel('Categoría del hallazgo').selectOption('ELECTRICAL');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByLabel('Nivel de deficiencia', { exact: true }).selectOption('HIGH');
  await page.getByLabel('Nivel de exposición', { exact: true }).selectOption('3');
  await page.getByLabel('Nivel de consecuencia', { exact: true }).selectOption('25');
  await page
    .getByLabel('Justificación profesional', { exact: true })
    .fill('Selecciones humanas sobre condiciones y controles sintéticos.');
  await screenshot(page, 'gtc45-input');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  const findingResponse = page.waitForResponse(
    (response) => /\/findings$/.test(response.url()) && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Guardar hallazgo', exact: true }).click();
  const finding = await (await findingResponse).json();
  expect(finding.initialMethodResult).toMatchObject({
    deficiencyValue: 6,
    probabilityValue: 18,
    consequenceValue: 25,
    riskValue: 450,
    riskLevel: 'II',
  });
  await expect(page.getByText(/NP = ND × NE/)).toBeVisible();
  await expect(page.getByText('PLACEHOLDER_NEEDS_ANITA')).toHaveCount(0);
  await screenshot(page, 'gtc45-result');
  await page.getByRole('button', { name: 'Crear acción correctiva', exact: true }).click();
  await expect(page).toHaveURL(/\/findings\/[0-9a-f-]+$/);
  const findingUrl = page.url();
  await page.getByRole('button', { name: 'Crear acción correctiva', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Crear acción correctiva' });
  await drawer.getByLabel('Acción', { exact: true }).fill('Reubicar conductor sintético');
  await drawer.getByLabel('Responsable', { exact: true }).selectOption({ index: 1 });
  const dueInput = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(new Date(Date.now() + 86_400_000))
    .replace(' ', 'T');
  await drawer.getByLabel('Fecha límite (opcional)').fill(dueInput);
  await screenshot(page, 'action');
  await drawer.getByRole('button', { name: 'Guardar acción', exact: true }).click();
  await expect(drawer).not.toBeVisible();
  const action = await runtime.prisma.correctiveAction.findFirstOrThrow({
    where: { findingId: finding.id },
  });
  expect(action.dueAt?.toISOString()).toBe(new Date(`${dueInput}:00-05:00`).toISOString());
  const actionCard = page.locator(`#inspection-action-${action.id}`);
  for (const type of ['NOTE', 'EXTERNAL_LINK']) {
    await actionCard.getByRole('button', { name: 'Añadir evidencia', exact: true }).click();
    await actionCard.getByLabel('Tipo de evidencia').selectOption(type);
    if (type === 'NOTE')
      await actionCard
        .getByLabel('Nota', { exact: true })
        .fill('Nota sintética de seguimiento del control.');
    else
      await actionCard
        .getByLabel('Enlace HTTPS', { exact: true })
        .fill('https://example.test/synthetic-control-reference');
    await actionCard.getByRole('button', { name: 'Guardar evidencia', exact: true }).click();
    await expect(
      actionCard.getByRole('button', { name: 'Añadir evidencia', exact: true }),
    ).toBeVisible();
  }
  await expect(actionCard.getByText(/Nota · Synthetic Inspection Owner/)).toBeVisible();
  await expect(actionCard.getByText(/Enlace externo · Synthetic Inspection Owner/)).toBeVisible();
  await screenshot(page, 'evidence');
  await page.goto(inspectionUrl);
  await focal.getByLabel('Ir a criterio', { exact: true }).selectOption(finding.criterionResultId);
  await expect(focal.getByRole('radio', { name: /Conforme Cumple/ })).toBeDisabled();
  await expect(focal.getByText(/conserva No conforme porque tiene un hallazgo/)).toBeVisible();
  const rows: Array<{ id: string; criterion: { notApplicableAllowed: boolean } }> =
    await runtime.prisma.inspectionCriterionResult.findMany({
      where: { inspectionId },
      include: { criterion: true },
      orderBy: { criterion: { displayOrder: 'asc' } },
    });
  const remaining = rows.filter(({ id }) => id !== finding.criterionResultId);
  const notApplicable = remaining.find(({ criterion }) => criterion.notApplicableAllowed)!;
  const otherRows = remaining.filter(({ id }) => id !== notApplicable.id);
  const outcomes = [
    { row: otherRows[0]!, outcome: 'CONFORME' },
    { row: notApplicable, outcome: 'NO_APLICA' },
    { row: otherRows[1]!, outcome: 'NO_VERIFICADO' },
  ];
  for (const [index, { row, outcome }] of outcomes.entries()) {
    await focal.getByLabel('Ir a criterio', { exact: true }).selectOption(row.id);
    await focal
      .getByRole('radio', {
        name: new RegExp(
          `^${outcome === 'CONFORME' ? 'Conforme Cumple' : outcome === 'NO_APLICA' ? 'No aplica' : 'No verificado'}`,
        ),
      })
      .check();
    await focal.getByRole('button', { name: 'Guardar resultado', exact: true }).click();
    await expect(page.getByText(`${index + 2} de 4 criterios registrados`)).toBeVisible();
  }
  await page.setViewportSize({ width: 900, height: 1024 });
  await reflow(page);
  await screenshot(page, 'tablet');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('button', { name: 'Completar inspección', exact: true }).click();
  const completion = page.getByRole('dialog', { name: 'Completar inspección' });
  await expect(
    completion.getByText('4 de 4 criterios registrados · 0 sin registrar.'),
  ).toBeVisible();
  await screenshot(page, 'completion');
  await completion.getByRole('button', { name: 'Completar inspección', exact: true }).click();
  await expect(completion).not.toBeVisible();
  expect(
    (await runtime.prisma.inspection.findUniqueOrThrow({ where: { id: inspectionId } })).status,
  ).toBe('COMPLETED');
  expect(
    (await runtime.prisma.correctiveAction.findUniqueOrThrow({ where: { id: action.id } })).status,
  ).toBe('OPEN');
  await screenshot(page, 'historical');
  await page.goto(`${runtime.origin}/app/work`);
  await expect(
    page.locator(`a[href*="/findings/${finding.id}?action=${action.id}"]`).first(),
  ).toBeVisible();
  await screenshot(page, 'work-queue');
  const handoff = page.locator(`a[href*="/findings/${finding.id}?action=${action.id}"]`).first();
  await handoff.click();
  await expect(page.locator(`#inspection-action-${action.id}`)).toBeFocused();
  await actionCard.getByRole('button', { name: 'Iniciar acción', exact: true }).click();
  await actionCard.getByRole('button', { name: 'Enviar a verificación', exact: true }).click();
  await page.getByRole('button', { name: 'Verificar riesgo residual', exact: true }).click();
  const verification = page.getByRole('dialog', { name: 'Verificar riesgo residual' });
  await verification.getByLabel('Deficiencia posterior', { exact: true }).selectOption('LOW');
  await verification.getByLabel('Exposición posterior', { exact: true }).selectOption('1');
  await verification.getByLabel('Consecuencia posterior', { exact: true }).selectOption('10');
  await verification
    .getByLabel('Justificación profesional posterior', { exact: true })
    .fill('Verificación humana del control sintético registrado.');
  await verification
    .getByLabel('Base de verificación', { exact: true })
    .selectOption('RECORDED_EVIDENCE');
  const acknowledgement = verification.getByLabel(
    'Confirmo esta autoverificación y su trazabilidad.',
  );
  if (await acknowledgement.isVisible()) await acknowledgement.check();
  await verification
    .getByRole('button', { name: 'Verificar riesgo residual', exact: true })
    .click();
  await expect(verification).not.toBeVisible();
  const verified = await runtime.prisma.inspectionFinding.findUniqueOrThrow({
    where: { id: finding.id },
  });
  expect(verified.initialMethodResult).toEqual(finding.initialMethodResult);
  expect(verified.residualMethodResult).toMatchObject({
    deficiencyValue: null,
    probabilityValue: null,
    riskValue: null,
    riskLevel: 'IV',
  });
  expect(verified.residualScore).toBeNull();
  expect(verified.status).toBe('CLOSED');
  await expect(page.getByText('Riesgo residual registrado')).toHaveAttribute(
    'data-complete',
    'true',
  );
  await page.setViewportSize({ width: 640, height: 450 });
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  await reflow(page);
  await screenshot(page, 'zoom-200');
  await page.evaluate(() => {
    document.documentElement.style.zoom = '';
  });
  expect(
    await runtime.prisma.organizationModule.findMany({
      where: { organizationId: organization.id },
      orderBy: { moduleId: 'asc' },
    }),
  ).toEqual(moduleState);
  expect(
    await runtime.prisma.subscription.findMany({ where: { organizationId: organization.id } }),
  ).toEqual(planState);
  expect(await runtime.prisma.solutionRecommendation.count()).toBe(recommendationCount);
  expect(await runtime.prisma.inspectionFinding.count({ where: { inspectionId } })).toBe(1);
  expect(await runtime.prisma.correctiveAction.count({ where: { findingId: finding.id } })).toBe(1);
  expect(
    await runtime.prisma.actionEvidence.count({ where: { correctiveActionId: action.id } }),
  ).toBe(2);
  expect(
    (await runtime.prisma.inspection.findUniqueOrThrow({ where: { id: inspectionId } }))
      .resourceScopeSnapshot,
  ).toEqual(original.resourceScopeSnapshot);
  expect(page.url()).not.toMatch(/token/i);
  expect(findingUrl).toContain(`/findings/${finding.id}`);
});

test('multi-source fallback preserves every frozen criterion and a failed save remains retryable', async ({
  page,
}) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(15_000);
  const suffix = randomUUID();
  const password = randomUUID() + randomUUID();
  const email = `combined-${suffix}@example.test`;
  const registered = await page.request.post(`${runtime.origin}/api/v1/auth/register`, {
    data: {
      displayName: 'Synthetic combined owner',
      email,
      password,
    },
  });
  expect(registered.status()).toBe(201);
  const account = await registered.json();
  const headers = { Authorization: `Bearer ${account.accessToken}` };
  const createdOrganization = await page.request.post(`${runtime.origin}/api/v1/organizations`, {
    headers,
    data: { name: 'Synthetic combined continuity', country: 'Ecuador' },
  });
  expect(createdOrganization.status()).toBe(201);
  const organization = await createdOrganization.json();
  const scopedHeaders = { ...headers, 'x-organization-id': organization.id };
  const module = await runtime.prisma.moduleDefinition.findUniqueOrThrow({
    where: { key: 'INSPECTIONS_INTELLIGENCE' },
  });
  // Secondary compatibility fixture. The primary scenario above activates the
  // existing demo explicitly through the UI and provisions no customer fixture.
  await runtime.prisma.organizationModule.create({
    data: {
      organizationId: organization.id,
      moduleId: module.id,
      status: 'ACTIVE',
      source: 'MANUAL',
    },
  });
  const composition = {
    reason: 'Synthetic compatibility fixture',
    technicalSources: [
      {
        standardVersionId: '57100000-0000-4000-8000-000000000001',
        role: 'PRIMARY_TECHNICAL',
        displayOrder: 1,
      },
      {
        standardVersionId: '57100000-0000-4000-8000-000000000002',
        role: 'SUPPLEMENTAL_TECHNICAL',
        displayOrder: 2,
      },
    ],
    regulatoryUnits: [],
  };
  const response = await page.request.post(`${runtime.origin}/api/v1/inspection-bases`, {
    headers: scopedHeaders,
    data: { ...composition, name: 'Synthetic combined basis', inspectionDomain: 'ELECTRICAL' },
  });
  expect(response.status()).toBe(201);
  const basis = await response.json();
  expect(
    (
      await page.request.post(
        `${runtime.origin}/api/v1/inspection-bases/versions/${basis.id}/activate`,
        { headers: scopedHeaders },
      )
    ).status(),
  ).toBe(201);
  const dashboardResponse = await page.request.get(`${runtime.origin}/api/v1/dashboard`, {
    headers: scopedHeaders,
  });
  expect(dashboardResponse.status()).toBe(200);
  const dashboard = await dashboardResponse.json();
  expect(dashboard.entitlements.features['module.inspections']).toBe(true);
  await page.goto(`${runtime.origin}/auth/login`);
  await page.getByLabel('Correo', { exact: true }).fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/app(?:\/)?$/);
  await page.getByRole('link', { name: 'Prefiero empezar y configurar después' }).click();
  await page.getByRole('link', { name: 'Trabajo en campo', exact: true }).click();
  await page.getByRole('link', { name: /^Nueva inspección/ }).click();
  try {
    await expect(page.getByRole('heading', { name: 'Planifica el recorrido' })).toBeVisible();
  } catch (error) {
    await screenshot(page, 'secondary-preparation-failure');
    await writeFile(
      resolve(artifacts, 'secondary-preparation-failure.json'),
      JSON.stringify(
        {
          path: new URL(page.url()).pathname,
          headings: await page.locator('h1,h2,[role=alert]').allTextContents(),
        },
        null,
        2,
      ),
    );
    throw error;
  }
  await page
    .getByLabel('Centro de trabajo', { exact: true })
    .selectOption({ label: 'Centro principal' });
  const domain = page.getByRole('radio', { name: /Instalaciones eléctricas/ });
  await domain.focus();
  await page.keyboard.press('Space');
  await expect(domain).toBeChecked();
  await expect(page.getByRole('radio', { name: /Tomacorriente/ })).toBeDisabled();
  await expect(page.getByText(/Esta base combina 2 fuentes técnicas/).first()).toBeVisible();
  await page.getByRole('radio', { name: /Inspección general sin recurso/ }).check();
  await expect(
    page.getByRole('heading', { name: '7 criterios para este recorrido' }),
  ).toBeVisible();
  await expect(
    page.getByText(/Referencia suplementaria · Demo Electrical Standard B/),
  ).toBeVisible();
  await screenshot(page, 'multisource-general-preview');
  await page.getByLabel('Título', { exact: true }).fill('Synthetic combined inspection');
  await page.getByRole('radio', { name: /Matriz 5×5 guiada/ }).check();
  await page.getByRole('button', { name: 'Crear inspección', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/inspections\/[0-9a-f-]+$/);
  const inspectionUrl = page.url();
  const inspectionId = inspectionUrl.split('/').at(-1)!;
  const frozen = await runtime.prisma.inspection.findUniqueOrThrow({
    where: { id: inspectionId },
    include: { criterionResults: true },
  });
  expect(frozen.resourceScopeSnapshot).toBeNull();
  expect(frozen.criterionResults).toHaveLength(7);
  await page.getByRole('button', { name: 'Iniciar inspección', exact: true }).click();
  const focal = page.getByRole('region', { name: 'Ejecución de criterios' });
  const heading = focal.getByRole('heading', { level: 2 });
  await expect(heading).toBeFocused();
  const criterionTitle = await heading.innerText();
  const nonconformity = focal.getByRole('radio', { name: /^No conforme/ });
  await nonconformity.focus();
  await page.keyboard.press('Space');
  await expect(nonconformity).toBeChecked();
  await focal
    .getByLabel('Observación (obligatoria)', { exact: true })
    .fill('Synthetic combined observed condition.');
  await page.route(
    '**/inspections/*/criteria/*',
    async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'No fue posible registrar el resultado. Intenta nuevamente.',
          },
        }),
      });
    },
    { times: 1 },
  );
  await focal.getByRole('button', { name: 'Guardar resultado', exact: true }).click();
  await expect(focal.getByRole('alert')).toBeVisible();
  await expect(heading).toHaveText(criterionTitle);
  await expect(focal.getByLabel('Observación (obligatoria)', { exact: true })).toHaveValue(
    'Synthetic combined observed condition.',
  );
  await expect(page.getByText('0 de 7 criterios registrados')).toBeVisible();
  await expect(focal.getByRole('button', { name: 'Guardar resultado', exact: true })).toBeEnabled();
  await focal.getByRole('button', { name: 'Guardar resultado', exact: true }).click();
  await expect(page.getByText('1 de 7 criterios registrados')).toBeVisible();
  expect(await runtime.prisma.inspectionFinding.count({ where: { inspectionId } })).toBe(0);
  await focal.getByRole('link', { name: 'Registrar hallazgo', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByLabel('Categoría del hallazgo').selectOption('ELECTRICAL');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByRole('radio', { name: /Probable/ }).check();
  await page.getByRole('radio', { name: /Catastrófica/ }).check();
  await page
    .getByLabel('Justificación profesional', { exact: true })
    .fill('Explicit synthetic human probability and severity selections.');
  await screenshot(page, 'guided-5x5');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  const findingResponse = page.waitForResponse(
    (candidate) => candidate.url().endsWith('/findings') && candidate.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Guardar hallazgo', exact: true }).click();
  const finding = await (await findingResponse).json();
  expect(finding.riskMethodKey).toBe('GUIDED_5X5');
  expect(finding.initialScore).toBe(20);
  const changed = await page.request.post(
    `${runtime.origin}/api/v1/inspection-bases/${basis.definition.id}/versions`,
    {
      headers: scopedHeaders,
      data: { ...composition, technicalSources: [composition.technicalSources[1]] },
    },
  );
  // A new composition must still designate its principal source explicitly.
  expect(changed.status()).toBe(400);
  const next = await page.request.post(
    `${runtime.origin}/api/v1/inspection-bases/${basis.definition.id}/versions`,
    {
      headers: scopedHeaders,
      data: {
        ...composition,
        technicalSources: [
          { ...composition.technicalSources[1], role: 'PRIMARY_TECHNICAL', displayOrder: 1 },
        ],
      },
    },
  );
  expect(next.status()).toBe(201);
  const nextBasis = await next.json();
  expect(
    (
      await page.request.post(
        `${runtime.origin}/api/v1/inspection-bases/versions/${nextBasis.id}/activate`,
        { headers: scopedHeaders },
      )
    ).status(),
  ).toBe(201);
  await page.getByRole('button', { name: 'Volver a la inspección', exact: true }).click();
  await expect(page.getByText('1 de 7 criterios registrados')).toBeVisible();
  const retained = await runtime.prisma.inspection.findUniqueOrThrow({
    where: { id: inspectionId },
    include: { criterionResults: true },
  });
  expect(retained.inspectionBasisVersionId).toBe(basis.id);
  expect(retained.inspectionBasisSnapshot).toEqual(frozen.inspectionBasisSnapshot);
  expect(retained.criterionResults).toHaveLength(7);
  await screenshot(page, 'historical-frozen-basis');
  await page.getByRole('button', { name: 'Completar inspección', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Completar inspección' });
  await expect(dialog.getByText('1 de 7 criterios registrados · 6 sin registrar.')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Cerrar diálogo', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Completar inspección', exact: true }),
  ).toBeFocused();
  await page.getByRole('button', { name: 'Completar inspección', exact: true }).click();
  await dialog.getByRole('button', { name: 'Completar inspección', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(
    (await runtime.prisma.inspection.findUniqueOrThrow({ where: { id: inspectionId } })).status,
  ).toBe('COMPLETED');
});
