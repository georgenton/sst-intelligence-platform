import { expect, test, type Page } from '@playwright/test';
import { createE2eOrganization, parseRegistration } from './support/e2e-api';
import { activateE2eUserSession, registerE2eUser } from './support/register-e2e-user';
import { navigateToReadyPortfolio } from './support/portfolio-readiness';

async function applyPortfolioSearch(page: Page, search: string) {
  const portfolioResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      new URL(response.url()).pathname === '/api/v1/portfolio',
  );
  await page.getByLabel('Buscar organización').fill(search);
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  expect((await portfolioResponse).status()).toBe(200);
}

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
  const members = (await membersResponse.json()) as Array<{
    id: string;
    user: { email: string };
  }>;
  const consultantMembership = members.find(
    (membership) => membership.user.email === consultant.user.email,
  );
  expect(consultantMembership).toBeDefined();
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
    const orgACard = page
      .locator('.portfolio-organization-card')
      .filter({ hasText: orgA.organization.name });
    const orgBCard = page
      .locator('.portfolio-organization-card')
      .filter({ hasText: orgB.organization.name });
    await expect(orgACard.getByText('Consultor', { exact: true })).toBeVisible();
    await expect(orgBCard).toBeVisible();
    await expect(orgBCard.getByText('Consulta', { exact: true })).toBeVisible();
    await expect(page.getByText(orgC.organization.name)).toHaveCount(0);
    await expect(page.getByText('Procesamiento local controlado · sin IA externa')).toBeVisible();
  });

  await test.step('active organization B survives hard reload exactly', async () => {
    await page.getByLabel('Organización activa').selectOption(orgB.organization.id);
    await expect(page.getByLabel('Organización activa')).toHaveValue(orgB.organization.id);
    await expect(page.locator('#main-content')).toHaveAttribute('aria-busy', 'false');
    await navigateToReadyPortfolio(page, () => page.reload(), {
      userId: consultant.user.id,
      activeId: orgB.organization.id,
      organizationIds: [orgA.organization.id, orgB.organization.id],
      phase: 'active-B-hard-reload',
    });
  });

  await test.step('live per-organization role change', async () => {
    const consultantHeaders = {
      authorization: `Bearer ${consultant.accessToken}`,
      'x-organization-id': orgA.organization.id,
    };
    const deniedBeforePromotion = await request.patch(
      `http://127.0.0.1:3101/api/v1/organizations/${orgA.organization.id}`,
      {
        headers: consultantHeaders,
        data: { sector: 'No debe cambiar antes de promoción' },
      },
    );
    expect(deniedBeforePromotion.status()).toBe(403);

    const promotion = await request.patch(
      `http://127.0.0.1:3101/api/v1/organizations/${orgA.organization.id}/members/${consultantMembership!.id}/role`,
      { headers: orgA.headers, data: { role: 'ORG_ADMIN' } },
    );
    expect(promotion.status()).toBe(200);
    const allowedAfterPromotion = await request.patch(
      `http://127.0.0.1:3101/api/v1/organizations/${orgA.organization.id}`,
      {
        headers: consultantHeaders,
        data: { sector: 'Rol vigente verificado' },
      },
    );
    expect(allowedAfterPromotion.status()).toBe(200);

    await applyPortfolioSearch(page, 'Empresa');
    await page.getByRole('button', { name: 'Organizaciones' }).click();
    await expect(
      page
        .locator('.portfolio-organization-card')
        .filter({ hasText: orgA.organization.name })
        .getByText('Administrador', { exact: true }),
    ).toBeVisible();

    const demotion = await request.patch(
      `http://127.0.0.1:3101/api/v1/organizations/${orgA.organization.id}/members/${consultantMembership!.id}/role`,
      { headers: orgA.headers, data: { role: 'CONSULTANT' } },
    );
    expect(demotion.status()).toBe(200);
    const deniedAfterDemotion = await request.patch(
      `http://127.0.0.1:3101/api/v1/organizations/${orgA.organization.id}`,
      {
        headers: consultantHeaders,
        data: { sector: 'No debe cambiar después de degradación' },
      },
    );
    expect(deniedAfterDemotion.status()).toBe(403);
    await applyPortfolioSearch(page, 'Portfolio');
    await page.getByRole('button', { name: 'Organizaciones' }).click();
    await expect(
      page
        .locator('.portfolio-organization-card')
        .filter({ hasText: orgA.organization.name })
        .getByText('Consultor', { exact: true }),
    ).toBeVisible();
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
    await expect(page.getByLabel('Organización activa')).toHaveValue(orgA.organization.id);
    await page.goBack();
    await expect(page).toHaveURL(/\/app\/portfolio$/);
    await expect(page.getByRole('heading', { name: 'Portafolio operativo' })).toBeVisible();
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
    await expect(page.getByLabel('Organización activa')).toHaveValue(orgA.organization.id);
  });

  await test.step('responsive portfolio', async () => {
    // A document's load event is not auth/OrganizationContext/query readiness.
    // Establish the real session before the later revocation + reload scenario.
    await navigateToReadyPortfolio(page, () => page.goto('/app/portfolio'), {
      userId: consultant.user.id,
      activeId: orgA.organization.id,
      organizationIds: [orgA.organization.id, orgB.organization.id],
      phase: 'before-revocation',
    });
    for (const width of [320, 640]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
  });

  await test.step('membership revocation refetch and write-time authorization', async () => {
    const consultantHeaders = {
      authorization: `Bearer ${consultant.accessToken}`,
      'x-organization-id': orgA.organization.id,
    };
    const threadResponse = await request.post('http://127.0.0.1:3101/api/v1/conversations', {
      headers: consultantHeaders,
      data: { title: 'Prueba de revocación del portafolio', contextType: 'GLOBAL' },
    });
    expect(threadResponse.status()).toBe(201);
    const thread = (await threadResponse.json()) as { id: string };
    const proposalResponse = await request.post(
      `http://127.0.0.1:3101/api/v1/conversations/${thread.id}/actions`,
      {
        headers: consultantHeaders,
        data: {
          actionKey: 'create_inspection',
          idempotencyKey: `portfolio-revocation-${suffix}`,
          input: {
            workCenterId: centers[0]!.id,
            riskMethodVersionId: '00000000-0000-4000-8000-000000000036',
            inspectionDomain: 'ELECTRICAL',
            title: `No ejecutar después de revocación ${suffix}`,
          },
        },
      },
    );
    expect(proposalResponse.status()).toBe(201);
    const proposal = (await proposalResponse.json()) as { id: string };

    const portfolioBefore = await request.get('http://127.0.0.1:3101/api/v1/portfolio', {
      headers: { authorization: `Bearer ${consultant.accessToken}` },
    });
    expect(portfolioBefore.status()).toBe(200);
    const before = (await portfolioBefore.json()) as {
      organizations: Array<{ organization: { id: string } }>;
    };
    expect(before.organizations.some((item) => item.organization.id === orgA.organization.id)).toBe(
      true,
    );

    await expect(page.getByLabel('Organización activa')).toHaveValue(orgA.organization.id);
    const deactivation = await request.post(
      `http://127.0.0.1:3101/api/v1/organizations/${orgA.organization.id}/members/${consultantMembership!.id}/deactivate`,
      { headers: orgA.headers },
    );
    expect(deactivation.status()).toBe(201);

    const portfolioAfter = await request.get('http://127.0.0.1:3101/api/v1/portfolio', {
      headers: { authorization: `Bearer ${consultant.accessToken}` },
    });
    expect(portfolioAfter.status()).toBe(200);
    const after = (await portfolioAfter.json()) as {
      organizations: Array<{ organization: { id: string } }>;
    };
    expect(after.organizations.map((item) => item.organization.id)).toEqual([orgB.organization.id]);

    const deniedDomainRequest = await request.get(
      `http://127.0.0.1:3101/api/v1/organizations/${orgA.organization.id}`,
      { headers: consultantHeaders },
    );
    expect(deniedDomainRequest.status()).toBe(403);
    const deniedConfirmation = await request.post(
      `http://127.0.0.1:3101/api/v1/conversations/action-runs/${proposal.id}/confirm`,
      { headers: consultantHeaders, data: {} },
    );
    expect(deniedConfirmation.status()).toBe(403);

    await navigateToReadyPortfolio(page, () => page.reload(), {
      userId: consultant.user.id,
      activeId: orgB.organization.id,
      organizationIds: [orgB.organization.id],
      phase: 'revoked-A-hard-reload',
    });
    await page.getByRole('button', { name: 'Organizaciones' }).click();
    await expect(page.getByText(orgA.organization.name)).toHaveCount(0);
    await expect(
      page.locator('.portfolio-organization-card').filter({ hasText: orgB.organization.name }),
    ).toBeVisible();
    await expect(page.getByLabel('Organización activa')).toHaveValue(orgB.organization.id);
  });

  expect(owner.user.id).not.toBe(consultant.user.id);
});
