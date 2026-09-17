import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import type { AssessmentSession } from '../lib/sst-assessment-types';
import { createE2eOrganization } from './support/e2e-api';
import { activateE2eUserSession, registerE2eUser } from './support/register-e2e-user';

const prisma = new PrismaClient();
test.use({ timezoneId: 'America/Guayaquil' });
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

async function finalizedAdministrativeAssessment(api: APIRequestContext, page: Page) {
  const registration = await registerE2eUser({
    displayName: 'Responsable PR51',
    email: `plan-${randomUUID()}@example.test`,
    password: randomUUID() + randomUUID(),
  });
  const actor = await createE2eOrganization(api, registration, `Administración ${randomUUID()}`);
  // Two-center administrative fixture, without upgrading the FREE subscription.
  await prisma.workCenter.create({
    data: { organizationId: actor.organization.id, name: 'Oficina remota' },
  });
  const post = async (path: string, data: unknown) => {
    const response = await api.post(`http://127.0.0.1:3101/api/v1/sst-assessment${path}`, {
      headers: actor.headers,
      data,
    });
    expect(response.status(), await response.text()).toBe(201);
    return (await response.json()) as AssessmentSession;
  };
  let assessment = await post('/sessions', {});
  assessment = await post(`/sessions/${assessment.id}/answers`, {
    expectedSessionRevision: assessment.sessionRevision,
    answers: administrativeAnswers(),
  });
  assessment = await post(`/sessions/${assessment.id}/evaluate`, {
    expectedSessionRevision: assessment.sessionRevision,
  });
  expect(assessment.status).toBe('DIAGNOSIS_READY');
  assessment = await post(`/sessions/${assessment.id}/finalize`, {
    expectedSessionRevision: assessment.sessionRevision,
  });
  expect(assessment.status).toBe('FINALIZED');
  expect(assessment.result!.capabilityEvaluation!.engineVersion).toBe('1.2.0');
  expect(
    assessment.result!.capabilityEvaluation!.recommendations.map((r) => r.capabilityKey).sort(),
  ).toEqual(['GOVERNANCE', 'INSPECTIONS', 'WORKFORCE']);
  const source = await prisma.sstAssessmentSession.findUniqueOrThrow({
    where: { id: assessment.id },
  });
  const baseline = await provisioning(actor.organization.id);
  await activateE2eUserSession(page, registration, `/app/evaluation/${assessment.id}`);
  await expect(page.getByRole('link', { name: 'Crear borrador de Plan Operativo' })).toBeVisible();
  await page.getByRole('link', { name: 'Crear borrador de Plan Operativo' }).click();
  await expect(page.getByRole('heading', { name: 'Elige qué incluir en tu plan' })).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(3);
  for (const checkbox of await page.getByRole('checkbox').all())
    await expect(checkbox).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Crear borrador', exact: true })).toBeDisabled();
  await expect(page.getByText('0 capacidades seleccionadas')).toBeVisible();
  const text = await page.locator('main').innerText();
  expect(text).not.toMatch(
    /UNIFIED_SST_EVALUATION|GOVERNANCE|WORKFORCE|INSPECTIONS|sha256:|score|ruleKeys/,
  );
  await page.setViewportSize({ width: 320, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  await page.setViewportSize({ width: 1280, height: 720 });
  for (const r of assessment.result!.capabilityEvaluation!.recommendations.filter(
    (r) => r.capabilityKey !== 'WORKFORCE',
  ))
    await page.getByRole('checkbox', { name: `Incluir ${r.title} en el plan` }).check();
  await expect(page.getByText('2 capacidades seleccionadas')).toBeVisible();
  await page.getByLabel('Nombre del plan').fill('Plan revisable administrativo');
  await page.getByLabel('Inicio del período').fill('2026-09-01');
  await page.getByLabel('Fin del período').fill('2026-12-31');
  await page.getByLabel('Responsable general').selectOption(actor.session.user.id);
  return { ...actor, assessment, source, baseline };
}

async function provisioning(organizationId: string) {
  return {
    organization: await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: {
        status: true,
        demoStartedAt: true,
        demoExpiresAt: true,
        subscriptions: true,
        modules: true,
      },
    }),
    requirements: await prisma.regulatoryRequirement.count(),
    drafts: await prisma.adaptiveRuleDraft.count(),
    realRules: await prisma.adaptiveRuleVersion.count({
      where: { regulatory: true, isDemo: false, publishedAt: { not: null } },
    }),
  };
}

