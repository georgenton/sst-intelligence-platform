import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import {
  createE2eOrganizationProfile,
  createE2eOrganization,
  markE2eOrganizationLegacyConfigured,
  parseRegistration,
  readE2eAssessmentSetup,
} from './support/e2e-api';
import { activateE2eUserSession, registerE2eUser } from './support/register-e2e-user';

import {
  answerCurrentQuestion,
  startPublicAssessment,
  waitForAssessmentMotion,
} from './support/guided-assessment-helpers';

async function continueThroughBlockingQuestions(
  page: Page,
  testInfo?: TestInfo,
  screenshotPrefix = 'guided',
) {
  let booleanCaptured = false;
  let multiCaptured = false;
  for (let index = 0; index < 80; index += 1) {
    const review = page.getByRole('heading', { name: 'Esto es lo que entendimos de tu empresa' });
    if (await review.isVisible().catch(() => false)) return;
    const relay = page.getByRole('button', { name: /^Empezar con Centro/ });
    if (await relay.isVisible().catch(() => false)) {
      if (testInfo)
        await page.screenshot({
          path: testInfo.outputPath(`${screenshotPrefix}-center-relay-${index}.png`),
          fullPage: true,
        });
      await relay.click();
      continue;
    }
    const checkpoint = page.getByRole('button', { name: 'Todo correcto, continuar' });
    if (await checkpoint.isVisible().catch(() => false)) {
      if (testInfo)
        await page.screenshot({
          path: testInfo.outputPath(`${screenshotPrefix}-checkpoint-${index}.png`),
          fullPage: true,
        });
      await checkpoint.click();
      continue;
    }
    const question = page.locator('[data-question-id]').first();
    await expect(question).toBeVisible();
    const type = await question.getAttribute('data-question-type');
    if (testInfo && type === 'BOOLEAN' && !booleanCaptured) {
      await waitForAssessmentMotion(page);
      await page.screenshot({
        path: testInfo.outputPath(`${screenshotPrefix}-boolean.png`),
        fullPage: true,
      });
      booleanCaptured = true;
    }
    if (testInfo && type === 'MULTI_CHOICE' && !multiCaptured) {
      await waitForAssessmentMotion(page);
      await page.screenshot({
        path: testInfo.outputPath(`${screenshotPrefix}-multi-choice.png`),
        fullPage: true,
      });
      multiCaptured = true;
    }
    await answerCurrentQuestion(page);
  }
  throw new Error('ASSESSMENT_DID_NOT_REACH_REVIEW');
}

async function finalizePublicAssessment(page: Page, testInfo?: TestInfo, prefix = 'guided') {
  await continueThroughBlockingQuestions(page, testInfo, prefix);
  await expect(
    page.getByRole('heading', { name: 'Esto es lo que entendimos de tu empresa' }),
  ).toBeVisible();
  if (testInfo) {
    await waitForAssessmentMotion(page);
    await page.screenshot({ path: testInfo.outputPath(`${prefix}-review.png`), fullPage: true });
  }
  const completed = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().endsWith('/complete'),
  );
  await page.getByRole('button', { name: 'Confirmar y generar diagnóstico' }).click();
  expect((await (await completed).json()).result.capabilityEvaluation.engineVersion).toBe('1.2.0');
  await expect(page.getByText('Diagnóstico listo', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Capacidades que pueden ser pertinentes' }),
  ).toBeVisible();
  await expect(page.getByText(/No activan módulos ni cambian tu plan/)).toBeVisible();
  if (testInfo) {
    await waitForAssessmentMotion(page);
    await page.screenshot({ path: testInfo.outputPath(`${prefix}-diagnosis.png`), fullPage: true });
  }
}

async function claimReturnPath(page: Page) {
  const claimHref = await page
    .getByRole('link', { name: 'Crear cuenta y continuar' })
    .getAttribute('href');
  if (!claimHref) throw new Error('ASSESSMENT_CLAIM_PATH_MISSING');
  const next = new URL(claimHref, 'http://127.0.0.1:3100').searchParams.get('next');
  if (!next) throw new Error('ASSESSMENT_CLAIM_RETURN_PATH_MISSING');
  return next;
}

async function expectFinalizedContextReadOnly(page: Page) {
  const contextGroup = page
    .locator('.assessment-context--desktop .assessment-context__groups > button')
    .first();
  if ((await contextGroup.count()) === 0) {
    await expect(
      page.getByRole('button', { name: 'Corregir' }).filter({ visible: true }),
    ).toHaveCount(0);
    return;
  }
  await contextGroup.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Corregir' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Cerrar contexto' }).click();
}

