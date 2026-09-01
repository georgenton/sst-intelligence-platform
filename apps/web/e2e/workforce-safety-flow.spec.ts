import { expect, test, type Page } from '@playwright/test';
import { registerE2eUser } from './support/register-e2e-user';

async function createOrganization(page: Page, name: string) {
  await page.getByRole('link', { name: 'Organizaciones', exact: true }).click();
  await page.getByLabel('Nombre de empresa').fill(name);
  await page.getByLabel('Sector').fill('Operación industrial sintética');
  await page.getByRole('button', { name: 'Crear organización' }).click();
  await expect(page.getByText('Organización creada correctamente.')).toBeVisible();
}

async function prepareDemoRegistration(page: Page) {
  await page.goto('/diagnostico');
  await page.getByRole('button', { name: 'Comenzar' }).click();
  for (const step of [1, 2, 3, 4, 5]) {
    await expect(page.getByText(`Paso ${step} de 6`)).toBeVisible();
    await page.getByRole('button', { name: 'Guardar y continuar' }).click();
  }
  await expect(page.getByText('Paso 6 de 6')).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/diagnostico\/[0-9a-f-]+\/resultado$/),
    page.getByRole('button', { name: 'Ver recomendación' }).click(),
  ]);
  const href = await page
    .getByRole('link', { name: 'Crear cuenta y continuar' })
    .getAttribute('href');
  const sessionId = href ? new URL(href, 'http://e2e.local').searchParams.get('sessionId') : null;
  if (!sessionId) throw new Error('E2E_DIAGNOSTIC_SESSION_ID_MISSING');
  return sessionId;
}

