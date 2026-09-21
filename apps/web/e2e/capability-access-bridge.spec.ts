import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';
import { createE2eOrganization } from './support/e2e-api';
import { activateE2eUserSession, registerE2eUser } from './support/register-e2e-user';

const prisma = new PrismaClient();

test.afterAll(async () => prisma.$disconnect());

function administrativeAnswers() {
  const organizationFacts: Record<string, unknown> = {
    'organization.totalWorkerCount': 60,
    'organization.managementSystem': 'SPREADSHEETS',
    'organization.inspectionPractice': 'CHECKLISTS',
    'organization.inspectionFrequency': 'MONTHLY',
    'organization.manualPermits': false,
    'organization.evidenceDifficulty': true,
    'organization.overdueActions': true,
    'organization.recurringFindings': true,
    'organization.hasExistingSstWorkPlan': false,
    'organization.multipleShifts': false,
    'organization.psychosocialReviewNeeded': false,
    'organization.stressExposedRolesPresent': false,
    'organization.strategicProtectionPriorities': ['PEOPLE_AND_HEALTH', 'PRODUCTIVE_CONTINUITY'],
  };
  const answers = Object.entries(organizationFacts).map(([factKey, value]) => ({
    factKey,
    scopeKey: 'organization',
    answerState: 'KNOWN',
    value,
  }));
  for (const [index, scopeKey] of ['center:1', 'center:2'].entries()) {
    const facts: Record<string, unknown> = {
      'workCenter.workerCount': index === 0 ? 40 : 20,
      'workCenter.workArrangement': index === 0 ? 'PHYSICAL' : 'REMOTE',
      'workCenter.activityCategories': ['ADMINISTRATIVE_SERVICES'],
      'workCenter.activityDescription': 'Servicios administrativos de oficina',
      ...(index === 0 ? { 'workCenter.facilityTypes': ['OFFICE'] } : {}),
    };
    for (const factKey of [
      'hasDistinctOperationalZones',
      'hasChemicalProcesses',
      'hasHighEnergyOperations',
      'hasWorkAtHeight',
      'hasHotWork',
      'hasElectricalWorkOrExposure',
      'hasConfinedSpaces',
      'hasExternalWorkforce',
      'hasCriticalMachinery',
      'hasDriversOrTransport',
      'hasFireExposure',
    ])
      facts[`workCenter.${factKey}`] = false;
    answers.push(
      ...Object.entries(facts).map(([factKey, value]) => ({
        factKey,
        scopeKey,
        answerState: 'KNOWN',
        value,
      })),
    );
  }
  return answers;
}

async function assertCapabilityViewport(page: Page, width: number, height = 900) {
  await page.setViewportSize({ width, height });
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(metrics.scrollWidth, `${width}px viewport overflow`).toBeLessThanOrEqual(
    metrics.clientWidth,
  );
}

