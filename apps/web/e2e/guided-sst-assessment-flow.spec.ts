import { expect, test, type Page, type TestInfo } from '@playwright/test';
import {
  createE2eOrganization,
  markE2eOrganizationLegacyConfigured,
  setE2eOrganizationPlan,
} from './support/e2e-api';
import { activateE2eUserSession, registerE2eUser } from './support/register-e2e-user';

async function waitForAssessmentMotion(page: Page) {
  await page
    .locator(
      '.assessment-question, .assessment-review, .assessment-result-group article, .assessment-preflight-card',
    )
    .evaluateAll(async (elements) => {
      await Promise.all(
        elements.flatMap((element) =>
          element.getAnimations().map((animation) => animation.finished),
        ),
      );
    });
}

async function startPublicAssessment(page: Page, centerCount: 1 | 2) {
  await page.goto('/evaluacion-sst');
  await page
    .getByRole('button', { name: `${centerCount} ${centerCount === 1 ? 'centro' : 'centros'}` })
    .click();
  await page.getByRole('button', { name: 'Comenzar evaluación' }).click();
  await expect(page.locator('[data-question-id]')).toBeVisible();
  await expect(page.getByText(/Paso 1 de 6/)).toHaveCount(0);
  await expect(page.locator('input[type="checkbox"]')).toHaveCount(0);
}

async function answerCurrentQuestion(page: Page) {
  const question = page.locator('[data-question-id]').first();
  const questionId = await question.getAttribute('data-question-id');
  const valueType = await question.getAttribute('data-question-type');
  if (!questionId || !valueType) throw new Error('ASSESSMENT_QUESTION_METADATA_MISSING');

  if (valueType === 'BOOLEAN') {
    await question.getByRole('button', { name: 'No', exact: true }).click();
  } else if (valueType === 'SINGLE_CHOICE') {
    await question.locator('.assessment-choice-grid button').first().click();
  } else if (valueType === 'MULTI_CHOICE') {
    await question.locator('.assessment-choice-grid button').first().click();
    await question.getByRole('button', { name: 'Continuar', exact: true }).click();
  } else if (valueType === 'INTEGER') {
    await question.getByLabel('Respuesta numérica').fill('24');
    await question.getByRole('button', { name: 'Continuar', exact: true }).click();
  } else {
    const prompt = (await question.textContent()) ?? '';
    const answer = prompt.includes('país')
      ? 'Ecuador'
      : prompt.includes('sector')
        ? 'Manufactura liviana'
        : 'Operación sintética para validación de producto';
    await question.getByLabel('Respuesta', { exact: true }).fill(answer);
    await question.getByRole('button', { name: 'Continuar', exact: true }).click();
  }

  await expect(page.locator(`[data-question-id="${questionId}"]`)).toHaveCount(0);
}

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
    const checkpoint = page.getByRole('button', { name: 'Todo correcto, continuar' });
    if (await checkpoint.isVisible().catch(() => false)) {
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
  await page.getByRole('button', { name: 'Confirmar y generar diagnóstico' }).click();
  await expect(page.getByText('Diagnóstico listo', { exact: true })).toBeVisible();
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

async function configureAndClaim(
  page: Page,
  organizationName: string | null,
  centerNames: string[],
  testInfo?: TestInfo,
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
    if (centerNames.length > 1) await setE2eOrganizationPlan(createdOrganization.id, 'GROWTH');
    await expect(
      page.getByRole('heading', { name: 'Configura los centros de trabajo' }),
    ).toBeVisible();
    for (let index = 0; index < centerNames.length; index += 1) {
      await page.getByLabel(`Centro ${index + 1}`).fill(centerNames[index]!);
    }
    await page.getByRole('button', { name: 'Guardar centros y continuar' }).click();
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
}

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
  await expect(page.getByRole('button', { name: 'Corregir' })).toHaveCount(0);
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
  await expect(page.getByRole('button', { name: 'Corregir' })).toHaveCount(0);
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

test('multi-center public assessment creates a new company with visible center configuration and mapping', async ({
  page,
}, testInfo) => {
  test.setTimeout(300_000);
  const suffix = Date.now();
  await startPublicAssessment(page, 2);
  await finalizePublicAssessment(page);
  const registration = await registerE2eUser({
    displayName: 'Owner Multicentro E2E',
    email: `guided-multi-${suffix}@example.test`,
    password: 'guided-multicenter-password-123',
  });
  expect(registration.statusCode, registration.body).toBe(201);
  const next = await claimReturnPath(page);
  await activateE2eUserSession(page, registration, next);
  await configureAndClaim(
    page,
    `Empresa multicentro ${suffix}`,
    ['Planta Principal', 'Bodega Sur'],
    testInfo,
  );
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
    page.getByRole('heading', { name: '¿Cuántos centros de trabajo quieres incluir?' }),
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
  await setE2eOrganizationPlan(prepared.organization.id, 'STARTER');
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

test('mobile guided question has no horizontal overflow and keeps its context accessible', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await startPublicAssessment(page, 1);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  const question = page.locator('[data-question-id]');
  const contextTrigger = page.getByRole('button', { name: /Ver lo que ya sabemos/ });
  await expect(question).toBeVisible();
  await expect(contextTrigger).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Lo que ya sabemos' })).not.toBeVisible();
  const questionBox = await question.boundingBox();
  const triggerBox = await contextTrigger.boundingBox();
  expect(questionBox?.y).toBeLessThan(triggerBox?.y ?? 0);
  await waitForAssessmentMotion(page);
  await page.screenshot({
    path: testInfo.outputPath('03-mobile-context-closed.png'),
    fullPage: true,
  });
  await contextTrigger.click();
  const dialog = page.getByRole('dialog', { name: 'Lo que ya sabemos' });
  await expect(dialog).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('04-mobile-context-open.png'),
    fullPage: true,
  });
  await dialog.getByRole('button', { name: 'Cerrar contexto' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(contextTrigger).toBeFocused();
  await answerCurrentQuestion(page);
});