test.describe.serial('workforce safety operations', () => {
  test('registra y desactiva un trabajador sin consumir un asiento de acceso', async ({ page }) => {
    test.setTimeout(120_000);
    const suffix = Date.now();
    const email = `worker-owner-${suffix}@example.test`;
    const password = 'worker-e2e-password-strong-123';
    const organizationName = `Organización Personas ${suffix}`;
    const workerName = `Ana Operadora ${suffix}`;
    const registration = await registerE2eUser({
      displayName: 'Owner Personas E2E',
      email,
      password,
    });
    expect(registration.statusCode, registration.body).toBe(201);

    await page.goto('/auth/login');
    await page.getByLabel('Correo').fill(email);
    await page.getByLabel('Contraseña').fill(password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await createOrganization(page, organizationName);

    await page.getByRole('link', { name: 'Personas / Trabajadores', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Trabajadores', exact: true })).toBeVisible();
    await page.getByLabel('Nombre para la operación').fill(workerName);
    await page.getByLabel('Centro de trabajo asignado').selectOption({ index: 1 });
    await page.getByLabel('Cargo o función').fill('Operadora de mantenimiento');
    await page.getByLabel('Fecha de inicio').fill('2026-08-01');
    await page.getByRole('button', { name: 'Registrar trabajador' }).click();
    await expect(
      page.getByText('Trabajador registrado sin crear un asiento de acceso.'),
    ).toBeVisible();
    const workerRow = page.locator('article').filter({ hasText: workerName });
    await expect(workerRow).toContainText('Activo');
    await workerRow.getByRole('link', { name: 'Abrir espacio de trabajo' }).click();
    await expect(page.getByRole('heading', { name: workerName })).toBeVisible();
    await expect(page.getByText('No requiere cuenta de acceso')).toBeVisible();

    for (const width of [320, 640]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    }

    await page.getByRole('button', { name: 'Desactivar trabajador' }).click();
    await expect(page.getByText('Trabajador desactivado; su historia permanece.')).toBeVisible();
    await expect(page.getByText('Inactivo', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/app');
    await expect(page.getByText('1 personas con acceso')).toBeVisible();
  });

  test('conduce un casi incidente desde el reporte hasta el cierre profesional', async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const suffix = Date.now();
    const email = `incident-owner-${suffix}@example.test`;
    const password = 'incident-e2e-password-strong-123';
    const organizationName = `Organización Incidentes ${suffix}`;
    const workerName = `Operadora Testigo ${suffix}`;
    const incidentTitle = `Material suelto controlado ${suffix}`;
    const actionTitle = `Asegurar materiales ${suffix}`;
    const sessionId = await prepareDemoRegistration(page);
    const registration = await registerE2eUser({
      displayName: 'Owner Incidentes E2E',
      email,
      password,
    });
    expect(registration.statusCode, registration.body).toBe(201);

    await page.goto(`/auth/login?sessionId=${encodeURIComponent(sessionId)}`);
    await page.getByLabel('Correo').fill(email);
    await page.getByLabel('Contraseña').fill(password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.getByLabel('Nombre de empresa').fill(organizationName);
    await page.getByLabel('Sector').fill('Operación industrial sintética');
    await page.getByRole('button', { name: 'Crear y activar demo' }).click();
    await expect(page.getByText(/Demostración conceptual activa/)).toBeVisible();

    await page.getByRole('link', { name: 'Personas / Trabajadores', exact: true }).click();
    await page.getByLabel('Nombre para la operación').fill(workerName);
    await page.getByLabel('Centro de trabajo asignado').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Registrar trabajador' }).click();
    await expect(
      page.getByText('Trabajador registrado sin crear un asiento de acceso.'),
    ).toBeVisible();

    await page.getByRole('link', { name: 'Incidentes', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Incidentes y casi incidentes' })).toBeVisible();
    await page.getByLabel('Tipo de evento').selectOption('NEAR_MISS');
    await page.getByLabel('Centro de trabajo').selectOption({ index: 1 });
    await page.getByLabel('Fecha y hora del evento').fill('2026-08-31T10:00');
    await page.getByLabel('Título breve').fill(incidentTitle);
    await page
      .getByLabel('Descripción factual')
      .fill('Se observó material suelto dentro de un área delimitada, sin contacto con personas.');
    await page.getByRole('button', { name: 'Guardar borrador' }).click();
    await page.waitForURL(/\/app\/incidents\/[0-9a-f-]+$/);
    await expect(page.getByRole('heading', { name: incidentTitle, exact: true })).toBeVisible();
    const incidentUrl = page.url();

    await page.getByRole('button', { name: 'Reportar incidente' }).click();
    await expect(page.getByText('Reportado', { exact: true })).toBeVisible();
    await page.getByLabel('Vincular trabajador').selectOption({ label: workerName });
    await page
      .getByLabel('Participación observada')
      .fill('Observó el evento desde la zona segura.');
    await page.getByRole('button', { name: 'Vincular persona' }).click();
    await expect(page.getByText('Observó el evento desde la zona segura.')).toBeVisible();
    await page.getByRole('button', { name: 'Iniciar investigación' }).click();
    await expect(page.getByText('En investigación', { exact: true })).toBeVisible();

    await page.getByLabel('Categoría neutral').selectOption('EQUIPMENT');
    await page.getByLabel('Factor observado o supuesto').fill('Material sin sujeción visible.');
    await page
      .getByLabel('Evidencia o razonamiento (opcional)')
      .fill('Observación profesional; no implica una causa raíz automática.');
    await page.getByRole('button', { name: 'Registrar factor' }).click();
    await expect(page.getByText('Material sin sujeción visible.')).toBeVisible();
    await page
      .getByLabel('Evidencia narrativa de investigación')
      .fill('Área señalizada y registro factual revisado.');
    await page.getByRole('button', { name: 'Añadir evidencia' }).click();
    await expect(page.getByText('Área señalizada y registro factual revisado.')).toBeVisible();

    await page.getByLabel('Acción', { exact: true }).fill(actionTitle);
    await page.getByLabel('Descripción', { exact: true }).fill('Aplicar control visual previo.');
    await page.locator('select[name="priority"]').selectOption('HIGH');
    await page.getByLabel('Fecha objetivo').fill('2026-08-31T12:00');
    await page.getByRole('button', { name: 'Crear acción' }).click();
    await expect(page.getByRole('heading', { name: actionTitle })).toBeVisible();

    await page.getByRole('link', { name: 'Inicio', exact: true }).click();
    await expect(page.locator('article').filter({ hasText: actionTitle })).toBeVisible();
    await page.goto(incidentUrl);
    await page
      .getByLabel('Resumen de investigación')
      .fill('Se revisaron hechos y controles preventivos.');
    await page.getByRole('button', { name: 'Completar investigación' }).click();
    await expect(page.getByText('completada', { exact: false })).toBeVisible();
    const actionCard = page.locator('.incident-action-card').filter({ hasText: actionTitle });
    await actionCard.getByRole('button', { name: 'Iniciar' }).click();
    await expect(actionCard.getByText('En curso', { exact: true })).toBeVisible();
    await actionCard.getByRole('button', { name: 'Enviar a verificación' }).click();
    await expect(actionCard.getByText('Pendiente de verificación', { exact: true })).toBeVisible();
    await actionCard.getByLabel('Evidencia de ejecución').fill('Control instalado y revisado.');
    await actionCard.getByRole('button', { name: 'Añadir evidencia' }).click();
    await expect(actionCard.getByText('Control instalado y revisado.')).toBeVisible();
    await actionCard.getByRole('button', { name: 'Verificar acción' }).click();
    await expect(actionCard.getByText('Verificada', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar incidente' }).click();
    await expect(page.getByText('Cerrado', { exact: true })).toBeVisible();
    await expect(page.getByText(/Causa raíz detectada/i)).toHaveCount(0);

    for (const width of [320, 640]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    }
  });
});
