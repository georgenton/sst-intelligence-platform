import { expect, test } from '@playwright/test';
import {
  answerCurrentQuestion,
  startPublicAssessment,
  waitForAssessmentMotion,
} from './support/guided-assessment-helpers';

test('processing follows held requests and never imposes a minimum display duration', async ({
  page,
}, testInfo) => {
  await startPublicAssessment(page, 2);
  await page.clock.install();
  // Freeze the visual clock. Requests still complete normally.
  await page.clock.pauseAt(new Date());
  const question = page.locator('[data-question-id]');
  const fastEvaluation = page.waitForResponse(
    (response) => response.url().endsWith('/evaluate') && response.request().method() === 'POST',
  );
  const fastId = await question.getAttribute('data-question-id');
  await question.getByLabel('Respuesta', { exact: true }).fill('Ecuador');
  await question.getByRole('button', { name: 'Continuar', exact: true }).click();
  await fastEvaluation;
  await expect(page.getByRole('status')).toContainText('Respuesta guardada');
  // Flush immediate cache notifications while staying well below the reveal threshold.
  await page.clock.runFor(1);
  await expect(page.locator(`[data-question-id="${fastId}"]`)).toHaveCount(0);
  await expect(page.locator('.assessment-processing')).toHaveCount(0);
  const checkpoint = page.getByRole('button', { name: 'Todo correcto, continuar' });
  if (await checkpoint.isVisible()) await checkpoint.click();
  await expect(question).toBeVisible();
  const firstId = await question.getAttribute('data-question-id');
  await expect(question.locator('.assessment-why')).toBeVisible();
  await expect(page.locator('[aria-live="polite"]')).toHaveCount(1);
  let releaseSave!: () => void;
  let releaseEvaluation!: () => void;
  let enteredSave!: () => void;
  let enteredEvaluation!: () => void;
  const saveHeld = new Promise<void>((resolve) => {
    releaseSave = resolve;
  });
  const evaluationHeld = new Promise<void>((resolve) => {
    releaseEvaluation = resolve;
  });
  const saveEntered = new Promise<void>((resolve) => {
    enteredSave = resolve;
  });
  const evaluationEntered = new Promise<void>((resolve) => {
    enteredEvaluation = resolve;
  });
  await page.route(
    '**/sst-assessment/public/sessions/*/answers',
    async (route) => {
      enteredSave();
      await saveHeld;
      await route.continue();
    },
    { times: 1 },
  );
  await page.route(
    '**/sst-assessment/public/sessions/*/evaluate',
    async (route) => {
      enteredEvaluation();
      await evaluationHeld;
      await route.continue();
    },
    { times: 1 },
  );
  try {
    await question.getByLabel('Respuesta numérica').fill('24');
    await question.getByRole('button', { name: 'Continuar', exact: true }).click();
    await saveEntered;
    await page.clock.runFor(100);
    await expect(page.locator('.assessment-processing')).toHaveCount(0);
    await page.clock.runFor(500);
    await expect(page.locator('.assessment-processing')).toHaveAttribute(
      'data-processing-state',
      'saving',
    );
    await expect(question).toHaveAttribute('aria-busy', 'true');
    await expect(question.getByLabel('Respuesta numérica')).toHaveValue('24');
    await expect(question.getByLabel('Respuesta numérica')).toBeDisabled();
    await page.screenshot({
      path: testInfo.outputPath('cloud-processing-saving.png'),
      fullPage: true,
      animations: 'disabled',
    });
    releaseSave();
    await evaluationEntered;
    await expect(page.locator('.assessment-processing')).toHaveAttribute(
      'data-processing-state',
      'evaluating',
    );
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('.assessment-processing__spinner')).toHaveCSS(
      'animation-name',
      'none',
    );
    await page.setViewportSize({ width: 320, height: 844 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    await expect(page.locator('.assessment-processing__answer')).toContainText('24');
    await page.screenshot({
      path: testInfo.outputPath('cloud-processing-evaluating-mobile-320.png'),
      fullPage: true,
      animations: 'disabled',
    });
    const evaluatedResponse = page.waitForResponse(
      (response) => response.url().endsWith('/evaluate') && response.request().method() === 'POST',
    );
    releaseEvaluation();
    await evaluatedResponse;
    await expect(page.getByRole('status')).toContainText('Respuesta guardada');
    // Only flush the immediate cache notification; no display-duration timer is needed.
    await page.clock.runFor(1);
    await expect(page.locator(`[data-question-id="${firstId}"]`)).toHaveCount(0);
    await expect(page.locator('.assessment-processing')).toHaveCount(0);
    await expect(page.locator('[aria-live="polite"]')).toHaveCount(1);
  } finally {
    releaseSave();
    releaseEvaluation();
    await page.clock.resume();
  }
});

test('mobile center relay, radio keyboard behavior and zoom preserve the active scope', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startPublicAssessment(page, 2);
  let relayCaptured = false;
  let grayscaleCaptured = false;
  for (let index = 0; index < 25 && !relayCaptured; index += 1) {
    const checkpoint = page.getByRole('button', { name: 'Todo correcto, continuar' });
    if (await checkpoint.isVisible()) {
      await checkpoint.click();
      continue;
    }
    const relay = page.getByRole('button', { name: /^Empezar con Centro/ });
    if (await relay.isVisible()) {
      await waitForAssessmentMotion(page);
      await page.screenshot({
        path: testInfo.outputPath('cloud-mobile-center-relay.png'),
        fullPage: true,
      });
      await expect(page.getByRole('heading', { name: /^Ahora revisaremos Centro/ })).toBeFocused();
      await relay.click();
      await expect(page.locator('.assessment-mobile-scope')).toBeVisible();
      await expect(page.locator('.assessment-mobile-scope')).toContainText('Centro 2 de 2');
      relayCaptured = true;
      break;
    }
    const question = page.locator('[data-question-id]');
    if (await question.getByRole('radio').count()) {
      const questionId = await question.getAttribute('data-question-id');
      const radios = question.getByRole('radio');
      await radios.first().focus();
      await page.keyboard.press('ArrowRight');
      await expect(radios.nth(1)).toBeChecked();
      await expect(question.getByRole('button', { name: 'Continuar', exact: true })).toBeEnabled();
      await page.screenshot({
        path: testInfo.outputPath('cloud-mobile-question.png'),
        fullPage: true,
      });
      if (!grayscaleCaptured) {
        grayscaleCaptured = true;
        await page.evaluate(() => {
          document.documentElement.style.filter = 'grayscale(1)';
        });
        await page.screenshot({
          path: testInfo.outputPath('cloud-mobile-selected-grayscale.png'),
          fullPage: true,
        });
        await page.evaluate(() => {
          document.documentElement.style.filter = '';
        });
      }
      await question.getByRole('button', { name: 'Continuar', exact: true }).focus();
      await page.keyboard.press('Enter');
      await expect(page.locator(`[data-question-id="${questionId}"]`)).toHaveCount(0);
    } else await answerCurrentQuestion(page);
  }
  expect(relayCaptured).toBe(true);
  await page.setViewportSize({ width: 320, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.setViewportSize({ width: 640, height: 844 });
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
  await expect(page.locator('.assessment-question__scope')).toContainText('Centro 2 de 2');
  await page.evaluate(() => {
    document.documentElement.style.zoom = '';
  });
  await page.setViewportSize({ width: 820, height: 1000 });
  const tabletContext = page.locator('.assessment-context-tablet');
  await expect(tabletContext).toBeVisible();
  await tabletContext.locator('summary').click();
  const tabletGroup = tabletContext.getByRole('button').first();
  await expect(tabletGroup).toBeVisible();
  await tabletGroup.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tabletGroup).toBeFocused();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.screenshot({ path: testInfo.outputPath('cloud-tablet-context.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const trigger = page.getByRole('button', { name: /^Contexto ·/ });
  await trigger.click();
  await page.screenshot({
    path: testInfo.outputPath('cloud-mobile-context.png'),
    fullPage: true,
  });
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});