async function configureAndClaim(
  page: Page,
  organizationName: string | null,
  centerNames: string[],
  testInfo?: TestInfo,
  simulateLostClaimResponse = false,
) {
  await expect(
    page.getByRole('heading', { name: 'Guarda este diagnóstico en tu empresa' }),
  ).toBeVisible();
  if (organizationName) {
    await page.getByRole('button', { name: /Crear nueva empresa/ }).click();
    await page.getByLabel('Nombre de empresa').fill(organizationName);
    const activity = page.getByLabel('Actividad principal');
    if (await activity.isVisible()) await activity.fill('Manufactura sintética');
    const createdOrganizationResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().endsWith('/api/v1/organizations') &&
        response.status() === 201,
    );
    await page.getByRole('button', { name: 'Crear empresa' }).click();
    const createdOrganization = (await (await createdOrganizationResponse).json()) as {
      id: string;
    };
    await expect(
      page.getByRole('heading', { name: 'Configura los centros de trabajo' }),
    ).toBeVisible();
    for (let index = 0; index < centerNames.length; index += 1) {
      await page.getByLabel(`Centro ${index + 1}`).fill(centerNames[index]!);
    }
    let claimResponse: Promise<number>;
    if (simulateLostClaimResponse) {
      let resolveClaimResponse!: (status: number) => void;
      claimResponse = new Promise((resolve) => {
        resolveClaimResponse = resolve;
      });
      await page.route(
        '**/claim-new-organization',
        async (route) => {
          const response = await route.fetch();
          resolveClaimResponse(response.status());
          await route.abort('failed');
        },
        { times: 1 },
      );
    } else {
      claimResponse = page
        .waitForResponse(
          (response) =>
            response.request().method() === 'POST' &&
            response.url().endsWith('/claim-new-organization'),
        )
        .then((response) => response.status());
    }
    await page.getByRole('button', { name: 'Guardar centros y continuar' }).click();
    expect(await claimResponse).toBe(201);
    if (simulateLostClaimResponse) await page.reload();
    await expect(page).toHaveURL(/\/app\/evaluation\/[0-9a-f-]+$/);
    if (simulateLostClaimResponse) {
      const claimedSessionId = page.url().split('/').at(-1)!;
      expect(
        await page.evaluate((id) => {
          return {
            active: window.localStorage.getItem('sst-assessment-session:active'),
            record: window.localStorage.getItem(`sst-assessment-session:${id}`),
          };
        }, claimedSessionId),
      ).toEqual({ active: null, record: null });
      expect(page.url()).not.toContain('token');
    }
    await expect(page.getByText('Diagnóstico listo', { exact: true })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toHaveCount(0);
    return createdOrganization.id;
  } else {
    await page
      .locator('.assessment-company-option')
      .filter({ hasNotText: 'Crear nueva empresa' })
      .first()
      .click();
  }
  await expect(page.getByRole('heading', { name: 'Confirma la correspondencia' })).toBeVisible();
  const mappingSelects = page.locator('.assessment-preflight-card select');
  await expect(mappingSelects).toHaveCount(centerNames.length);
  for (let index = 0; index < centerNames.length; index += 1) {
    await mappingSelects.nth(index).selectOption({ label: centerNames[index] });
  }
  if (testInfo) {
    await waitForAssessmentMotion(page);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.screenshot({
      path: testInfo.outputPath('09-public-claim-mapping.png'),
      fullPage: true,
    });
  }
  await page.getByRole('button', { name: 'Confirmar y vincular diagnóstico' }).click();
  await expect(page).toHaveURL(/\/app\/evaluation\/[0-9a-f-]+$/);
  await expect(page.getByText('Diagnóstico listo', { exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toHaveCount(0);
  return null;
}

test('guided setup keeps multi-center context human, editable and capability-safe', async ({
  page,
}, testInfo) => {
  test.setTimeout(300_000);
  await page.goto('/evaluacion-sst');
  await expect(
    page.getByRole('heading', { name: '¿Cuántos centros de trabajo quieres evaluar ahora?' }),
  ).toBeVisible();
  const baseSetup = page.getByRole('link', {
    name: 'Prefiero empezar y configurar después',
  });
  await expect(baseSetup).toHaveAttribute(
    'href',
    /\/auth\/register\?next=.*app%2Forganizations.*setup%3Dbase/,
  );
  await page.getByRole('button', { name: '2 centros' }).click();
  await expect(page.getByText('2 centros incluidos en esta evaluación.')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('cloud-entry-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Comenzar evaluación' }).click();

  const answerText = async (value: string) => {
    const questionId = await page.locator('[data-question-id]').getAttribute('data-question-id');
    await page.getByLabel('Respuesta', { exact: true }).fill(value);
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    if (questionId) await expect(page.locator(`[data-question-id="${questionId}"]`)).toHaveCount(0);
  };
  await expect(
    page.locator('[data-question-id="organization:organization.country"]'),
  ).toBeVisible();
  await expect(page.getByLabel('Respuesta', { exact: true })).toHaveAttribute(
    'autocomplete',
    'country-name',
  );
  await answerText('Colombia');
  await expect(page.locator('.assessment-progress li[data-state="active"]')).toContainText(
    'Empresa',
  );
  await page.getByRole('button', { name: 'Todo correcto, continuar' }).click();
  const workerCountInput = page.getByLabel('Respuesta numérica');
  await workerCountInput.fill('-1');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(workerCountInput).toHaveAttribute('aria-invalid', 'true');
  await expect(workerCountInput).toHaveAttribute('aria-describedby', /-error$/);
  await expect(workerCountInput).toBeFocused();
  await expect(page.locator('[data-question-id]').getByRole('alert')).toContainText(
    'Ingresa un número entero',
  );
  await workerCountInput.fill('60');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByRole('button', { name: 'Todo correcto, continuar' }).click();

  await expect(
    page.locator('.assessment-question__scope').getByText('Centro 1 de 2', { exact: true }),
  ).toBeVisible();
  await waitForAssessmentMotion(page);
  await page.screenshot({
    path: testInfo.outputPath('cloud-question-center-1.png'),
    fullPage: true,
  });
  const presencial = page.getByRole('radio', { name: 'Presencial', exact: true });
  const remota = page.getByRole('radio', { name: 'Remota', exact: true });
  const presencialCard = page.locator('label.assessment-option').filter({ hasText: 'Presencial' });
  const remotaCard = page.locator('label.assessment-option').filter({ hasText: 'Remota' });
  for (const card of [presencialCard, remotaCard]) {
    const box = await card.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await expect(card.locator('.assessment-option__label')).toBeVisible();
  }
  await presencial.check();
  await expect(presencial).toBeChecked();
  const clickCenter = async (locator: Locator) => {
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
  };
  await clickCenter(remotaCard.locator('.assessment-option__marker'));
  await expect(remota).toBeChecked();
  await clickCenter(presencialCard.locator('.assessment-option__label'));
  await expect(presencial).toBeChecked();
  await clickCenter(remotaCard);
  await expect(remota).toBeChecked();
  await presencial.focus();
  await page.keyboard.press('Space');
  await expect(presencial).toBeChecked();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ahora revisaremos Centro 2' })).toBeFocused();
  await waitForAssessmentMotion(page);
  await page.screenshot({ path: testInfo.outputPath('cloud-center-relay.png'), fullPage: true });
  await page.getByRole('button', { name: 'Empezar con Centro 2' }).click();
  await expect(
    page.locator('.assessment-question__scope').getByText('Centro 2 de 2', { exact: true }),
  ).toBeVisible();
  const secondCenterScope = page.locator('.assessment-question__scope');
  await expect(secondCenterScope).toContainText('Centro 2 de 2');
  await expect(secondCenterScope).toContainText('Completemos el contexto de este centro');
  const remoteQuestionId = await page
    .locator('[data-question-id]')
    .getAttribute('data-question-id');
  await page.getByRole('radio', { name: 'Remota', exact: true }).check();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  if (remoteQuestionId)
    await expect(page.locator(`[data-question-id="${remoteQuestionId}"]`)).toHaveCount(0);

  const organizationContext = page
    .locator('.assessment-context--desktop .assessment-context__groups > button')
    .filter({ hasText: 'Organización' });
  await expect(organizationContext.locator('.assessment-context__count')).toHaveAttribute(
    'aria-label',
    /\d+ datos confirmados/,
  );
  await organizationContext.click();
  const contextDialog = page.getByRole('dialog', { name: 'Organización' });
  await expect(contextDialog).toContainText('Colombia');
  await page.screenshot({ path: testInfo.outputPath('cloud-context-drawer.png'), fullPage: true });
  await contextDialog
    .locator('.assessment-context__facts > div')
    .filter({ hasText: 'País' })
    .getByRole('button', { name: 'Corregir' })
    .click();
  await expect(
    page.locator('[data-question-id="organization:organization.country"]'),
  ).toBeVisible();
  await answerText('Ecuador');
  await expect(
    page
      .locator('.assessment-context--desktop .assessment-context__change')
      .filter({ hasText: /Actualizado:.*Ecuador/ })
      .first(),
  ).toBeVisible();
  const checkpoint = page.getByRole('button', { name: 'Todo correcto, continuar' });
  if (await checkpoint.isVisible().catch(() => false)) await checkpoint.click();

  const fixtureFacts = [
    ['organization.country', 'organization', 'Ecuador'],
    ['organization.totalWorkerCount', 'organization', 60],
    ['organization.managementSystem', 'organization', 'SPREADSHEETS'],
    ['organization.inspectionPractice', 'organization', 'CHECKLISTS'],
    ['organization.inspectionFrequency', 'organization', 'MONTHLY'],
    ['organization.manualPermits', 'organization', false],
    ['organization.evidenceDifficulty', 'organization', true],
    ['organization.overdueActions', 'organization', true],
    ['organization.recurringFindings', 'organization', true],
    ['organization.hasExistingSstWorkPlan', 'organization', false],
    ['organization.multipleShifts', 'organization', false],
    ['organization.psychosocialReviewNeeded', 'organization', false],
    ['organization.stressExposedRolesPresent', 'organization', false],
    [
      'organization.strategicProtectionPriorities',
      'organization',
      ['PEOPLE_AND_HEALTH', 'PRODUCTIVE_CONTINUITY'],
    ],
    ['workCenter.workerCount', 'center:1', 40],
    ['workCenter.workArrangement', 'center:1', 'PHYSICAL'],
    ['workCenter.activityCategories', 'center:1', ['ADMINISTRATIVE_SERVICES']],
    ['workCenter.facilityTypes', 'center:1', ['OFFICE']],
    ['workCenter.activityDescription', 'center:1', 'Operación administrativa presencial'],
    ['workCenter.workerCount', 'center:2', 20],
    ['workCenter.workArrangement', 'center:2', 'REMOTE'],
    ['workCenter.activityCategories', 'center:2', ['ADMINISTRATIVE_SERVICES']],
    ['workCenter.activityDescription', 'center:2', 'Operación administrativa remota'],
    ...(['center:1', 'center:2'] as const).flatMap((scopeKey) =>
      [
        'workCenter.hasDistinctOperationalZones',
        'workCenter.hasChemicalProcesses',
        'workCenter.hasHighEnergyOperations',
        'workCenter.hasWorkAtHeight',
        'workCenter.hasHotWork',
        'workCenter.hasElectricalWorkOrExposure',
        'workCenter.hasConfinedSpaces',
        'workCenter.hasExternalWorkforce',
        'workCenter.hasCriticalMachinery',
        'workCenter.hasDriversOrTransport',
        'workCenter.hasFireExposure',
      ].map((factKey) => [factKey, scopeKey, false]),
    ),
  ];
  const evaluated = await page.evaluate(async (facts) => {
    const sessionId = window.localStorage.getItem('sst-assessment-session:active');
    if (!sessionId) throw new Error('ASSESSMENT_SESSION_MISSING');
    const record = JSON.parse(
      window.localStorage.getItem(`sst-assessment-session:${sessionId}`) ?? 'null',
    ) as { publicToken?: string } | null;
    if (!record?.publicToken) throw new Error('ASSESSMENT_TOKEN_MISSING');
    const path = `/api/v1/sst-assessment/public/sessions/${sessionId}`;
    const headers = {
      'content-type': 'application/json',
      'x-assessment-token': record.publicToken,
    };
    const current = (await (await fetch(path, { headers })).json()) as {
      sessionRevision: number;
    };
    const saved = (await (
      await fetch(`${path}/answers`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          expectedSessionRevision: current.sessionRevision,
          answers: facts.map(([factKey, scopeKey, value]) => ({
            factKey,
            scopeKey,
            answerState: 'KNOWN',
            value,
          })),
        }),
      })
    ).json()) as { sessionRevision: number };
    return (await (
      await fetch(`${path}/evaluate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ expectedSessionRevision: saved.sessionRevision }),
      })
    ).json()) as {
      status: string;
      sessionRevision: number;
      questions: Array<{ factKey: string; collectionPolicy: string }>;
      result: {
        capabilityEvaluation: {
          engineVersion: string;
          recommendations: Array<{ capabilityKey: string }>;
        };
      };
    };
  }, fixtureFacts);
  expect(evaluated.status).toBe('DIAGNOSIS_READY');
  expect(
    evaluated.questions.some(({ collectionPolicy }) => collectionPolicy === 'COMMERCIAL_OPTIONAL'),
  ).toBe(false);
  expect(evaluated.result.capabilityEvaluation.engineVersion).toBe('1.2.0');
  expect(
    evaluated.result.capabilityEvaluation.recommendations
      .map(({ capabilityKey }) => capabilityKey)
      .sort(),
  ).toEqual(['GOVERNANCE', 'INSPECTIONS', 'WORKFORCE']);

  await page.reload();
  await expect(
    page.getByText('Información mínima para el diagnóstico completada').first(),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-readiness-announcement="true"]')).toHaveCount(0);
  await expect(page.locator('.assessment-review__notice[role="status"]')).toContainText(
    'No podemos comparar todavía estas magnitudes',
  );
  await expect(page.getByRole('button', { name: 'Aclarar datos de personas' })).toBeVisible();
  await expect(page.getByText(/Objetivos que buscas con la plataforma/i)).toHaveCount(0);
  await page.getByRole('button', { name: 'Añadir contexto opcional' }).click();
  await expect(page.locator('[data-question-id]')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Terminar contexto adicional y volver a la revisión' }),
  ).toBeVisible();
  const unknownQuestionId = await page
    .locator('[data-question-id]')
    .getAttribute('data-question-id');
  const unknownRadio = page.getByRole('radio', { name: 'No lo sé', exact: true });
  if (await unknownRadio.count()) {
    await unknownRadio.check();
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  } else await page.getByRole('button', { name: 'No lo sé', exact: true }).click();
  await expect(page.getByRole('status')).toContainText(/Respuesta guardada|Guardado en Centro/);
  if (await checkpoint.isVisible().catch(() => false)) await checkpoint.click();
  const deferredQuestionId = await page
    .locator('[data-question-id]')
    .getAttribute('data-question-id');
  await page.getByRole('button', { name: 'Responder después' }).click();
  await page
    .getByRole('button', { name: 'Terminar contexto adicional y volver a la revisión' })
    .click();
  const states = await page.evaluate(
    async ({ unknownQuestionId, deferredQuestionId }) => {
      const sessionId = window.localStorage.getItem('sst-assessment-session:active')!;
      const record = JSON.parse(
        window.localStorage.getItem(`sst-assessment-session:${sessionId}`)!,
      ) as { publicToken: string };
      const response = await fetch(`/api/v1/sst-assessment/public/sessions/${sessionId}`, {
        headers: { 'x-assessment-token': record.publicToken },
      });
      const current = (await response.json()) as {
        snapshot: { facts: Array<{ scopeKey: string; factKey: string; answerState: string }> };
      };
      const identityState = (identity: string | null) =>
        current.snapshot.facts.find(
          ({ scopeKey, factKey }) => `${scopeKey}:${factKey}` === identity,
        )?.answerState;
      return {
        unknown: identityState(unknownQuestionId),
        deferred: identityState(deferredQuestionId),
      };
    },
    { unknownQuestionId, deferredQuestionId },
  );
  expect(states).toEqual({ unknown: 'EXPLICIT_UNKNOWN', deferred: undefined });

  await page.getByRole('button', { name: 'Confirmar y generar diagnóstico' }).click();
  await expect(page.getByText('Diagnóstico listo', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Personas y trabajadores' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Inspecciones inteligentes' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Gobernanza SST' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Permisos de trabajo' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Accidentes e incidentes' })).toHaveCount(0);
});

test('public guided assessment resumes, registers, claims and starts an immutable reassessment', async ({
  page,
}, testInfo) => {
  test.setTimeout(300_000);
  const suffix = Date.now();
  await page.goto('/');
  const entry = page.getByRole('link', { name: 'Evaluar mi empresa' });
  await expect(entry).toHaveAttribute('href', '/evaluacion-sst');
  await entry.click();
  await page.getByRole('button', { name: '1 centro' }).click();
  await page.getByRole('button', { name: 'Comenzar evaluación' }).click();
  await expect(page.locator('[data-question-id]')).toBeVisible();
  await waitForAssessmentMotion(page);
  await page.screenshot({
    path: testInfo.outputPath('01-public-first-question-desktop.png'),
    fullPage: true,
  });

  await answerCurrentQuestion(page);
  const sessionPath = page.url();
  expect(sessionPath).not.toContain('token');
  await page.reload();
  await expect(page.locator('[data-question-id]')).toBeVisible();
  await expect(page).toHaveURL(sessionPath);
  await waitForAssessmentMotion(page);
  await page.screenshot({
    path: testInfo.outputPath('04-desktop-context-panel.png'),
    fullPage: true,
  });
  await page.screenshot({ path: testInfo.outputPath('10-grouped-progress.png'), fullPage: true });
  await finalizePublicAssessment(page, testInfo, 'public');
  await expectFinalizedContextReadOnly(page);
  const workforceCapability = page
    .locator('.assessment-capability-grid article')
    .filter({ has: page.getByRole('heading', { name: 'Personas y trabajadores' }) });
  await workforceCapability.getByText('Ver trazabilidad de la recomendación').click();
  await expect(workforceCapability.getByText('Información aún pendiente:')).toBeVisible();
  await expect(
    workforceCapability.getByText(
      'Empresa: La organización opera en múltiples turnos — Aún sin respuesta',
    ),
  ).toBeVisible();
  await expect(workforceCapability.getByText(/puntaje|score|riesgo técnico/i)).toHaveCount(0);
  const foundationCard = page
    .locator('.assessment-result-group article')
    .filter({ has: page.getByText('Datos utilizados') })
    .first();
  if ((await foundationCard.count()) > 0) {
    await foundationCard.getByText('Ver fundamento profesional').click();
    await expect(foundationCard.getByText('Datos utilizados')).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath('06-professional-foundation-expanded.png'),
      fullPage: true,
    });
  }
  await page.getByRole('link', { name: 'Crear cuenta y continuar' }).click();
  await expect(page).toHaveURL(/\/auth\/register\?next=/);
  expect(page.url()).not.toContain('publicToken');
  expect(page.url()).not.toContain('token=');
  await page.getByLabel('Nombre').fill('Owner Evaluación E2E');
  await page.getByLabel('Correo').fill(`guided-owner-${suffix}@example.test`);
  await page.getByLabel('Contraseña').fill('guided-assessment-password-123');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await configureAndClaim(page, `Empresa guiada ${suffix}`, ['Planta Norte']);
  await expect(page.getByRole('heading', { name: 'Historial de evaluaciones' })).toBeVisible();
  await expectFinalizedContextReadOnly(page);
  const finalizedUrl = page.url();
  await page.getByRole('button', { name: 'Reevaluar empresa' }).click();
  await expect(page).not.toHaveURL(finalizedUrl);
  const reassessmentUrl = page.url();
  await expect(
    page
      .getByText(
        /Usaremos lo que ya sabemos|Conozcamos cómo funciona tu empresa|Revisa antes de finalizar/,
      )
      .first(),
  ).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(reassessmentUrl);
  await expect(
    page
      .getByText(
        /Usaremos lo que ya sabemos|Conozcamos cómo funciona tu empresa|Revisa antes de finalizar/,
      )
      .first(),
  ).toBeVisible();
});

test('two and three center public assessments provision real FREE setup topology without paid capacity', async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(600_000);
  const suffix = Date.now();
  for (const centerCount of [2, 3] as const) {
    await startPublicAssessment(page, centerCount);
    await finalizePublicAssessment(page);
    const registration = await registerE2eUser({
      displayName: `Owner ${centerCount} centros E2E`,
      email: `guided-multi-${centerCount}-${suffix}@example.test`,
      password: 'guided-multicenter-password-123',
    });
    expect(registration.statusCode, registration.body).toBe(201);
    const next = await claimReturnPath(page);
    await activateE2eUserSession(page, registration, next);
    const centerNames =
      centerCount === 2
        ? ['Planta Principal', 'Bodega Sur']
        : Array.from(
            { length: centerCount },
            (_, index) => `Centro ${centerCount}-${index + 1} ${suffix}`,
          );
    const organizationId = await configureAndClaim(
      page,
      `Empresa ${centerCount} centros ${suffix}`,
      centerNames,
      centerCount === 2 ? testInfo : undefined,
      centerCount === 2,
    );
    if (!organizationId) throw new Error('NEW_ORGANIZATION_ID_MISSING');
    const setup = await readE2eAssessmentSetup(organizationId);
    expect(setup.planKeys).toEqual(['FREE']);
    expect(setup.moduleKeys).toEqual(['CORE']);
    expect(setup.centers.map((center: { name: string }) => center.name).sort()).toEqual(
      [...centerNames].sort(),
    );
    expect(setup.profiles).toHaveLength(1);
    expect(setup.profiles[0]?.snapshot).toMatchObject({
      schemaVersion: '2.0.0',
      organization: { workCenterCount: centerCount },
    });
    const session = setup.sessions.find(
      (candidate: { status: string }) => candidate.status === 'FINALIZED',
    );
    expect(session).toBeTruthy();
    const setupResponse = await request.get(
      'http://127.0.0.1:3101/api/v1/sst-assessment/setup-state',
      {
        headers: {
          authorization: `Bearer ${parseRegistration(registration).accessToken}`,
          'x-organization-id': organizationId,
        },
      },
    );
    expect(setupResponse.status()).toBe(200);
    expect(await setupResponse.json()).toMatchObject({
      state: 'DIAGNOSIS_READY',
      hardGate: true,
      assessmentId: session?.id,
    });
    if (centerCount === 2) {
      await page.locator('.assessment-result-group details').evaluateAll((details) => {
        details.forEach((detail) => {
          (detail as HTMLDetailsElement).open = true;
        });
      });
      const context = page.locator('.assessment-context--desktop');
      await expect(context.getByText('Planta Principal', { exact: true }).first()).toBeVisible();
      await expect(context.getByText('Bodega Sur', { exact: true }).first()).toBeVisible();
      expect(
        await page
          .locator('.assessment-result-group details dd')
          .filter({ hasText: 'Planta Principal' })
          .count(),
      ).toBeGreaterThan(0);
      await expect(page.getByText('center:1', { exact: true })).toHaveCount(0);
      await expect(page.getByText('center:2', { exact: true })).toHaveCount(0);
      await expect(page.getByText('Centro 1', { exact: true })).toHaveCount(0);
      await expect(page.getByText('Centro 2', { exact: true })).toHaveCount(0);

      const historicalCenter = setup.centers.find(
        (center: { name: string }) => center.name === 'Planta Principal',
      );
      if (!historicalCenter) throw new Error('HISTORICAL_WORK_CENTER_MISSING');
      const renamed = await request.patch(
        `http://127.0.0.1:3101/api/v1/organizations/${organizationId}/work-centers/${historicalCenter.id}`,
        {
          headers: {
            authorization: `Bearer ${parseRegistration(registration).accessToken}`,
            'x-organization-id': organizationId,
          },
          data: { name: 'Planta Principal Renovada' },
        },
      );
      expect(renamed.status(), await renamed.text()).toBe(200);
      await page.reload();
      await expect(page.getByText('Diagnóstico listo', { exact: true })).toBeVisible();
      await expect(
        page
          .locator('.assessment-context--desktop')
          .getByText('Planta Principal', { exact: true })
          .first(),
      ).toBeVisible();
      await expect(page.getByText('Planta Principal Renovada', { exact: true })).toHaveCount(0);
    }
  }
});

test('a user without organizations sees setup shell and private children never request data', async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(120_000);
  const suffix = Date.now();
  const registration = await registerE2eUser({
    displayName: 'Owner Setup Gate E2E',
    email: `guided-gate-${suffix}@example.test`,
    password: 'guided-gate-password-123',
  });
  expect(registration.statusCode, registration.body).toBe(201);
  await activateE2eUserSession(page, registration);
  await expect(
    page.getByRole('heading', { name: '¿Cuántos centros de trabajo quieres evaluar ahora?' }),
  ).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Centro de comando' })).toHaveCount(0);
  await waitForAssessmentMotion(page);
  await page.screenshot({
    path: testInfo.outputPath('07-authenticated-setup-shell.png'),
    fullPage: true,
  });

  const created = await createE2eOrganization(
    request,
    registration,
    `Empresa incompleta ${suffix}`,
  );
  let inspectionRequests = 0;
  page.on('request', (outgoing) => {
    if (/\/api\/v1\/inspections(?:\?|$)/.test(outgoing.url())) inspectionRequests += 1;
  });
  await page.evaluate(
    ({ userId, organizationId }) => {
      window.localStorage.setItem(`sst:active-organization:${userId}`, organizationId);
    },
    { userId: created.session.user.id, organizationId: created.organization.id },
  );
  await page.goto('/app/inspections');
  await expect(
    page.getByRole('heading', { name: 'Conozcamos primero cómo funciona tu empresa.' }),
  ).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toHaveCount(0);
  expect(inspectionRequests).toBe(0);
});

test('a substantive legacy organization keeps normal app access during and after canonical adoption', async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(360_000);
  const suffix = Date.now();
  const registration = await registerE2eUser({
    displayName: 'Owner Legacy Adoption E2E',
    email: `guided-legacy-${suffix}@example.test`,
    password: 'guided-legacy-password-123',
  });
  const prepared = await createE2eOrganization(request, registration, `Empresa legacy ${suffix}`);
  await markE2eOrganizationLegacyConfigured(prepared.organization.id, prepared.session.user.id);
  await activateE2eUserSession(page, registration);
  await page.evaluate(
    ({ userId, organizationId }) => {
      window.localStorage.setItem(`sst:active-organization:${userId}`, organizationId);
    },
    { userId: prepared.session.user.id, organizationId: prepared.organization.id },
  );

  await page.goto('/app');
  await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Evaluación SST', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('09-legacy-app-access.png'), fullPage: true });

  await page.goto('/app/evaluation');
  await page.getByRole('button', { name: 'Comenzar entrevista' }).click();
  await expect(page).toHaveURL(/\/app\/evaluation\/[0-9a-f-]+$/);
  const assessmentUrl = page.url();
  await page.goto('/app');
  await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible();

  await page.goto(assessmentUrl);
  await page.getByRole('link', { name: 'Empresa' }).click();
  await expect(page).toHaveURL(/\/app\/organizations$/);
  await expect(page.getByText('No pudimos recuperar esta evaluación')).toHaveCount(0);
  await page.goto(assessmentUrl);
  await continueThroughBlockingQuestions(page);
  await page.getByRole('button', { name: 'Confirmar y generar diagnóstico' }).click();
  await expect(page.getByText('Diagnóstico listo', { exact: true })).toBeVisible();

  await page.goto('/app');
  await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible();
});

