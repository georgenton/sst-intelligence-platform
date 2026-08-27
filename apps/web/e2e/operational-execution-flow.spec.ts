import { expect, test } from '@playwright/test';
import { registerE2eUser } from './support/register-e2e-user';

test('actividad interna, cola operativa y cierre trazable', async ({ page }) => {
  test.setTimeout(90_000);
  const suffix = Date.now();
  const email = `operations-e2e-${suffix}@example.test`;
  const password = 'operations-e2e-password-123';
  const organizationName = `Operación E2E ${suffix}`;
  const activityTitle = `Verificar control interno ${suffix}`;

  const registration = await registerE2eUser({
    displayName: 'Responsable Operativo E2E',
    email,
    password,
  });
  expect(registration.statusCode, registration.body).toBe(201);

  await page.goto('/auth/login');
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.getByRole('link', { name: 'Crear organización' }).click();
  await page.getByLabel('Nombre de empresa').fill(organizationName);
  await page.getByLabel('Sector').fill('Servicios operativos');
  await page.getByRole('button', { name: 'Crear organización' }).click();
  await expect(page.getByText('Organización creada correctamente.')).toBeVisible();

  await page.getByRole('link', { name: 'Cola de trabajo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Cola de trabajo' })).toBeVisible();
  await page.getByRole('link', { name: 'Nueva actividad' }).click();
  await page.getByLabel('Título').fill(activityTitle);
  await page.getByLabel('Descripción').fill('Actividad sintética de validación E2E.');
  await page.getByLabel('Referencia del programa interno').fill('PROGRAMA-E2E');
  await page.getByLabel('Prioridad').selectOption('HIGH');
  await page.getByRole('button', { name: 'Crear actividad' }).click();

  await expect(page.getByRole('heading', { name: activityTitle })).toBeVisible();
  await expect(page.getByText('Programa interno', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Iniciar' }).click();
  await expect(page.getByText('En curso', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Volver a la cola' }).click();

  const queueItem = page.getByRole('listitem').filter({ hasText: activityTitle });
  await expect(queueItem).toBeVisible();
  await expect(queueItem.getByText('Alta prioridad')).toBeVisible();
  await queueItem.getByRole('link', { name: 'Abrir' }).click();
  await page.getByRole('button', { name: 'Completar' }).click();

  await expect(page.getByText('Completado', { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      'Esta actividad está finalizada y permanece disponible como registro histórico.',
    ),
  ).toBeVisible();

  await page.setViewportSize({ width: 320, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await expect(
    page.getByText('La revisión y el cierre no certifican cumplimiento legal.'),
  ).toBeVisible();
});
