import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { createE2eOrganization, setE2eOrganizationPlan } from './support/e2e-api';
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
    await page.getByLabel('Nombre de empresa').fill(organizationName);
    const activity = page.getByLabel('Actividad principal');
    if (await activity.isVisible()) await activity.fill('Manufactura sintética');
    await page.getByRole('button', { name: 'Crear empresa' }).click();
  }
  await expect(
    page.getByRole('heading', { name: 'Configura los centros de trabajo' }),
  ).toBeVisible();
  for (let index = 0; index < centerNames.length; index += 1) {
    await page.getByLabel(`Centro ${index + 1}`).fill(centerNames[index]!);
  }
  await page.getByRole('button', { name: 'Guardar centros y continuar' }).click();
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
  await finalizePublicAssessment(page, testInfo, 'public');
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
  await page.getByRole('button', { name: 'Reevaluar empresa' }).click();
  await expect(
    page
      .getByText(
        /Usaremos lo que ya sabemos|Conozcamos cómo funciona tu empresa|Revisa antes de finalizar/,
      )
      .first(),
  ).toBeVisible();
});

test('multi-center public assessment requires visible center configuration and mapping', async ({
  page,
  request,
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
  const prepared = await createE2eOrganization(
    request,
    registration,
    `Empresa multicentro ${suffix}`,
  );
  await setE2eOrganizationPlan(prepared.organization.id, 'STARTER');
  const claimHref = await page
    .getByRole('link', { name: 'Crear cuenta y continuar' })
    .getAttribute('href');
  if (!claimHref) throw new Error('ASSESSMENT_CLAIM_PATH_MISSING');
  const next = new URL(claimHref, 'http://127.0.0.1:3100').searchParams.get('next');
  if (!next) throw new Error('ASSESSMENT_CLAIM_RETURN_PATH_MISSING');
  await activateE2eUserSession(page, registration, next);
  await configureAndClaim(page, null, ['Planta Principal', 'Bodega Sur'], testInfo);
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

test('mobile guided question has no horizontal overflow and keeps its context accessible', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await startPublicAssessment(page, 1);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await expect(page.locator('[data-question-id]')).toBeVisible();
  await expect(page.getByText('Lo que ya sabemos')).toBeVisible();
  await waitForAssessmentMotion(page);
  await page.screenshot({ path: testInfo.outputPath('08-mobile-question.png'), fullPage: true });
});
