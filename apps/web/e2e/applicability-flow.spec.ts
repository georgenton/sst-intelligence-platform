import { expect, test } from '@playwright/test';
import { registerE2eUser } from './support/register-e2e-user';

test('perfil versionado, evaluación explícita y trace de aplicabilidad', async ({ page }) => {
  test.setTimeout(90_000);
  const suffix = Date.now();
  const email = `applicability-e2e-${suffix}@example.test`;
  const password = 'applicability-e2e-password-123';

  const registration = await registerE2eUser({
    displayName: 'Responsable Aplicabilidad E2E',
    email,
    password,
  });
  expect(registration.statusCode, registration.body).toBe(201);

  await page.goto('/auth/login');
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.getByRole('link', { name: 'Crear organización' }).click();
  await page.getByLabel('Nombre de empresa').fill(`Aplicabilidad Demo ${suffix}`);
  await page.getByLabel('Sector').fill('Tecnología');
  await page.getByRole('button', { name: 'Crear organización' }).click();
  await expect(page.getByText('Organización creada correctamente.')).toBeVisible();

  await page.getByRole('link', { name: 'Configuración SST', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Aplicabilidad y configuración SST' }),
  ).toBeVisible();
  await expect(page.getByText('Todavía no existe un perfil SST versionado')).toBeVisible();
  await expect(
    page.getByText('Aún no se han ejecutado evaluaciones de aplicabilidad'),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Nueva evaluación de aplicabilidad' }).click();

  await page.setViewportSize({ width: 320, height: 844 });
  await expect(page.getByRole('heading', { name: 'Perfil SST' })).toBeVisible();
  await page.getByLabel('Personas trabajadoras · opcional').fill('35');
  await expect(
    page
      .getByRole('group', { name: '¿Existen procesos químicos?' })
      .getByLabel('No tengo información'),
  ).toBeChecked();
  await page
    .getByRole('group', { name: '¿Existen operaciones de alta energía?' })
    .getByLabel('Sí', { exact: true })
    .check();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Crear versión del perfil' }).click();

  await expect(page.getByRole('heading', { name: 'Versión creada' })).toBeVisible();
  await expect(page.getByText(/Todavía no existe una evaluación para este flujo/)).toBeVisible();
  const persistedProfile = page.getByRole('region', { name: 'Confirma la versión persistida' });
  await expect(persistedProfile.getByText('Ecuador', { exact: true })).toBeVisible();
  await expect(persistedProfile.getByText('1', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar versión' }).click();

  await expect(page.getByRole('heading', { name: 'Motor de reglas' })).toBeVisible();
  const rulePack = page
    .getByRole('radio', { name: /Seleccionar Configuración SST demostrativa/ })
    .locator('..');
  await rulePack.getByRole('radio').check();
  await expect(rulePack.getByText('DEMO_APPLICABILITY', { exact: true })).toBeHidden();
  await rulePack.getByText('Detalles técnicos', { exact: true }).click();
  await expect(rulePack.getByText('DEMO_APPLICABILITY', { exact: true })).toBeVisible();
  await expect(
    page.getByText(/No representan normativa ni acreditan cumplimiento legal/).first(),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar motor' }).click();

  await expect(page.getByRole('heading', { name: 'Evaluar', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Evaluar configuración SST' })).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/app\/applicability\/[0-9a-f-]+$/),
    page.getByRole('button', { name: 'Evaluar configuración SST' }).click(),
  ]);

  await expect(page.getByRole('heading', { name: 'Evaluación de aplicabilidad' })).toBeVisible();
  await expect(
    page.getByText(/No representan normativa ni acreditan cumplimiento legal/).first(),
  ).toBeVisible();
  await expect(page.getByText('Obligatorio en esta demostración').first()).toBeVisible();
  await expect(page.getByText('Falta información').first()).toBeVisible();
  await expect(page.getByText('Requiere revisión profesional').first()).toBeVisible();

  const chemicalDecision = page
    .locator('article.applicability-decision-card')
    .filter({ hasText: 'Control de procesos químicos' });
  await chemicalDecision.getByText('¿Por qué se obtuvo este resultado?').click();
  await expect(
    chemicalDecision.getByText('DEMO_CHEMICAL_MANDATORY', { exact: true }).first(),
  ).toBeVisible();
  await expect(
    chemicalDecision.getByText('operations.hasChemicalProcesses', { exact: true }).first(),
  ).toBeVisible();
  await expect(chemicalDecision.getByText('BOOLEAN_IS', { exact: true }).first()).toBeVisible();
  await expect(
    chemicalDecision.getByText('Sin información', { exact: true }).first(),
  ).toBeVisible();
  await expect(chemicalDecision.getByText('MISSING', { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  await page.getByRole('link', { name: 'Ver historial' }).click();
  await expect(page.getByRole('heading', { name: 'Historial de evaluaciones' })).toBeVisible();
  await expect(
    page.getByText('Información de la organización · marco de evaluación registrado').first(),
  ).toBeVisible();
  await expect(page.getByText('DEMO_APPLICABILITY', { exact: true })).toBeHidden();

  await page.getByRole('link', { name: 'Fuentes de referencia' }).click();
  await expect(page.getByRole('heading', { name: 'Fuentes de referencia' })).toBeVisible();
  await expect(page.getByText(/Estar registrada como fuente no significa/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  await page.getByLabel('Estado de revisión').selectOption('REJECTED_REFERENCE');
  await expect(page.getByText('1 resultado')).toBeVisible();

  const unverifiedReference = page
    .locator('article.regulatory-source-card')
    .filter({ hasText: 'C.D. 527' });
  await expect(unverifiedReference.getByText('Referencia no verificada').first()).toBeVisible();
  await unverifiedReference.getByRole('link', { name: 'Ver metadata' }).click();
  await expect(
    page.getByRole('heading', { name: 'C.D. 527 — título no verificado' }),
  ).toBeVisible();
  await expect(page.getByText('Versión de catálogo 1')).toBeVisible();
  await expect(page.getByText('No lista para reglas')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Contenido estructurado' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Disposiciones' })).toBeVisible();
  await expect(page.getByText('No hay contenido estructurado todavía.')).toBeVisible();
  await expect(page.getByText('No hay requisitos estructurados todavía.')).toBeVisible();
  await expect(page.getByText(/no significa que no existan requisitos legales/i)).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('link', { name: 'Volver al catálogo' }).click();
  await expect(page.getByRole('heading', { name: 'Fuentes de referencia' })).toBeVisible();
  await page.getByRole('link', { name: 'Requisitos estructurados' }).click();
  await expect(page.getByRole('heading', { name: 'Requisitos estructurados' })).toBeVisible();
  await expect(page.getByText(/No decide si aplica a una organización/)).toBeVisible();
  await page.setViewportSize({ width: 320, height: 720 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
