import { expect, test } from '@playwright/test';
import { createE2eOrganization, markE2eOrganizationLegacyConfigured } from './support/e2e-api';
import { activateE2eUserSession, registerE2eUser } from './support/register-e2e-user';

test('perfil versionado, evaluación explícita y trace de aplicabilidad', async ({
  page,
  request,
}) => {
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

  const context = await createE2eOrganization(
    request,
    registration,
    `Aplicabilidad Demo ${suffix}`,
  );
  await markE2eOrganizationLegacyConfigured(context.organization.id, context.session.user.id);
  await activateE2eUserSession(page, registration, '/app');

  await page.getByRole('link', { name: 'Biblioteca normativa', exact: true }).click();
  await page.getByRole('link', { name: 'Volver a Configuración SST', exact: true }).click();
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

  await page.goto('/app/applicability/unified');
  await expect(page.getByRole('heading', { name: 'Evaluación SST' })).toBeVisible();
  await page.getByLabel('Versión del perfil').selectOption({ label: 'Versión 1' });
  await Promise.all([
    page.waitForURL(/\/app\/applicability\/unified\/[0-9a-f-]+$/),
    page.getByRole('button', { name: 'Ejecutar Evaluación SST' }).click(),
  ]);
  await expect(page.getByRole('heading', { name: 'Prioridades y fundamento' })).toBeVisible();
  await expect(page.getByText('Interpretación propuesta').first()).toBeVisible();
  await expect(page.getByText('Revisión profesional pendiente').first()).toBeVisible();
  const firstCandidate = page.locator('article.regulatory-source-identity').first();
  await expect(firstCandidate.getByText('No declarado todavía')).toBeVisible();
  await expect(firstCandidate.getByText('Sin evidencia registrada')).toBeVisible();
  const organizationContext = firstCandidate.getByRole('region', {
    name: 'Estado y evidencia de la organización',
  });
  await organizationContext.getByLabel('Estado declarado').selectOption('PARTIALLY_IMPLEMENTED');
  await organizationContext.getByRole('button', { name: 'Guardar estado declarado' }).click();
  await expect(
    firstCandidate.getByRole('definition').filter({ hasText: 'Parcialmente implementado' }),
  ).toBeVisible();
  await organizationContext
    .getByLabel('Nota de evidencia organizacional')
    .fill('Registro interno sintético para el recorrido E2E.');
  await organizationContext
    .getByRole('button', { name: 'Añadir evidencia organizacional' })
    .click();
  await expect(firstCandidate.getByText('1 referencia(s) registrada(s)')).toBeVisible();
  await firstCandidate.getByLabel('Decisión').selectOption('LEGAL_REVIEW_REQUIRED');
  await firstCandidate
    .getByLabel('Comentario')
    .fill('Validar alcance jurídico antes de cualquier publicación.');
  await firstCandidate.getByRole('button', { name: 'Registrar revisión' }).click();
  await expect(
    firstCandidate.getByText('Revisión registrada. La regla no fue publicada.'),
  ).toBeVisible();
  await firstCandidate.getByRole('link', { name: 'Ver fundamento normativo' }).click();
  await expect(page.getByRole('heading', { name: 'Texto oficial' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Interpretación en la plataforma' }),
  ).toBeVisible();

  await page.goto('/app/applicability/sources');
  await expect(page.getByRole('heading', { name: 'Biblioteca normativa' })).toBeVisible();
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
  await unverifiedReference.getByRole('link', { name: 'Abrir documento' }).click();
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
  await expect(page.getByRole('heading', { name: 'Biblioteca normativa' })).toBeVisible();
  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await page.getByLabel('Buscar').fill('MDT-2024-196');
  await page
    .locator('a[href="/app/applicability/sources/EC_MDT_2024_196"]')
    .getByText('Abrir documento', { exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Acuerdo Ministerial Nro. MDT-2024-196' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Contenido y artículos' })).toBeVisible();
  await page.getByLabel('Buscar en artículos').fill('Artículo 18');
  const article18 = page.locator('li.regulatory-content-card').filter({ hasText: 'ARTICLE_18' });
  await article18.getByRole('link', { name: 'Abrir texto oficial' }).click();
  await expect(page.getByRole('heading', { name: 'ARTICLE_18' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Texto oficial' })).toBeVisible();
  await expect(page.getByText('Artefacto verificado')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Abrir documento oficial' })).toHaveAttribute(
    'href',
    /trabajo\.gob\.ec/,
  );
  await expect(
    page.getByRole('heading', { name: 'Interpretación en la plataforma' }),
  ).toBeVisible();
  await page.goto('/app/applicability/sources');
  await page.getByRole('link', { name: 'Requisitos estructurados' }).click();
  await expect(page.getByRole('heading', { name: 'Requisitos estructurados' })).toBeVisible();
  await expect(page.getByText(/No decide si aplica a una organización/)).toBeVisible();
  await page.setViewportSize({ width: 320, height: 720 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