test('finalized administrative diagnosis → explicit subset → review new version → human activation and execution', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const f = await finalizedAdministrativeAssessment(request, page);
  await page.getByRole('button', { name: 'Crear borrador', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/plans\/[0-9a-f-]+$/);
  const planId = page.url().split('/').at(-1)!;
  await expect(page.getByText('1/9/2026 – 31/12/2026', { exact: true })).toBeVisible();
  await expect(page.getByText('Origen: Diagnóstico SST')).toHaveCount(2);
  const first = await prisma.operationalPlanVersion.findFirstOrThrow({
    where: { planId, version: 1 },
    include: { items: { orderBy: { displayOrder: 'asc' }, include: { execution: true } } },
  });
  expect(first.status).toBe('DRAFT');
  expect(first.items).toHaveLength(2);
  for (const item of first.items) {
    expect(item.startsAt).toBeNull();
    expect(item.dueAt).toBeNull();
    expect(item.responsibleUserId).toBeNull();
    expect(item.workCenterId).toBeNull();
    expect(item.frequency).toBeNull();
    expect(item.evidenceReferences).toEqual([]);
  }
  await page.getByRole('button', { name: 'Revisar y crear nueva versión', exact: true }).click();
  const dueAt = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  await page
    .getByLabel('Actividad', { exact: true })
    .first()
    .fill('Revisar inspecciones administrativas');
  await page.getByLabel('Fecha límite de actividad 1', { exact: true }).fill(dueAt);
  await page
    .getByLabel('Responsable de actividad 1', { exact: true })
    .selectOption(f.session.user.id);
  await page.getByRole('button', { name: 'Guardar nueva versión' }).click();
  await expect(page.getByText('Borrador · versión 2')).toBeVisible();
  expect(
    await prisma.operationalPlanVersion.findFirstOrThrow({
      where: { planId, version: 1 },
      include: { items: { orderBy: { displayOrder: 'asc' }, include: { execution: true } } },
    }),
  ).toEqual(first);
  const second = await prisma.operationalPlanVersion.findFirstOrThrow({
    where: { planId, version: 2 },
    include: { items: { orderBy: { displayOrder: 'asc' } } },
  });
  expect(second.status).toBe('DRAFT');
  expect(second.items[0]!.responsibleUserId).toBe(f.session.user.id);
  expect(second.items[0]!.dueAt!.toISOString()).toBe(`${dueAt}T00:00:00.000Z`);
  expect(second.provenance).toEqual(first.provenance);
  await page.getByRole('button', { name: 'Activar plan', exact: true }).click();
  await expect(page.getByText('Activo · versión 2')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Iniciar', exact: true })).toHaveCount(2);
  await page.getByRole('button', { name: 'Iniciar', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Completar', exact: true })).toHaveCount(1);
  const queue = await request.get('http://127.0.0.1:3101/api/v1/work-queue', {
    headers: f.headers,
  });
  expect(queue.status()).toBe(200);
  expect(await queue.text()).toContain(planId);
  expect(await prisma.operationalPlan.count({ where: { organizationId: f.organization.id } })).toBe(
    1,
  );
  expect(
    await prisma.sstAssessmentSession.findUniqueOrThrow({ where: { id: f.assessment.id } }),
  ).toEqual(f.source);
  expect(await provisioning(f.organization.id)).toEqual(f.baseline);
  for (const action of [
    'OPERATIONAL_PLAN_CREATED_FROM_ASSESSMENT',
    'OPERATIONAL_PLAN_VERSION_CREATED',
    'OPERATIONAL_PLAN_ACTIVATED',
  ])
    expect(
      await prisma.auditLog.count({ where: { organizationId: f.organization.id, action } }),
    ).toBe(1);
});

test('lost successful response → same idempotency key retry → exactly one draft and audit', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const f = await finalizedAdministrativeAssessment(request, page);
  const keys: string[] = [];
  await page.route('**/api/v1/operational-plans/from-assessment/*', async (route) => {
    keys.push(route.request().headers()['idempotency-key']!);
    if (keys.length === 1) {
      const response = await route.fetch();
      expect(response.status()).toBe(201);
      await route.abort('failed');
    } else await route.continue();
  });
  await page.getByRole('button', { name: 'Crear borrador', exact: true }).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('No pudimos guardar el plan');
  await expect(page.getByRole('button', { name: 'Crear borrador', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Crear borrador', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/plans\/[0-9a-f-]+$/);
  expect(keys).toHaveLength(2);
  expect(keys[1]).toBe(keys[0]);
  for (const [count, expected] of [
    [await prisma.operationalPlan.count({ where: { organizationId: f.organization.id } }), 1],
    [
      await prisma.operationalPlanVersion.count({ where: { organizationId: f.organization.id } }),
      1,
    ],
    [await prisma.operationalPlanItem.count({ where: { organizationId: f.organization.id } }), 2],
    [
      await prisma.operationalPlanItemExecution.count({
        where: { organizationId: f.organization.id },
      }),
      2,
    ],
    [
      await prisma.auditLog.count({
        where: {
          organizationId: f.organization.id,
          action: 'OPERATIONAL_PLAN_CREATED_FROM_ASSESSMENT',
        },
      }),
      1,
    ],
  ])
    expect(count).toBe(expected);
  expect(await provisioning(f.organization.id)).toEqual(f.baseline);
  expect(
    await prisma.sstAssessmentSession.findUniqueOrThrow({ where: { id: f.assessment.id } }),
  ).toEqual(f.source);
});

test('technician can create and review a draft but sees no activation control', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const f = await finalizedAdministrativeAssessment(request, page);
  await prisma.membership.updateMany({
    where: { organizationId: f.organization.id, userId: f.session.user.id },
    data: { role: 'SST_TECHNICIAN' },
  });
  await page.getByRole('button', { name: 'Crear borrador', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/plans\/[0-9a-f-]+$/);
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Revisar y crear nueva versión', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Activar plan', exact: true })).toHaveCount(0);
  expect(await provisioning(f.organization.id)).toEqual(f.baseline);
});

test('public finalized diagnosis → signup → claim two centers → authenticated handoff preserves PUBLIC origin', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto('/evaluacion-sst');
  await page.getByRole('button', { name: '2 centros', exact: true }).click();
  await page.getByRole('button', { name: 'Comenzar evaluación', exact: true }).click();
  await expect(page.locator('[data-question-id]')).toBeVisible();
  const assessment = await page.evaluate(
    async (answers) => {
      const id = localStorage.getItem('sst-assessment-session:active');
      const recovery = JSON.parse(localStorage.getItem(`sst-assessment-session:${id}`) ?? 'null');
      if (!id || !recovery?.publicToken) throw new Error('PUBLIC_SESSION_RECOVERY_MISSING');
      const path = `/api/v1/sst-assessment/public/sessions/${id}`;
      const headers = {
        'content-type': 'application/json',
        'x-assessment-token': recovery.publicToken,
      };
      const call = async (suffix: string, body?: unknown) => {
        const response = await fetch(path + suffix, {
          headers,
          ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}),
        });
        if (!response.ok) throw new Error(`PUBLIC_FIXTURE_FAILED_${response.status}`);
        return response.json() as Promise<AssessmentSession>;
      };
      const current = await call('');
      const saved = await call('/answers', {
        expectedSessionRevision: current.sessionRevision,
        answers,
      });
      const evaluated = await call('/evaluate', { expectedSessionRevision: saved.sessionRevision });
      return call('/complete', { expectedSessionRevision: evaluated.sessionRevision });
    },
    [
      {
        factKey: 'organization.country',
        scopeKey: 'organization',
        answerState: 'KNOWN',
        value: 'Ecuador',
      },
      ...administrativeAnswers(),
    ],
  );
  expect(assessment.status).toBe('FINALIZED');
  expect(
    assessment.result!.capabilityEvaluation!.recommendations.map((r) => r.capabilityKey).sort(),
  ).toEqual(['GOVERNANCE', 'INSPECTIONS', 'WORKFORCE']);
  await page.reload();
  await page.getByRole('link', { name: 'Crear cuenta y continuar' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Responsable público PR51');
  await page.getByLabel('Correo', { exact: true }).fill(`public-plan-${randomUUID()}@example.test`);
  await page.getByLabel('Contraseña', { exact: true }).fill(randomUUID() + randomUUID());
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Guarda este diagnóstico en tu empresa' }),
  ).toBeVisible();
  await page.getByRole('button', { name: /Crear nueva empresa/ }).click();
  await page
    .getByLabel('Nombre de empresa', { exact: true })
    .fill(`Administración pública ${randomUUID()}`);
  await page.getByLabel('Actividad principal', { exact: true }).fill('Servicios administrativos');
  const creationResponse = page.waitForResponse(
    (r) => r.request().method() === 'POST' && r.url().endsWith('/api/v1/organizations'),
  );
  await page.getByRole('button', { name: 'Crear empresa', exact: true }).click();
  const creation = await creationResponse;
  expect(creation.status()).toBe(201);
  const organization = (await creation.json()) as { id: string };
  await expect(
    page.getByRole('heading', { name: 'Configura los centros de trabajo' }),
  ).toBeVisible();
  for (const [index, name] of ['Oficina presencial', 'Oficina remota'].entries())
    await page.getByLabel(`Centro ${index + 1}`, { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Guardar centros y continuar', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/app/evaluation/${assessment.id}$`));
  expect(
    await page.evaluate(() => localStorage.getItem('sst-assessment-session:active')),
  ).toBeNull();
  const source = await prisma.sstAssessmentSession.findUniqueOrThrow({
    where: { id: assessment.id },
  });
  expect(source.channel).toBe('PUBLIC');
  expect(source.organizationId).toBe(organization.id);
  expect(source.claimedAt).not.toBeNull();
  expect(await prisma.workCenter.count({ where: { organizationId: organization.id } })).toBe(2);
  const baseline = await provisioning(organization.id);
  // Navigate directly after claim: the cached source still has historical channel PUBLIC.
  await page.getByRole('link', { name: 'Crear borrador de Plan Operativo' }).click();
  await expect(page.getByRole('heading', { name: 'Elige qué incluir en tu plan' })).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(3);
  for (const checkbox of await page.getByRole('checkbox').all())
    await expect(checkbox).not.toBeChecked();
  for (const r of assessment.result!.capabilityEvaluation!.recommendations.filter(
    (r) => r.capabilityKey !== 'WORKFORCE',
  ))
    await page.getByRole('checkbox', { name: `Incluir ${r.title} en el plan` }).check();
  await page.getByRole('button', { name: 'Crear borrador', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/plans\/[0-9a-f-]+$/);
  const planId = page.url().split('/').at(-1)!;
  expect(await prisma.operationalPlan.count({ where: { organizationId: organization.id } })).toBe(
    1,
  );
  const draft = await prisma.operationalPlanVersion.findFirstOrThrow({
    where: { planId },
    include: { items: true },
  });
  expect(draft.status).toBe('DRAFT');
  expect(draft.items).toHaveLength(2);
  expect(
    await prisma.sstAssessmentSession.findUniqueOrThrow({ where: { id: assessment.id } }),
  ).toEqual(source);
  expect(await provisioning(organization.id)).toEqual(baseline);
  expect(page.url()).not.toMatch(/token/i);
});
