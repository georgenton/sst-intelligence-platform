import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { answerCurrentQuestion } from './support/guided-assessment-helpers';
import { freshReleaseRuntime } from './support/fresh-release-runtime';

let runtime: Awaited<ReturnType<typeof freshReleaseRuntime>>;
test.beforeAll(async () => {
  test.setTimeout(90_000);
  runtime = await freshReleaseRuntime();
});
test.afterAll(async () => {
  if (runtime) await runtime.close();
});

test('finalized public assessment signs up and claims once on a fresh release, including a lost company response', async ({
  page,
}, testInfo) => {
  test.setTimeout(300_000);
  await page.goto(`${runtime.origin}/evaluacion-sst`);
  await page.getByRole('button', { name: '2 centros', exact: true }).click();
  await page.getByRole('button', { name: 'Comenzar evaluación' }).click();
  await expect(page.locator('[data-question-id]')).toBeVisible();
  for (let attempt = 0; attempt < 80; attempt++) {
    if (
      await page
        .getByRole('heading', { name: 'Esto es lo que entendimos de tu empresa' })
        .isVisible()
    )
      break;
    const relay = page.getByRole('button', { name: /^Empezar con Centro/ });
    if (await relay.isVisible()) {
      await relay.click();
      continue;
    }
    const checkpoint = page.getByRole('button', { name: 'Todo correcto, continuar' });
    if (await checkpoint.isVisible()) {
      await checkpoint.click();
      continue;
    }
    await answerCurrentQuestion(page);
  }
  await page.getByRole('button', { name: 'Confirmar y generar diagnóstico', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Tu diagnóstico SST', exact: true }),
  ).toBeVisible();
  const assessmentId = (await page.evaluate(() =>
    localStorage.getItem('sst-assessment-session:active'),
  ))!;
  expect(assessmentId).toMatch(/^[0-9a-f-]{36}$/);
  const before = await runtime.prisma.sstAssessmentSession.findUniqueOrThrow({
    where: { id: assessmentId },
  });
  expect(before.status).toBe('FINALIZED');
  const email = `signup-claim-${randomUUID()}@example.test`;
  await page.getByRole('link', { name: 'Crear cuenta y continuar' }).click();
  expect(page.url()).not.toMatch(/token/i);
  await page.getByLabel('Nombre', { exact: true }).fill('Synthetic Signup Claim Owner');
  await page.getByLabel('Correo', { exact: true }).fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(randomUUID() + randomUUID());
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Guarda este diagnóstico en tu empresa' }),
  ).toBeVisible();
  await page.getByRole('button', { name: /Crear nueva empresa/ }).click();
  const input = {
    name: 'Synthetic Signup Claim Company',
    country: 'Ecuador',
    sector: 'Servicios sintéticos',
  };
  await page.getByLabel('Nombre de empresa', { exact: true }).fill(input.name);
  await page.getByLabel('Actividad principal', { exact: true }).fill(input.sector);
  let createdId = '';
  let retryKey = '';
  await page.route(
    '**/api/v1/organizations',
    async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      retryKey = route.request().headers()['idempotency-key']!;
      const response = await route.fetch();
      expect(response.status()).toBe(201);
      createdId = (await response.json()).id as string;
      await route.abort('failed');
    },
    { times: 1 },
  );
  await page.getByRole('button', { name: 'Crear empresa', exact: true }).click();
  await expect(page.locator('.assessment-shell').getByRole('alert')).toContainText(
    'Tu diagnóstico sigue guardado',
  );
  await expect(page.getByRole('button', { name: 'Crear empresa', exact: true })).toBeEnabled();
  const recovery = () =>
    page.evaluate(
      (id) => Boolean(localStorage.getItem(`sst-assessment-session:${id}`)),
      assessmentId,
    );
  expect(await recovery()).toBe(true);
  expect(await runtime.prisma.organization.count()).toBe(1);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Guarda este diagnóstico en tu empresa' }),
  ).toBeVisible();
  await page.getByRole('button', { name: /Crear nueva empresa/ }).click();
  await page.getByLabel('Nombre de empresa', { exact: true }).fill(input.name);
  await page.getByLabel('Actividad principal', { exact: true }).fill(input.sector);
  const repeated = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url().endsWith('/api/v1/organizations'),
  );
  await page.getByRole('button', { name: 'Crear empresa', exact: true }).click();
  const replay = await repeated;
  expect(replay.status()).toBe(201);
  expect((await replay.json()).id).toBe(createdId);
  expect(replay.request().headers()['idempotency-key']).toBe(retryKey);
  await expect(
    page.getByRole('heading', { name: 'Configura los centros de trabajo' }),
  ).toBeVisible();
  expect(await recovery()).toBe(true);
  const baseline = await runtime.prisma.planFeature.findMany({ orderBy: { id: 'asc' } });
  for (const [index, name] of ['Centro Norte', 'Centro Sur'].entries())
    await page.getByLabel(`Centro ${index + 1}`, { exact: true }).fill(name);
  await page.screenshot({
    path: testInfo.outputPath('claim-center-configuration.png'),
    fullPage: true,
  });
  let retainedBeforeSuccess = false;
  await page.route(
    '**/claim-new-organization',
    async (route) => {
      const response = await route.fetch();
      expect(response.status()).toBe(201);
      retainedBeforeSuccess = await recovery();
      await route.fulfill({ response });
    },
    { times: 1 },
  );
  await page.getByRole('button', { name: 'Guardar centros y continuar', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/app/evaluation/${assessmentId}$`));
  await expect(
    page.getByRole('heading', { name: 'Tu diagnóstico SST', exact: true }),
  ).toBeVisible();
  expect(page.url()).not.toMatch(/token/i);
  expect(retainedBeforeSuccess).toBe(true);
  expect(await recovery()).toBe(false);
  const owner = await runtime.prisma.user.findUniqueOrThrow({ where: { email } });
  const organization = await runtime.prisma.organization.findUniqueOrThrow({
    where: { id: createdId },
    include: {
      memberships: true,
      workCenters: true,
      modules: { include: { module: true } },
      subscriptions: { include: { plan: true } },
    },
  });
  expect(await runtime.prisma.organization.count()).toBe(1);
  expect(organization).toMatchObject({ ...input, demoStartedAt: null, demoExpiresAt: null });
  expect(organization.memberships).toHaveLength(1);
  expect(organization.memberships[0]).toMatchObject({
    userId: owner.id,
    role: 'ORG_OWNER',
    status: 'ACTIVE',
  });
  expect(organization.workCenters.map(({ name }: { name: string }) => name).sort()).toEqual([
    'Centro Norte',
    'Centro Sur',
  ]);
  expect(organization.modules.map(({ module }: { module: { key: string } }) => module.key)).toEqual(
    ['CORE'],
  );
  expect(organization.modules[0]).toMatchObject({ source: 'PLAN', status: 'ACTIVE' });
  expect(organization.subscriptions.map(({ plan }: { plan: { key: string } }) => plan.key)).toEqual(
    ['FREE'],
  );
  expect(await runtime.prisma.planFeature.findMany({ orderBy: { id: 'asc' } })).toEqual(baseline);
  const after = await runtime.prisma.sstAssessmentSession.findUniqueOrThrow({
    where: { id: assessmentId },
  });
  expect(after).toMatchObject({
    organizationId: createdId,
    claimedById: owner.id,
    status: 'FINALIZED',
  });
  expect(after.finalSnapshot).toEqual(before.finalSnapshot);
  expect(after.claimScopeMappings).toHaveLength(2);
  expect(
    await runtime.prisma.auditLog.count({
      where: { organizationId: createdId, action: 'ORGANIZATION_CREATED' },
    }),
  ).toBe(1);
  await page.screenshot({
    path: testInfo.outputPath('claim-authenticated-diagnosis.png'),
    fullPage: true,
  });
});
