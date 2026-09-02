import { expect, test } from '@playwright/test';
import { createE2eOrganization } from './support/e2e-api';
import { activateE2eUserSession, registerE2eUser } from './support/register-e2e-user';

test('finaliza un paquete canónico y muestra su resumen documental', async ({ page, request }) => {
  const suffix = Date.now();
  const registration = await registerE2eUser({
    displayName: 'Owner Evidencia E2E',
    email: `evidence-owner-${suffix}@example.test`,
    password: 'evidence-e2e-password-123',
  });
  const context = await createE2eOrganization(request, registration, `Evidencia E2E ${suffix}`);
  const bodyResponse = await request.post('http://127.0.0.1:3101/api/v1/governance/bodies', {
    headers: context.headers,
    data: { name: `Fuente evidencia ${suffix}`, category: 'WORK_GROUP' },
  });
  expect(bodyResponse.status()).toBe(201);
  const body = (await bodyResponse.json()) as { id: string };
  const meetingResponse = await request.post(
    `http://127.0.0.1:3101/api/v1/governance/bodies/${body.id}/meetings`,
    {
      headers: context.headers,
      data: {
        title: `Reunión fuente ${suffix}`,
        scheduledAt: '2026-09-18T14:00:00.000Z',
        mode: 'VIRTUAL',
        participantMemberIds: [],
        agendaItems: [],
      },
    },
  );
  expect(meetingResponse.status()).toBe(201);
  const meeting = (await meetingResponse.json()) as { id: string; title: string };

  await activateE2eUserSession(page, registration, '/app/evidence-packages');
  await expect(page.getByRole('heading', { name: 'Paquetes de evidencia' })).toBeVisible();
  const title = `Paquete documental ${suffix}`;
  await page.getByLabel('Título').fill(title);
  await page.getByLabel('Alcance').fill('Seguimiento interno de una reunión registrada.');
  await page.getByRole('button', { name: 'Crear paquete' }).click();
  await expect(page.getByRole('button', { name: new RegExp(title) })).toBeVisible();

  await page.getByLabel('Tipo de registro').selectOption('GOVERNANCE_MEETING');
  await page.getByLabel('Identificador canónico').fill(meeting.id);
  await page.getByRole('button', { name: 'Agregar referencia' }).click();
  await expect(page.getByText(meeting.title)).toBeVisible();
  await page.getByRole('button', { name: 'Finalizar manifiesto' }).click();
  await expect(page.getByText('Finalizado', { exact: true })).toBeVisible();
  const report = page.getByRole('region', { name: 'Representación imprimible del paquete' });
  await expect(report.getByRole('heading', { name: 'Paquete de evidencia' })).toBeVisible();
  await expect(report.getByText('Estado registrado en la plataforma')).toBeVisible();
  await expect(report.getByText(/no declara empresa certificada/i)).toBeVisible();
  await expect(report.locator('code').first()).toHaveText(/^[a-f0-9]{64}$/);
  await expect(page.getByRole('button', { name: 'Imprimir resumen' })).toBeVisible();
});
