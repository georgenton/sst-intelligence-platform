import { expect, test } from '@playwright/test';
import { createE2eOrganization, markE2eOrganizationLegacyConfigured } from './support/e2e-api';
import { activateE2eUserSession, registerE2eUser } from './support/register-e2e-user';

test('registra reunión, decisión, compromiso y evidencia de gobernanza', async ({
  page,
  request,
}) => {
  const suffix = Date.now();
  const registration = await registerE2eUser({
    displayName: 'Owner Gobernanza E2E',
    email: `governance-owner-${suffix}@example.test`,
    password: 'governance-e2e-password-123',
  });
  const context = await createE2eOrganization(request, registration, `Gobernanza E2E ${suffix}`);
  await markE2eOrganizationLegacyConfigured(context.organization.id, context.session.user.id);
  await activateE2eUserSession(page, registration, '/app/governance');
  await expect(page.getByRole('heading', { name: 'Gobernanza' })).toBeVisible();

  const bodyName = `Comité interno ${suffix}`;
  await page.getByLabel('Nombre').fill(bodyName);
  await page.getByLabel('Tipo').selectOption('COMMITTEE');
  await page.getByRole('button', { name: 'Crear espacio' }).click();
  await expect(page.getByRole('button', { name: new RegExp(bodyName) })).toBeVisible();

  await page.getByLabel('Cuenta participante').selectOption({ label: 'Owner Gobernanza E2E' });
  await page.getByLabel('Rol en el espacio').fill('Presidencia interna');
  await page.getByRole('button', { name: 'Agregar participante' }).click();
  await expect(page.getByText('Presidencia interna')).toBeVisible();

  const meetingTitle = `Seguimiento preventivo ${suffix}`;
  await page.getByLabel('Título').fill(meetingTitle);
  await page.getByLabel('Fecha y hora').fill('2026-09-15T09:00');
  await page.getByLabel('Modalidad').selectOption('HYBRID');
  await page.getByLabel('Lugar o enlace').fill('Sala y enlace interno');
  await page.getByLabel('Presidencia').selectOption({ label: 'Owner Gobernanza E2E' });
  await page.getByLabel('Primer punto de agenda').fill('Revisar compromisos operativos');
  await page.getByRole('button', { name: 'Crear reunión' }).click();
  const meetingCard = page.locator('.card').filter({ hasText: meetingTitle });
  await expect(meetingCard).toBeVisible();
  await meetingCard.getByRole('button', { name: 'Programar' }).click();
  await meetingCard.getByRole('button', { name: 'Registrar como realizada' }).click();
  await expect(meetingCard.getByText('Realizada')).toBeVisible();

  await page.getByLabel('Reunión realizada').selectOption({ label: meetingTitle });
  await page.getByLabel('Decisión').fill('Priorizar el seguimiento documental interno.');
  await page
    .getByLabel('Fundamento interno')
    .fill('Acuerdo registrado por las personas participantes.');
  await page.getByRole('button', { name: 'Registrar decisión' }).click();
  await expect(page.getByText('Priorizar el seguimiento documental interno.')).toBeVisible();

  const actionTitle = `Preparar seguimiento ${suffix}`;
  await meetingCard.getByLabel('Nuevo compromiso').fill(actionTitle);
  await meetingCard.getByRole('button', { name: 'Agregar' }).click();
  await expect(meetingCard.getByText(new RegExp(`Compromiso: ${actionTitle}`))).toBeVisible();
  await meetingCard.getByLabel('Nota de evidencia').fill('Acta interna revisada en la sesión.');
  await meetingCard.getByRole('button', { name: 'Adjuntar nota' }).click();
  await expect(page.getByRole('status')).toContainText('Registro actualizado');

  await page.getByRole('link', { name: 'Cola de trabajo', exact: true }).click();
  await page.getByLabel('Módulo').selectOption('GOVERNANCE');
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
  const queueItem = page.getByRole('listitem').filter({ hasText: actionTitle });
  await expect(queueItem).toBeVisible();
  await expect(queueItem.getByText('Gobernanza')).toBeVisible();
  await expect(queueItem.getByRole('link', { name: 'Abrir' })).toHaveAttribute(
    'href',
    /\/app\/governance\?meeting=.*&action=.*/,
  );
  expect(context.organization.name).toContain('Gobernanza E2E');
});