test('organization switch discards the previous assessment route before loading the new tenant', async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  const suffix = Date.now();
  const registration = await registerE2eUser({
    displayName: 'Owner Assessment Switch E2E',
    email: `guided-switch-${suffix}@example.test`,
    password: 'guided-switch-password-123',
  });
  const organizationA = await createE2eOrganization(request, registration, `Empresa A ${suffix}`);
  const organizationB = await createE2eOrganization(request, registration, `Empresa B ${suffix}`);
  await activateE2eUserSession(page, registration);
  await page.evaluate(
    ({ userId, organizationId }) => {
      window.localStorage.setItem(`sst:active-organization:${userId}`, organizationId);
    },
    { userId: organizationA.session.user.id, organizationId: organizationA.organization.id },
  );
  await page.goto('/app/evaluation');
  await page.getByRole('button', { name: 'Comenzar entrevista' }).click();
  await expect(page).toHaveURL(/\/app\/evaluation\/[0-9a-f-]+$/);
  const sessionA = page.url().split('/').at(-1)!;
  let crossTenantSessionRequests = 0;
  page.on('request', (outgoing) => {
    if (
      outgoing.url().includes(`/sst-assessment/sessions/${sessionA}`) &&
      outgoing.headers()['x-organization-id'] === organizationB.organization.id
    ) {
      crossTenantSessionRequests += 1;
    }
  });

  await page
    .getByRole('combobox', { name: 'Organización activa' })
    .selectOption(organizationB.organization.id);
  await expect(page).toHaveURL(/\/app\/evaluation$/);
  await expect(
    page.getByRole('heading', { name: 'Prepara la evaluación de tu empresa' }),
  ).toBeVisible();
  expect(crossTenantSessionRequests).toBe(0);
});

