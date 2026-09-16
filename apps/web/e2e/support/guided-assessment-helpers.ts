import { expect, type Page } from '@playwright/test';

export async function waitForAssessmentMotion(page: Page) {
  await page
    .locator(
      '.assessment-question, .assessment-review, .assessment-checkpoint, .assessment-context__change > span, .assessment-result-group article, .assessment-preflight-card',
    )
    .evaluateAll(async (elements) => {
      await Promise.all(
        elements.flatMap((element) =>
          element.getAnimations().map((animation) => animation.finished),
        ),
      );
    });
}

export async function startPublicAssessment(page: Page, centerCount: 1 | 2 | 3) {
  await page.goto('/evaluacion-sst');
  await page
    .getByRole('button', { name: `${centerCount} ${centerCount === 1 ? 'centro' : 'centros'}` })
    .click();
  await page.getByRole('button', { name: 'Comenzar evaluación' }).click();
  await expect(page.locator('[data-question-id]')).toBeVisible();
  await expect(page.getByText(/Paso 1 de 6/)).toHaveCount(0);
  await expect(page.locator('input[type="checkbox"]')).toHaveCount(0);
}

export async function answerCurrentQuestion(page: Page) {
  const question = page.locator('[data-question-id]').first();
  const questionId = await question.getAttribute('data-question-id');
  const valueType = await question.getAttribute('data-question-type');
  if (!questionId || !valueType) throw new Error('ASSESSMENT_QUESTION_METADATA_MISSING');

  if (valueType === 'BOOLEAN') {
    await question.getByRole('radio', { name: 'No', exact: true }).check();
    await question.getByRole('button', { name: 'Continuar', exact: true }).click();
  } else if (valueType === 'SINGLE_CHOICE') {
    await question.getByRole('radio').first().check();
    await question.getByRole('button', { name: 'Continuar', exact: true }).click();
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
