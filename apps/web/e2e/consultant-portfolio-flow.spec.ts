import { expect, test } from '@playwright/test';
import { createE2eOrganization, parseRegistration } from './support/e2e-api';
import { activateE2eUserSession, registerE2eUser } from './support/register-e2e-user';

test('portafolio aísla tenants y entitlements, explica fuentes y ancla la escritura', async ({
  page,
  request,
}) => {
  const suffix = Date.now();
  const password = 'portfolio-e2e-password-strong-123';
  const ownerRegistration = await registerE2eUser({
    displayName: 'Owner Portfolio E2E',
    email: `portfolio-owner-${suffix}@example.test`,
    password,
  });
  const consultantRegistration = await registerE2eUser({
    displayName: 'Consultant Portfolio E2E',
    email: `portfolio-consultant-${suffix}@example.test`,
    password,
  });
  const outsiderRegistration = await registerE2eUser({
    displayName: 'Outsider Portfolio E2E',
    email: `portfolio-outsider-${suffix}@example.test`,
    password,
  });
  const owner = parseRegistration(ownerRegistration);
  const consultant = parseRegistration(consultantRegistration);
  const orgA = await createE2eOrganization(
    request,
    ownerRegistration,
    `Empresa Alfa Portfolio ${suffix}`,
  );
  const orgB = await createE2eOrganization(
    request,
    ownerRegistration,
    `Empresa Beta Portfolio ${suffix}`,
  );
  const orgC = await createE2eOrganization(
    request,
    outsiderRegistration,
    `Empresa Oculta Portfolio ${suffix}`,
  );

  for (const [context, role] of [
    [orgA, 'CONSULTANT'],
    [orgB, 'VIEWER'],
  ] as const) {
    const invitationResponse = await request.post(
      `http://127.0.0.1:3101/api/v1/organizations/${context.organization.id}/invitations`,
      {
        headers: context.headers,
        data: { email: consultant.user.email, role },
      },
    );
    expect(invitationResponse.status()).toBe(201);
    const invitation = (await invitationResponse.json()) as { token: string };
    const acceptance = await request.post(
      'http://127.0.0.1:3101/api/v1/organization-invitations/accept',
      {
        headers: { authorization: `Bearer ${consultant.accessToken}` },
        data: { token: invitation.token },
      },
    );
    expect(acceptance.status()).toBe(201);
  }

  const [membersResponse, centersResponse] = await Promise.all([
    request.get(`http://127.0.0.1:3101/api/v1/organizations/${orgA.organization.id}/members`, {
      headers: orgA.headers,
    }),
    request.get(`http://127.0.0.1:3101/api/v1/organizations/${orgA.organization.id}/work-centers`, {
      headers: orgA.headers,
    }),
  ]);
  const members = (await membersResponse.json()) as Array<{ id: string }>;
  const centers = (await centersResponse.json()) as Array<{ id: string }>;
  const governanceBody = await request.post('http://127.0.0.1:3101/api/v1/governance/bodies', {
    headers: orgA.headers,
    data: {
      name: `Grupo portafolio ${suffix}`,
      category: 'WORK_GROUP',
      workCenterId: centers[0]!.id,
    },
  });
  const bodyId = ((await governanceBody.json()) as { id: string }).id;
  const meetingResponse = await request.post(
    `http://127.0.0.1:3101/api/v1/governance/bodies/${bodyId}/meetings`,
    {
      headers: orgA.headers,
      data: {
        title: `Revisión de portafolio ${suffix}`,
        scheduledAt: '2026-08-20T14:00:00.000Z',
        mode: 'VIRTUAL',
        chairMembershipId: members[0]!.id,
        participantMemberIds: [],
        agendaItems: [],
      },
    },
  );
  const meetingId = ((await meetingResponse.json()) as { id: string }).id;
  for (const status of ['SCHEDULED', 'HELD']) {
    const transition = await request.post(
      `http://127.0.0.1:3101/api/v1/governance/meetings/${meetingId}/transition`,
      { headers: orgA.headers, data: { status } },
    );
    expect(transition.status()).toBe(201);
  }
  const decisionResponse = await request.post(
    `http://127.0.0.1:3101/api/v1/governance/meetings/${meetingId}/decisions`,
    { headers: orgA.headers, data: { summary: 'Seguimiento sintético de portafolio.' } },
  );
  const decisionId = ((await decisionResponse.json()) as { id: string }).id;
  for (const index of [1, 2, 3]) {
    const action = await request.post(
      `http://127.0.0.1:3101/api/v1/governance/decisions/${decisionId}/actions`,
      {
        headers: orgA.headers,
        data: {
          title: `Acción portafolio vencida ${index} ${suffix}`,
          dueAt: '2026-08-25T12:00:00.000Z',
          priority: 'HIGH',
        },
      },
    );
    expect(action.status()).toBe(201);
  }
  const evidence = await request.post('http://127.0.0.1:3101/api/v1/evidence-packages', {
    headers: orgA.headers,
    data: {
      title: `Paquete portafolio ${suffix}`,
      scope: 'Evidencia sintética pendiente.',
    },
  });
  expect(evidence.status()).toBe(201);
  const evaluation = await request.post(
    'http://127.0.0.1:3101/api/v1/operational-intelligence/signals/evaluate',
    { headers: orgA.headers },
  );
  expect(evaluation.status()).toBe(201);

  await test.step('Consultant Portfolio and tenant isolation', async () => {
    await activateE2eUserSession(page, consultantRegistration, '/app/portfolio');
    await expect(page.getByRole('heading', { name: 'Portafolio operativo' })).toBeVisible();
    await expect(
      page.locator('.portfolio-organization-card').filter({ hasText: orgA.organization.name }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Organizaciones' }).click();
    await expect(
      page.locator('.portfolio-organization-card').filter({ hasText: orgB.organization.name }),
    ).toBeVisible();
    await expect(page.getByText(orgC.organization.name)).toHaveCount(0);
    await expect(page.getByText('Procesamiento local controlado · sin IA externa')).toBeVisible();
  });

  await test.step('per-organization entitlement', async () => {
    await page.getByRole('button', { name: 'Preguntar / Operar' }).click();
    await page
      .getByLabel('Pregunta sobre tu portafolio')
      .fill(`Resume los incidentes de ${orgB.organization.name}`);
    await page.getByRole('button', { name: 'Consultar' }).click();
    await expect(page.getByText('SOURCE_NOT_AVAILABLE')).toBeVisible();
    await expect(page.getByText(/módulo de incidentes no está disponible/)).toBeVisible();
  });

  await test.step('Copilot read with citations', async () => {
    await page
      .getByLabel('Pregunta sobre tu portafolio')
      .fill('¿Dónde se están repitiendo hallazgos?');
    await page.getByRole('button', { name: 'Consultar' }).click();
    await expect(page.getByText('ANSWERED')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Fuentes' })).toBeVisible();
    await expect(
      page.locator('.portfolio-citations').getByText(orgA.organization.name),
    ).toBeVisible();
  });

  await test.step('deep-link context switch', async () => {
    await page.locator('.portfolio-citations button').first().click();
    await expect(page).toHaveURL(/\/app\/intelligence\?signal=/);
    await expect(page.getByLabel('Organización activa')).toContainText(orgA.organization.name);
    await page.goto('/app/portfolio');
  });

  await test.step('single-organization write anchoring', async () => {
    await page.getByRole('button', { name: 'Preguntar / Operar' }).click();
    await page
      .getByLabel('Pregunta sobre tu portafolio')
      .fill(`Quiero crear una acción para ${orgA.organization.name}`);
    await page.getByRole('button', { name: 'Consultar' }).click();
    await expect(page.getByText(`Contexto requerido: ${orgA.organization.name}`)).toBeVisible();
    await expect(page.getByText(/La acción no se ha creado/)).toBeVisible();
    await page.getByRole('button', { name: 'Establecer contexto y continuar' }).click();
    await expect(page).toHaveURL('/app/assistant');
    await expect(page.getByLabel('Organización activa')).toContainText(orgA.organization.name);
  });

  await test.step('responsive portfolio', async () => {
    await page.goto('/app/portfolio');
    for (const width of [320, 640]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
  });

  expect(owner.user.id).not.toBe(consultant.user.id);
});