test('claim destination can change organizations and existing topology remains mapping-only', async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(420_000);
  const suffix = Date.now();
  await startPublicAssessment(page, 1);
  await finalizePublicAssessment(page);
  const firstClaimPath = await claimReturnPath(page);
  const registration = await registerE2eUser({
    displayName: 'Owner Claim Choice E2E',
    email: `guided-claim-choice-${suffix}@example.test`,
    password: 'guided-claim-choice-password-123',
  });
  const organizationA = await createE2eOrganization(request, registration, `Empresa A ${suffix}`);
  const organizationB = await createE2eOrganization(request, registration, `Empresa B ${suffix}`);
  await activateE2eUserSession(page, registration);
  await page.evaluate(
    ({ userId, organizationId }) => {
      window.localStorage.setItem(`sst:active-organization:${userId}`, organizationId);
    },
    { userId: organizationA.session.user.id, organizationId: organizationA.organization.id },
  );
  await page.goto(firstClaimPath);
  await expect(page.getByRole('heading', { name: 'Elige dónde guardarlo' })).toBeVisible();
  await waitForAssessmentMotion(page);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.screenshot({
    path: testInfo.outputPath('07-claim-destination-chooser.png'),
    fullPage: true,
  });
  await page
    .locator('.assessment-company-option')
    .filter({ hasText: organizationB.organization.name })
    .click();
  await expect(page.getByRole('combobox', { name: 'Organización activa' })).toHaveValue(
    organizationB.organization.id,
  );
  await expect(page.getByRole('heading', { name: 'Confirma la correspondencia' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Configura los centros de trabajo' })).toHaveCount(
    0,
  );
  await page.setViewportSize({ width: 1280, height: 1280 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await waitForAssessmentMotion(page);
  await page.mouse.click(1100, 1000);
  const skipLink = page.getByRole('link', { name: 'Saltar al contenido principal' });
  await skipLink.evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished));
  });
  const skipLinkBox = await skipLink.boundingBox();
  expect((skipLinkBox?.y ?? 0) + (skipLinkBox?.height ?? 0)).toBeLessThanOrEqual(0);
  await page.screenshot({
    path: testInfo.outputPath('08-existing-company-mapping-only.png'),
  });
  await page
    .locator('.assessment-preflight-card select')
    .selectOption({ label: 'Centro principal' });
  await page.getByRole('button', { name: 'Confirmar y vincular diagnóstico' }).click();
  await expect(page).toHaveURL(/\/app\/evaluation\/[0-9a-f-]+$/);

  await startPublicAssessment(page, 2);
  await finalizePublicAssessment(page);
  const secondClaimPath = await claimReturnPath(page);
  await page.goto(secondClaimPath);
  let workCenterWrites = 0;
  page.on('request', (outgoing) => {
    if (
      /\/work-centers(?:\/[^/?]+)?(?:\?|$)/.test(outgoing.url()) &&
      ['POST', 'PATCH'].includes(outgoing.method())
    ) {
      workCenterWrites += 1;
    }
  });
  await page
    .locator('.assessment-company-option')
    .filter({ hasText: organizationA.organization.name })
    .click();
  await expect(page.getByRole('combobox', { name: 'Organización activa' })).toHaveValue(
    organizationA.organization.id,
  );
  await expect(
    page.getByRole('heading', { name: 'Revisa el alcance de los centros' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmar y vincular diagnóstico' })).toHaveCount(
    0,
  );
  expect(workCenterWrites).toBe(0);
  await page.getByRole('button', { name: 'Elegir otra empresa' }).click();
  await expect(page.getByRole('heading', { name: 'Elige dónde guardarlo' })).toBeVisible();
  await page.getByRole('button', { name: /Crear nueva empresa/ }).click();
  await expect(page.getByRole('heading', { name: 'Crea la empresa' })).toBeVisible();
});

test('existing profile reconciliation stays human, explicit and mutation-free', async ({
  page,
  request,
}) => {
  test.setTimeout(360_000);
  const suffix = Date.now();
  await startPublicAssessment(page, 1);
  await finalizePublicAssessment(page);
  const claimPath = await claimReturnPath(page);
  const registration = await registerE2eUser({
    displayName: 'Owner Reconciliation E2E',
    email: `guided-reconciliation-${suffix}@example.test`,
    password: 'guided-reconciliation-password-123',
  });
  const prepared = await createE2eOrganization(
    request,
    registration,
    `Empresa reconciliación ${suffix}`,
  );
  await createE2eOrganizationProfile(prepared.organization.id, prepared.session.user.id, 99);
  const before = await readE2eAssessmentSetup(prepared.organization.id);
  await activateE2eUserSession(page, registration, claimPath);
  await page
    .locator('.assessment-company-option')
    .filter({ hasText: prepared.organization.name })
    .click();
  await page
    .locator('.assessment-preflight-card select')
    .selectOption({ label: 'Centro principal' });
  await page.getByRole('button', { name: 'Confirmar y vincular diagnóstico' }).click();

  const reconciliation = page
    .locator('.assessment-preflight-card')
    .filter({ hasText: 'Necesitamos revisar una diferencia antes de vincular' });
  await expect(reconciliation).toBeVisible();
  await expect(reconciliation.getByText('Número total de personas trabajadoras')).toBeVisible();
  const after = await readE2eAssessmentSetup(prepared.organization.id);
  expect(after.organization).toEqual(before.organization);
  expect(after.centers).toEqual(before.centers);
  expect(after.profiles).toEqual(before.profiles);
  expect(after.sessions).toEqual(before.sessions);

  await reconciliation.getByRole('button', { name: 'Elegir otra empresa' }).click();
  await expect(page.getByRole('heading', { name: 'Elige dónde guardarlo' })).toBeVisible();
});

test('mobile guided question has no horizontal overflow and keeps its context accessible', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await startPublicAssessment(page, 1);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  const question = page.locator('[data-question-id]');
  const contextTrigger = page.getByRole('button', { name: /^Contexto · \d+ datos?$/ });
  await expect(question).toBeVisible();
  await expect(contextTrigger).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Tu evaluación' })).not.toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const questionBox = await question.boundingBox();
  const triggerBox = await contextTrigger.boundingBox();
  expect(questionBox?.y).toBeLessThan(triggerBox?.y ?? 0);
  await waitForAssessmentMotion(page);
  await page.screenshot({
    path: testInfo.outputPath('03-mobile-context-closed.png'),
    fullPage: true,
  });
  await contextTrigger.click();
  const dialog = page.getByRole('dialog', { name: 'Tu evaluación' });
  await expect(dialog).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('04-mobile-context-open.png'),
    fullPage: true,
  });
  await expect
    .poll(() => dialog.evaluate((element) => element.contains(document.activeElement)))
    .toBe(true);
  await page.keyboard.press('Shift+Tab');
  await expect
    .poll(() => dialog.evaluate((element) => element.contains(document.activeElement)))
    .toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(contextTrigger).toBeFocused();
  await answerCurrentQuestion(page);
  const checkpoint = page.getByRole('button', { name: 'Todo correcto, continuar' });
  if (await checkpoint.isVisible()) await checkpoint.click();
  await expect(question).toBeVisible();
  await contextTrigger.click();
  await dialog
    .locator('.assessment-context__facts > div')
    .filter({ hasText: 'País' })
    .getByRole('button', { name: 'Corregir' })
    .click();
  await expect(dialog).not.toBeVisible();
  const editedQuestion = page.locator('[data-question-id="organization:organization.country"]');
  await expect(editedQuestion).toBeVisible();
  await expect
    .poll(() => editedQuestion.evaluate((element) => element.contains(document.activeElement)))
    .toBe(true);
});