test('finalized assessment opens explicit recommended and exploration demo access', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const registration = await registerE2eUser({
    displayName: 'Capability bridge owner',
    email: `capability-bridge-${randomUUID()}@example.test`,
    password: randomUUID() + randomUUID(),
  });
  const organization = await createE2eOrganization(
    request,
    registration,
    `Capability bridge ${randomUUID()}`,
  );
  await prisma.workCenter.create({
    data: { organizationId: organization.organization.id, name: `Centro dos ${randomUUID()}` },
  });
  const post = async (path: string, data: unknown) => {
    const response = await request.post(`http://127.0.0.1:3101/api/v1/sst-assessment${path}`, {
      headers: organization.headers,
      data,
    });
    expect(response.status(), await response.text()).toBe(201);
    return response.json();
  };

  let assessment = await post('/sessions', {});
  assessment = await post(`/sessions/${assessment.id}/answers`, {
    expectedSessionRevision: assessment.sessionRevision,
    answers: administrativeAnswers(),
  });
  assessment = await post(`/sessions/${assessment.id}/evaluate`, {
    expectedSessionRevision: assessment.sessionRevision,
  });
  assessment = await post(`/sessions/${assessment.id}/finalize`, {
    expectedSessionRevision: assessment.sessionRevision,
  });
  expect(assessment.status).toBe('FINALIZED');
  expect(
    assessment.result.capabilityEvaluation.recommendations
      .map((item: { capabilityKey: string }) => item.capabilityKey)
      .sort(),
  ).toEqual(['GOVERNANCE', 'INSPECTIONS', 'WORKFORCE']);

  const before = await prisma.sstAssessmentSession.findUniqueOrThrow({
    where: { id: assessment.id },
  });
  const subscriptionsBefore = await prisma.subscription.findMany({
    where: { organizationId: organization.organization.id },
    orderBy: { id: 'asc' },
  });

  await activateE2eUserSession(page, registration, `/app/evaluation/${assessment.id}`);
  const continueAssessment = page.getByRole('link', { name: 'Continuar Evaluación SST' });
  if (await continueAssessment.isVisible().catch(() => false)) await continueAssessment.click();
  await expect(
    page.getByRole('heading', { name: 'Tu diagnóstico SST', exact: true }),
  ).toBeVisible();
  const finalCta = page.getByRole('link', { name: 'Revisar y activar demostración' });
  for (const width of [320, 390, 768, 1280]) {
    await assertCapabilityViewport(page, width);
    await expect(finalCta).toBeVisible();
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('link', { name: 'Revisar y activar demostración' }).click();
  await expect(page).toHaveURL(
    new RegExp(`/app/modules[?]assessment=${assessment.id}&setup=base$`),
  );
  await expect(
    page.getByRole('heading', { name: 'Explora las capacidades propuestas' }),
  ).toBeVisible();
  await expect(
    page.getByText('Disponible para explorar; no fue recomendada por esta evaluación.').first(),
  ).toBeVisible();

  for (const width of [320, 390, 768, 1280]) {
    await assertCapabilityViewport(page, width);
    await expect(
      page.getByRole('heading', { name: 'Explora las capacidades propuestas' }),
    ).toBeVisible();
    await expect(page.getByRole('checkbox').first()).toBeVisible();
  }

  await page.setViewportSize({ width: 320, height: 900 });
  const navigationToggle = page.locator('.app-navigation-toggle');
  if ((await navigationToggle.getAttribute('aria-expanded')) !== 'true') {
    await navigationToggle.click();
  }
  const primaryNavigation = page.getByRole('navigation', { name: 'Navegación principal' });
  await expect(
    primaryNavigation.locator('a[data-locked="true"]').filter({ hasText: 'Permisos de trabajo' }),
  ).toBeVisible();

  const inspectionCard = page
    .getByRole('heading', { name: 'Inspecciones inteligentes' })
    .locator('..')
    .locator('..');
  const ppeCard = page
    .getByRole('heading', { name: 'Equipos de protección personal' })
    .locator('..')
    .locator('..');
  await inspectionCard.getByRole('checkbox').check();
  const activationButton = page.getByRole('button', {
    name: 'Activar demostración',
    exact: true,
  });
  expect(
    await activationButton.evaluate((element) => element.getBoundingClientRect().height),
  ).toBeGreaterThanOrEqual(44);
  await activationButton.click();
  const dialog = page.getByRole('dialog', { name: 'Activar demostración' });
  await expect(dialog).toBeVisible();
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox).not.toBeNull();
  expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
  expect(dialogBox!.y).toBeGreaterThanOrEqual(0);
  expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(320);
  expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(900);
  await assertCapabilityViewport(page, 320);
  await expect(dialog).toContainText('Esto no cambia tu plan');
  await expect(
    dialog.getByRole('button', { name: 'Confirmar activación', exact: true }),
  ).toBeFocused();
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Activar demostración', exact: true }),
  ).toBeFocused();
  await page.getByRole('button', { name: 'Activar demostración', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Activar demostración' })).toBeVisible();
  await page
    .getByRole('dialog', { name: 'Activar demostración' })
    .getByRole('button', { name: 'Confirmar activación', exact: true })
    .click();
  await expect(page.getByRole('status').filter({ hasText: 'Demostración activada' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Explora las capacidades propuestas' }),
  ).toBeFocused();

  await expect(inspectionCard.getByText('Demo temporal').first()).toBeVisible();
  await expect(ppeCard.getByRole('checkbox')).toBeVisible();
  await expect(
    primaryNavigation.locator('a[data-locked="true"]').filter({ hasText: 'Permisos de trabajo' }),
  ).toBeVisible();
  await expect(
    primaryNavigation.locator('a[data-locked="true"]').filter({ hasText: 'Inspecciones' }),
  ).toHaveCount(0);

  await ppeCard.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Activar demostración', exact: true }).click();
  const secondDialog = page.getByRole('dialog', { name: 'Activar demostración' });
  await expect(
    secondDialog.getByRole('button', { name: 'Confirmar activación', exact: true }),
  ).toBeFocused();
  await secondDialog.getByRole('button', { name: 'Confirmar activación', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Demostración activada' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Explora las capacidades propuestas' }),
  ).toBeFocused();
  await expect(ppeCard.getByText('Demo temporal').first()).toBeVisible();
  await expect(
    primaryNavigation.locator('a[data-locked="true"]').filter({ hasText: 'EPP' }),
  ).toHaveCount(0);
  for (const label of [
    'Permisos de trabajo',
    'Accidentes e Incidentes',
    'Capacitación',
    'Riesgo técnico',
  ]) {
    await expect(
      primaryNavigation.locator('a[data-locked="true"]').filter({ hasText: label }),
    ).toBeVisible();
  }

  const organizationAfter = await prisma.organization.findUniqueOrThrow({
    where: { id: organization.organization.id },
    include: { modules: { include: { module: true } }, subscriptions: true },
  });
  expect(organizationAfter.status).toBe('DEMO');
  const enabledModules = organizationAfter.modules
    .filter((row: { module: { key: string } }) =>
      ['INSPECTIONS_INTELLIGENCE', 'PPE'].includes(row.module.key),
    )
    .map((row: { module: { key: string }; status: string }): [string, string] => [
      row.module.key,
      row.status,
    ]);
  expect(
    enabledModules.sort((left: [string, string], right: [string, string]) =>
      left[0].localeCompare(right[0]),
    ),
  ).toEqual([
    ['INSPECTIONS_INTELLIGENCE', 'DEMO'],
    ['PPE', 'DEMO'],
  ]);
  expect(organizationAfter.subscriptions).toEqual(subscriptionsBefore);
  expect(
    await prisma.sstAssessmentSession.findUniqueOrThrow({ where: { id: assessment.id } }),
  ).toEqual(before);
});
