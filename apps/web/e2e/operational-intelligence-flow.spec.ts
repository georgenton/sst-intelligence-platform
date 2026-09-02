import { expect, test } from '@playwright/test';
import { createE2eOrganization } from './support/e2e-api';
import { activateE2eUserSession, registerE2eUser } from './support/register-e2e-user';

test('deriva una señal operativa explicable y la proyecta a la cola', async ({ page, request }) => {
  const suffix = Date.now();
  const registration = await registerE2eUser({
    displayName: 'Owner Señales E2E',
    email: `signals-owner-${suffix}@example.test`,
    password: 'signals-e2e-password-123',
  });
  const context = await createE2eOrganization(request, registration, `Señales E2E ${suffix}`);
  const [membersResponse, centersResponse] = await Promise.all([
    request.get(`http://127.0.0.1:3101/api/v1/organizations/${context.organization.id}/members`, {
      headers: context.headers,
    }),
    request.get(
      `http://127.0.0.1:3101/api/v1/organizations/${context.organization.id}/work-centers`,
      { headers: context.headers },
    ),
  ]);
  expect(membersResponse.status()).toBe(200);
  expect(centersResponse.status()).toBe(200);
  const membership = (await membersResponse.json()) as Array<{ id: string }>;
  const centers = (await centersResponse.json()) as Array<{ id: string; name: string }>;
  const bodyResponse = await request.post('http://127.0.0.1:3101/api/v1/governance/bodies', {
    headers: context.headers,
    data: {
      name: `Grupo de acciones ${suffix}`,
      category: 'WORK_GROUP',
      workCenterId: centers[0]!.id,
    },
  });
  expect(bodyResponse.status()).toBe(201);
  const body = (await bodyResponse.json()) as { id: string };
  const meetingResponse = await request.post(
    `http://127.0.0.1:3101/api/v1/governance/bodies/${body.id}/meetings`,
    {
      headers: context.headers,
      data: {
        title: `Decisiones para señal ${suffix}`,
        scheduledAt: '2026-08-20T14:00:00.000Z',
        mode: 'IN_PERSON',
        chairMembershipId: membership[0]!.id,
        participantMemberIds: [],
        agendaItems: [],
      },
    },
  );
  expect(meetingResponse.status()).toBe(201);
  const meeting = (await meetingResponse.json()) as { id: string };
  for (const status of ['SCHEDULED', 'HELD']) {
    const transition = await request.post(
      `http://127.0.0.1:3101/api/v1/governance/meetings/${meeting.id}/transition`,
      { headers: context.headers, data: { status } },
    );
    expect(transition.status()).toBe(201);
  }
  const decisionResponse = await request.post(
    `http://127.0.0.1:3101/api/v1/governance/meetings/${meeting.id}/decisions`,
    { headers: context.headers, data: { summary: 'Ejecutar tres seguimientos operativos.' } },
  );
  expect(decisionResponse.status()).toBe(201);
  const decision = (await decisionResponse.json()) as { id: string };
  for (const index of [1, 2, 3]) {
    const action = await request.post(
      `http://127.0.0.1:3101/api/v1/governance/decisions/${decision.id}/actions`,
      {
        headers: context.headers,
        data: {
          title: `Seguimiento vencido ${index} ${suffix}`,
          dueAt: '2026-08-25T12:00:00.000Z',
          priority: 'MEDIUM',
        },
      },
    );
    expect(action.status()).toBe(201);
  }

  await activateE2eUserSession(page, registration, '/app/intelligence');
  await expect(page.getByRole('heading', { name: 'Señales operativas' })).toBeVisible();
  await page.getByRole('button', { name: 'Evaluar registros actuales' }).click();
  const signalButton = page.getByRole('button', {
    name: /Concentración de acciones vencidas/,
  });
  await expect(signalButton).toBeVisible();
  await expect(page.getByText(/3 acciones continúan abiertas/)).toBeVisible();
  await expect(page.getByText(/no predicen eventos ni detectan causas raíz/)).toBeVisible();
  await expect(page.getByText('3 / umbral 3')).toBeVisible();
  await expect(signalButton).toContainText(centers[0]!.name);

  await page.getByRole('link', { name: 'Cola de trabajo', exact: true }).click();
  await page.getByLabel('Módulo').selectOption('INTELLIGENCE');
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
  const queueItem = page
    .getByRole('listitem')
    .filter({ hasText: 'Concentración de acciones vencidas' });
  await expect(queueItem).toBeVisible();
  await expect(queueItem.getByText('Inteligencia operativa')).toBeVisible();
  await expect(queueItem.getByRole('link', { name: 'Abrir' })).toHaveAttribute(
    'href',
    /\/app\/intelligence\?signal=/,
  );
});
