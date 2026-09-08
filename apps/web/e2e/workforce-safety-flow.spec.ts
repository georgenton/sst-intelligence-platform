import { expect, test, type Page } from '@playwright/test';
import { activateE2eUserSession, registerE2eUser } from './support/register-e2e-user';

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

async function horizontalOverflowSources(page: Page) {
  return page.locator('body *').evaluateAll((elements) => {
    const width = document.documentElement.clientWidth;
    return elements
      .map((element) => ({
        element,
        rect: element.getBoundingClientRect(),
      }))
      .filter(({ rect }) => rect.right > width + 1 || rect.left < -1)
      .map(({ element, rect }) => ({
        tag: element.tagName,
        className: element.className,
        text: element.textContent?.trim().slice(0, 100),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        viewport: width,
      }))
      .slice(0, 12);
  });
}

function trainingSessionRow(page: Page, title: string) {
  const sessionList = page.locator('section').filter({
    has: page.getByRole('heading', { level: 2, name: 'Sesiones registradas', exact: true }),
  });
  return sessionList.locator('article').filter({ hasText: title }).first();
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

    await activateE2eUserSession(page, registration);
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
    const workerWorkspaceLink = workerRow.getByRole('link', {
      name: 'Abrir espacio de trabajo',
    });
    await expect(workerWorkspaceLink).toHaveAttribute('href', /\/app\/workers\/[0-9a-f-]+$/);
    await Promise.all([
      page.waitForURL(/\/app\/workers\/[0-9a-f-]+$/),
      workerWorkspaceLink.click(),
    ]);
    await expect(
      page.getByRole('heading', { level: 1, name: workerName, exact: true }),
    ).toBeVisible();
    await expect(page.getByText('No requiere cuenta de acceso', { exact: true })).toBeVisible();

    for (const width of [320, 640]) {
      await page.setViewportSize({ width, height: 844 });
      const overflow = await horizontalOverflowSources(page);
      expect(overflow, JSON.stringify(overflow, null, 2)).toEqual([]);
    }

    await page.getByRole('button', { name: 'Desactivar trabajador' }).click();
    await expect(page.getByText('Trabajador desactivado; su historia permanece.')).toBeVisible();
    await expect(page.getByText('Inactivo', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Resumen', exact: true })).toBeVisible();
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

    await activateE2eUserSession(
      page,
      registration,
      `/app/organizations?sessionId=${encodeURIComponent(sessionId)}`,
    );
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

    await page.getByRole('link', { name: 'Accidentes e Incidentes', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Accidentes e Incidentes' })).toBeVisible();
    await page.getByLabel('Tipo de evento').selectOption('NEAR_MISS');
    await page
      .getByRole('combobox', { name: 'Centro de trabajo', exact: true })
      .selectOption({ index: 1 });
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
    await page
      .getByLabel('Responsable')
      .selectOption({ label: 'Owner Incidentes E2E · Propietario' });
    await page.getByLabel('Fecha objetivo').fill('2026-08-31T12:00');
    await page.getByRole('button', { name: 'Crear acción' }).click();
    await expect(page.getByRole('heading', { name: actionTitle })).toBeVisible();
    const actionCard = page.locator('.incident-action-card').filter({ hasText: actionTitle });
    await expect(actionCard.getByText(/Owner Incidentes E2E/)).toBeVisible();

    await page.getByRole('link', { name: 'Inicio', exact: true }).click();
    await expect(page.locator('article').filter({ hasText: actionTitle })).toBeVisible();
    await page.goto(incidentUrl);
    await page
      .getByLabel('Resumen de investigación')
      .fill('Se revisaron hechos y controles preventivos.');
    await page.getByRole('button', { name: 'Completar investigación' }).click();
    await expect(page.getByText('completada', { exact: false })).toBeVisible();
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

    await page.getByRole('link', { name: 'Personas / Trabajadores', exact: true }).click();
    await page
      .locator('article')
      .filter({ hasText: workerName })
      .getByRole('link', { name: 'Abrir espacio de trabajo' })
      .click();
    const workerIncident = page.locator('article').filter({ hasText: incidentTitle });
    await expect(workerIncident.getByText('Cerrado', { exact: true })).toBeVisible();
    await expect(
      workerIncident.getByRole('link', { name: 'Abrir flujo del incidente' }),
    ).toHaveAttribute('href', /\/app\/incidents\/[0-9a-f-]+$/);
    await expect(page.getByText('1 eventos relacionados')).toBeVisible();

    for (const width of [320, 640]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    }
  });

  test('preserva la historia de EPP desde requisito hasta reemplazo', async ({ page }) => {
    test.setTimeout(240_000);
    const suffix = Date.now();
    const email = `ppe-owner-${suffix}@example.test`;
    const password = 'ppe-e2e-password-strong-123';
    const workerName = `Técnico EPP ${suffix}`;
    const positionName = `Técnico eléctrico ${suffix}`;
    const itemName = `Casco interno ${suffix}`;
    const sessionId = await prepareDemoRegistration(page);
    const registration = await registerE2eUser({
      displayName: 'Owner EPP E2E',
      email,
      password,
    });
    expect(registration.statusCode, registration.body).toBe(201);

    await activateE2eUserSession(
      page,
      registration,
      `/app/organizations?sessionId=${encodeURIComponent(sessionId)}`,
    );
    await page.getByLabel('Nombre de empresa').fill(`Organización EPP ${suffix}`);
    await page.getByLabel('Sector').fill('Operación industrial sintética');
    await page.getByRole('button', { name: 'Crear y activar demo' }).click();
    await expect(page.getByText(/Demostración conceptual activa/)).toBeVisible();

    await page.getByRole('link', { name: 'Personas / Trabajadores', exact: true }).click();
    await page.getByLabel('Nombre del cargo').fill(positionName);
    await page.getByLabel('Descripción').fill('Cargo sintético para trabajo eléctrico.');
    await page.getByRole('button', { name: 'Crear cargo' }).click();
    await expect(page.getByRole('heading', { name: positionName, exact: true })).toBeVisible();
    await page.getByLabel('Nombre para la operación').fill(workerName);
    await page.getByLabel('Centro de trabajo asignado').selectOption({ index: 1 });
    await page.getByLabel('Cargo estructurado').selectOption({ label: positionName });
    await page.getByRole('button', { name: 'Registrar trabajador' }).click();
    await expect(
      page.getByText('Trabajador registrado sin crear un asiento de acceso.'),
    ).toBeVisible();

    await page.getByRole('link', { name: 'EPP', exact: true }).click();
    await page.getByLabel('Nombre del elemento').fill(itemName);
    await page.getByLabel('Categoría').selectOption('HEAD');
    await page.getByLabel('Descripción interna').fill('Elemento sintético para prueba E2E.');
    await page.getByLabel('Referencia técnica (metadato opcional)').fill('Referencia interna');
    await page.getByRole('button', { name: 'Agregar al catálogo' }).click();
    await expect(page.getByText('Elemento agregado al catálogo interno.')).toBeVisible();
    await page
      .getByRole('combobox', { name: 'Cargo', exact: true })
      .selectOption({ label: positionName });
    await page.getByLabel('Categoría de riesgo').selectOption('ELECTRICAL');
    await page
      .getByLabel('Descripción del riesgo')
      .fill('Contacto eléctrico durante mantenimiento autorizado.');
    await page.getByRole('button', { name: 'Agregar riesgo' }).click();
    await page.getByLabel('Riesgo que sustenta la selección').selectOption({
      label: 'ELECTRICAL · Contacto eléctrico durante mantenimiento autorizado.',
    });
    await page
      .locator('.card')
      .filter({ hasText: itemName })
      .getByRole('button', { name: 'Seleccionar profesionalmente' })
      .click();
    await expect(page.getByText('1 requisitos por cargo seleccionados.')).toBeVisible();

    await page.getByRole('link', { name: 'Personas / Trabajadores', exact: true }).click();
    const workerRow = page.locator('article').filter({ hasText: workerName });
    await workerRow.getByRole('link', { name: 'Abrir espacio de trabajo' }).click();
    await expect(page.getByRole('heading', { name: 'EPP', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Asignar requisito al trabajador' }).click();
    await expect(page.getByText('1 requisitos pendientes')).toBeVisible();

    await page.getByLabel('Requisito a entregar').selectOption({ label: itemName });
    await page.getByLabel('Fecha y hora de entrega').fill('2026-08-31T08:00');
    await page.getByLabel('Fecha prevista de reemplazo').fill('2027-08-31T08:00');
    await page.getByLabel('Referencia del elemento').fill(`EPP-${suffix}`);
    await page.getByLabel('Evidencia narrativa de entrega').fill('Entrega presencial registrada.');
    await page.getByRole('button', { name: 'Registrar entrega de EPP' }).click();
    const issuedCard = page.locator('.incident-action-card').filter({ hasText: itemName }).first();
    await expect(issuedCard.getByText('Entregado, pendiente de confirmación')).toBeVisible();
    await issuedCard
      .getByLabel(`Confirmación de entrega de ${itemName}`)
      .fill('La entrega fue confirmada presencialmente por el actor autenticado.');
    await issuedCard.getByRole('button', { name: 'Confirmar entrega registrada' }).click();
    await expect(issuedCard.getByText('En servicio', { exact: true })).toBeVisible();

    await issuedCard.getByLabel(`Condición de ${itemName}`).selectOption('UNSERVICEABLE');
    await issuedCard
      .getByLabel(`Nota de inspección de ${itemName}`)
      .fill('El elemento no debe continuar en servicio.');
    await issuedCard.getByRole('button', { name: 'Registrar inspección de condición' }).click();
    await expect(issuedCard.getByText('Reemplazo requerido', { exact: true })).toBeVisible();

    await page.getByRole('link', { name: 'Cola de trabajo', exact: true }).click();
    const queueItem = page.locator('article').filter({ hasText: itemName });
    await expect(queueItem.getByText('EPP', { exact: true })).toBeVisible();
    await queueItem.getByRole('link', { name: 'Abrir' }).click();
    await expect(page).toHaveURL(/\/app\/workers\/[0-9a-f-]+#epp-issue-/);
    const dueCard = page.locator('.incident-action-card').filter({ hasText: itemName }).first();
    await dueCard
      .getByLabel(`Evidencia de reemplazo de ${itemName}`)
      .fill('Reemplazo físico registrado con nueva entrega.');
    await dueCard.getByRole('button', { name: 'Registrar reemplazo' }).click();
    await expect(page.locator('.incident-action-card').filter({ hasText: itemName })).toHaveCount(
      2,
    );
    await expect(page.getByText('Reemplazado', { exact: true })).toBeVisible();
    await expect(page.getByText(/ambos registros se conservan/)).toBeVisible();

    for (const width of [320, 640]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    }
  });

  test('gestiona capacitación desde el requisito hasta la vigencia y renovación', async ({
    page,
  }) => {
    test.setTimeout(300_000);
    const suffix = Date.now();
    const email = `training-owner-${suffix}@example.test`;
    const password = 'training-e2e-password-strong-123';
    const workerName = `Operadora Capacitación ${suffix}`;
    const trainingTitle = `Trabajo seguro interno ${suffix}`;
    const diagnosticSessionId = await prepareDemoRegistration(page);
    const registration = await registerE2eUser({
      displayName: 'Owner Capacitación E2E',
      email,
      password,
    });
    expect(registration.statusCode, registration.body).toBe(201);

    await activateE2eUserSession(
      page,
      registration,
      `/app/organizations?sessionId=${encodeURIComponent(diagnosticSessionId)}`,
    );
    await page.getByLabel('Nombre de empresa').fill(`Organización Capacitación ${suffix}`);
    await page.getByLabel('Sector').fill('Operación industrial sintética');
    await page.getByRole('button', { name: 'Crear y activar demo' }).click();
    await expect(page.getByText(/Demostración conceptual activa/)).toBeVisible();

    await page.getByRole('link', { name: 'Personas / Trabajadores', exact: true }).click();
    await page.getByLabel('Nombre para la operación').fill(workerName);
    await page.getByLabel('Centro de trabajo asignado').selectOption({ index: 1 });
    await page.getByLabel('Cargo o función').fill('Operadora de proceso');
    await page.getByRole('button', { name: 'Registrar trabajador' }).click();
    await expect(
      page.getByText('Trabajador registrado sin crear un asiento de acceso.'),
    ).toBeVisible();

    await page.getByRole('link', { name: 'Capacitación', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Capacitación', exact: true })).toBeVisible();
    await page.getByLabel('Título').fill(trainingTitle);
    await page.getByLabel('Categoría interna').fill('Seguridad operativa');
    await page
      .getByLabel('Descripción')
      .fill('Definición interna sintética sin afirmar una obligación legal.');
    await page.getByLabel('Vigencia operativa (días)').fill('30');
    await page.getByRole('button', { name: 'Crear definición' }).click();
    await expect(page.getByText('Definición interna creada.')).toBeVisible();
    const needSource = page.getByLabel('Origen de la necesidad');
    for (const sourceType of [
      'PLAN',
      'RISK',
      'POSITION',
      'PPE_REQUIREMENT',
      'INCIDENT',
      'SAFETY_OBSERVATION',
      'FINDING',
      'APPROVED_REQUIREMENT',
      'MANUAL',
    ]) {
      await expect(needSource.locator(`option[value="${sourceType}"]`)).toHaveCount(1);
    }
    await page.getByLabel('Capacitación').first().selectOption({ label: trainingTitle });
    await page
      .getByLabel('Justificación profesional')
      .fill('Necesidad sintética decidida por el profesional SST.');
    await page.getByRole('button', { name: 'Registrar necesidad' }).click();
    await expect(
      page.getByText('Necesidad sintética decidida por el profesional SST.', { exact: true }),
    ).toBeVisible();
    const trainingNeedLabel = `${trainingTitle} · Necesidad sintética decidida por el profesional SST.`;
    await page.getByLabel('Necesidad a segmentar').selectOption({ label: trainingNeedLabel });
    await page.getByLabel('Tipo de audiencia').selectOption('WORKER');
    await page.getByLabel('Audiencia canónica').selectOption({ label: workerName });
    await page.getByRole('button', { name: 'Añadir audiencia' }).click();
    await expect(page.getByText(`${workerName} · WORKER`)).toBeVisible();

    await page.getByRole('link', { name: 'Personas / Trabajadores', exact: true }).click();
    const workerRow = page.locator('article').filter({ hasText: workerName });
    await workerRow.getByRole('link', { name: 'Abrir espacio de trabajo' }).click();
    await page.getByLabel('Capacitación requerida').selectOption({ label: trainingTitle });
    await page
      .getByLabel('Motivo profesional', { exact: true })
      .fill('Necesidad profesional interna para una tarea sintética.');
    await page.getByLabel('Fecha requerida').fill('2026-01-15');
    await page.getByRole('button', { name: 'Añadir requisito de capacitación' }).click();
    await expect(page.getByText('Requisito registrado.')).toBeVisible();
    await expect(page.getByText('No completada', { exact: true })).toBeVisible();

    await page.getByRole('link', { name: 'Capacitación', exact: true }).click();
    await page
      .getByRole('combobox', { name: 'Centro de trabajo', exact: true })
      .selectOption({ index: 1 });
    await page.getByLabel('Inicio').fill('2026-01-10T08:00');
    await page.getByLabel('Fin', { exact: true }).fill('2026-01-10T10:00');
    await page.getByLabel('Modalidad').selectOption('IN_PERSON');
    await page.getByLabel('Responsable o facilitador').fill('Profesional SST E2E');
    const trainingDefinitionSelect = page.getByLabel('Capacitación').last();
    await trainingDefinitionSelect.selectOption({ label: trainingTitle });
    await page
      .getByLabel('Necesidad de origen (opcional)')
      .selectOption({ label: trainingNeedLabel });
    await expect(trainingDefinitionSelect).not.toHaveValue('');
    await page.getByRole('button', { name: 'Crear sesión en borrador' }).click();
    await expect(page.getByText('Sesión creada.')).toBeVisible();
    const sessionRow = trainingSessionRow(page, trainingTitle);
    await sessionRow.getByRole('link', { name: 'Abrir sesión' }).click();
    await page.getByLabel('Persona trabajadora activa').selectOption({ label: workerName });
    await page.getByRole('button', { name: 'Inscribir trabajador' }).click();
    await expect(page.getByRole('heading', { name: workerName })).toBeVisible();
    await page.getByRole('button', { name: 'Programar sesión' }).click();
    await expect(page.getByText('Programada', { exact: true })).toBeVisible();
    const firstParticipantCard = page
      .locator('.incident-action-card')
      .filter({ hasText: workerName });
    await firstParticipantCard.getByRole('combobox').selectOption('PRESENT');
    await page
      .getByLabel(`Evidencia de asistencia de ${workerName}`)
      .fill('Lista de asistencia sintética revisada.');
    await page.getByRole('button', { name: 'Registrar asistencia' }).click();
    await expect(firstParticipantCard.locator('.status-badge')).toHaveText('Presente');
    await page.getByLabel(`Fecha de completitud de ${workerName}`).fill('2026-01-10T10:00');
    await page
      .getByLabel(`Evidencia o nota de completitud de ${workerName}`)
      .fill('Completitud sintética documentada.');
    await page.getByLabel(`Referencia interna de ${workerName} (opcional)`).fill(`REF-${suffix}`);
    await page.getByRole('button', { name: 'Registrar completitud' }).click();
    await expect(page.getByText(/vigencia:.*9 feb 2026/i)).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar sesión completada' }).click();
    await expect(page.getByText('Completada', { exact: true })).toBeVisible();

    await page.getByRole('link', { name: 'Cola de trabajo', exact: true }).click();
    const expiredQueueItem = page.locator('article').filter({ hasText: trainingTitle }).filter({
      hasText: 'Vencido',
    });
    await expect(expiredQueueItem.getByText('Capacitación', { exact: true })).toBeVisible();
    await expiredQueueItem.getByRole('link', { name: 'Abrir' }).click();
    await expect(page).toHaveURL(/\/app\/workers\/[0-9a-f-]+#training-completion-/);
    await expect(page.getByText('Vencida', { exact: true }).first()).toBeVisible();

    await page.getByRole('link', { name: 'Capacitación', exact: true }).click();
    await page.getByLabel('Inicio').fill('2026-08-31T08:00');
    await page.getByLabel('Fin', { exact: true }).fill('2026-08-31T10:00');
    await page.getByLabel('Modalidad').selectOption('HYBRID');
    await page.getByLabel('Capacitación').last().selectOption({ label: trainingTitle });
    await page.getByRole('button', { name: 'Crear sesión en borrador' }).click();
    await expect(page.getByText('Sesión creada.')).toBeVisible();
    await trainingSessionRow(page, trainingTitle)
      .getByRole('link', { name: 'Abrir sesión' })
      .click();
    await page.getByLabel('Persona trabajadora activa').selectOption({ label: workerName });
    await page.getByRole('button', { name: 'Inscribir trabajador' }).click();
    await page.getByRole('button', { name: 'Programar sesión' }).click();
    const renewalParticipantCard = page
      .locator('.incident-action-card')
      .filter({ hasText: workerName });
    await renewalParticipantCard.getByRole('combobox').selectOption('PARTIAL');
    await page
      .getByLabel(`Evidencia de asistencia de ${workerName}`)
      .fill('Asistencia parcial documentada.');
    await page.getByRole('button', { name: 'Registrar asistencia' }).click();
    await expect(renewalParticipantCard.locator('.status-badge')).toHaveText('Asistencia parcial');
    await page.getByLabel(`Fecha de completitud de ${workerName}`).fill('2026-08-31T10:00');
    await page.getByRole('button', { name: 'Registrar completitud' }).click();
    await expect(page.getByText(/Renovación registrada/)).toBeVisible();

    await page.getByRole('link', { name: 'Personas / Trabajadores', exact: true }).click();
    await page
      .locator('article')
      .filter({ hasText: workerName })
      .getByRole('link', { name: 'Abrir espacio de trabajo' })
      .click();
    await expect(page.locator('[id^="training-completion-"]')).toHaveCount(2);
    await expect(page.getByText(/registro anterior permanece preservado/)).toBeVisible();

    for (const width of [320, 640]) {
      await page.setViewportSize({ width, height: 844 });
      const overflow = await horizontalOverflowSources(page);
      expect(overflow, JSON.stringify(overflow, null, 2)).toEqual([]);
    }
  });

  test('registra, prioriza y resuelve una observación preventiva independiente', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const suffix = Date.now();
    const sessionId = await prepareDemoRegistration(page);
    const registration = await registerE2eUser({
      displayName: 'Owner Observaciones E2E',
      email: `observation-owner-${suffix}@example.test`,
      password: 'observation-e2e-password-strong-123',
    });
    expect(registration.statusCode, registration.body).toBe(201);
    await activateE2eUserSession(
      page,
      registration,
      `/app/organizations?sessionId=${encodeURIComponent(sessionId)}`,
    );
    await page.getByLabel('Nombre de empresa').fill(`Organización Observaciones ${suffix}`);
    await page.getByLabel('Sector').fill('Operación industrial sintética');
    await page.getByRole('button', { name: 'Crear y activar demo' }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByText(/Demostración conceptual activa/)).toBeVisible();
    await page.getByRole('link', { name: 'Observaciones de seguridad', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Observaciones de seguridad' })).toBeVisible();
    const title = `Cable fuera de canaleta ${suffix}`;
    await page.getByLabel('Título').fill(title);
    await page
      .getByLabel('Descripción breve')
      .fill('Condición preventiva sintética para seguimiento.');
    await page
      .getByRole('combobox', { name: 'Centro de trabajo', exact: true })
      .selectOption({ index: 1 });
    await page.getByLabel('Prioridad de atención interna').selectOption('HIGH');
    await page.getByRole('button', { name: 'Registrar observación' }).click();
    await page.waitForURL(/\/app\/safety-observations\/[0-9a-f-]+$/);
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await page.getByLabel('Nota de evidencia').fill('Referencia preventiva revisada en sitio.');
    await page.getByRole('button', { name: 'Añadir referencia de evidencia' }).click();
    await expect(page.getByText(/Referencia preventiva revisada en sitio/)).toBeVisible();
    await page.getByRole('button', { name: 'Iniciar revisión' }).click();
    const observationStatus = page.locator('main .workspace-context-summary');
    await expect(observationStatus.getByText('En revisión', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Requiere acción' }).click();
    await expect(observationStatus.getByText('Requiere acción', { exact: true })).toBeVisible();
    await page
      .getByLabel('Nota de resolución profesional')
      .fill('Condición atendida y verificada por el profesional.');
    await page.getByRole('button', { name: 'Resolver con verificación' }).click();
    await expect(page.getByText('Resuelta', { exact: true })).toBeVisible();
    await expect(page.getByText(/Condición atendida y verificada/)).toBeVisible();
    await page.getByRole('link', { name: 'Cola de trabajo', exact: true }).click();
    await expect(page.locator('article').filter({ hasText: title })).toHaveCount(0);
  });
});
