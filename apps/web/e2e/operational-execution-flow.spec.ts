import { expect, test, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { registerE2eUser } from './support/register-e2e-user';

async function prepareDemoRegistration(page: Page) {
  await page.goto('/diagnostico');
  await page.getByRole('button', { name: 'Comenzar' }).click();
  await expect(page.getByText('Paso 1 de 6')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar y continuar' }).click();
  await expect(page.getByText('Paso 2 de 6')).toBeVisible();
  await page.getByLabel('Actividades críticas').check();
  await page.getByRole('button', { name: 'Guardar y continuar' }).click();
  await expect(page.getByText('Paso 3 de 6')).toBeVisible();
  await page.getByLabel('Permisos manuales').check();
  await page.getByRole('button', { name: 'Guardar y continuar' }).click();
  await expect(page.getByText('Paso 4 de 6')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar y continuar' }).click();
  await expect(page.getByText('Paso 5 de 6')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar y continuar' }).click();
  await expect(page.getByText('Paso 6 de 6')).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/diagnostico\/[0-9a-f-]+\/resultado$/),
    page.getByRole('button', { name: 'Ver recomendación' }).click(),
  ]);
  const registrationHref = await page
    .getByRole('link', { name: 'Crear cuenta y continuar' })
    .getAttribute('href');
  const sessionId = registrationHref
    ? new URL(registrationHref, 'http://e2e.local').searchParams.get('sessionId')
    : null;
  if (!sessionId) throw new Error('E2E_DIAGNOSTIC_SESSION_ID_MISSING');
  return sessionId;
}

async function login(page: Page, email: string, password: string) {
  await page.goto('/auth/login');
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Centro de comando' })).toBeVisible();
}

test('obligación visible durante setup y permiso demo con aprobación separada', async ({
  page,
}) => {
  test.setTimeout(150_000);
  const prisma = new PrismaClient();
  const suffix = Date.now();
  const ownerEmail = `operations-owner-${suffix}@example.test`;
  const managerEmail = `operations-manager-${suffix}@example.test`;
  const password = 'operations-e2e-password-123';
  const organizationName = `Operación E2E ${suffix}`;
  const activityTitle = `Revisar control interno ${suffix}`;
  const permitTitle = `Intervención controlada ${suffix}`;

  try {
    const sessionId = await prepareDemoRegistration(page);
    const ownerRegistration = await registerE2eUser({
      displayName: 'Solicitante Operativo E2E',
      email: ownerEmail,
      password,
    });
    const managerRegistration = await registerE2eUser({
      displayName: 'Responsable SST E2E',
      email: managerEmail,
      password,
    });
    expect(ownerRegistration.statusCode, ownerRegistration.body).toBe(201);
    expect(managerRegistration.statusCode, managerRegistration.body).toBe(201);
    const managerId = (JSON.parse(managerRegistration.body) as { user: { id: string } }).user.id;

    await page.goto(`/auth/login?sessionId=${encodeURIComponent(sessionId)}`);
    await page.getByLabel('Correo').fill(ownerEmail);
    await page.getByLabel('Contraseña').fill(password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.getByLabel('Nombre de empresa').fill(organizationName);
    await page.getByLabel('Sector').fill('Servicios operativos');
    await page.getByRole('button', { name: 'Crear y activar demo' }).click();
    await expect(page.getByText(/Demostración conceptual activa/)).toBeVisible();

    const organization = await prisma.organization.findFirstOrThrow({
      where: { name: organizationName },
      select: { id: true },
    });
    await prisma.membership.create({
      data: {
        organizationId: organization.id,
        userId: managerId,
        role: 'SST_MANAGER',
        status: 'ACTIVE',
      },
    });

    await page.getByRole('link', { name: 'Cola de trabajo', exact: true }).click();
    await page.getByRole('link', { name: 'Nueva actividad' }).click();
    await page.getByLabel('Título').fill(activityTitle);
    await page.getByLabel('Descripción').fill('Actividad sintética de validación E2E.');
    await page.getByLabel('Referencia del programa interno').fill('PROGRAMA-E2E');
    await page.getByLabel('Prioridad').selectOption('HIGH');
    await page.getByLabel('Requiere revisión profesional antes de completarse').check();
    await page.getByRole('button', { name: 'Crear actividad' }).click();
    await page.getByRole('button', { name: 'Iniciar' }).click();
    await page.getByRole('button', { name: 'Enviar a revisión' }).click();
    await expect(page.getByText('Listo para revisión', { exact: true })).toBeVisible();

    await page.getByRole('link', { name: 'Inicio', exact: true }).click();
    const obligationAttention = page.locator('article').filter({ hasText: activityTitle });
    await expect(obligationAttention).toBeVisible();
    await expect(obligationAttention.getByText('Alta')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Completa también la configuración inicial de SST' }),
    ).toBeVisible();

    await page.getByRole('link', { name: 'Permisos de trabajo', exact: true }).click();
    await page.getByRole('link', { name: 'Nuevo permiso' }).click();
    await page.getByLabel('Plantilla').selectOption({ index: 1 });
    await page
      .getByLabel('Centro de trabajo')
      .selectOption({ label: 'Centro Guayaquil (demostración)' });
    await page.getByLabel('Área').fill('Sala de máquinas');
    await page.getByLabel('Actividad').fill(permitTitle);
    const start = new Date(Date.now() + 3_600_000).toISOString().slice(0, 16);
    const end = new Date(Date.now() + 7_200_000).toISOString().slice(0, 16);
    await page.getByLabel('Inicio planificado').fill(start);
    await page.getByLabel('Fin planificado').fill(end);
    await page.getByLabel('Peligros identificados').fill('Energía residual');
    await page.getByLabel('Controles').fill('Aislamiento documentado');
    await page.getByLabel('Precondiciones').fill('Confirmar ausencia de energía');
    await page.getByLabel('Referencias de evidencia').fill('Registro interno E2E');
    await page.getByRole('button', { name: 'Crear borrador' }).click();
    await expect(page.getByText('Borrador', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Enviar a aprobación' }).click();
    await expect(page.getByText('Pendiente de aprobación', { exact: true })).toBeVisible();
    await expect(
      page.getByText('La persona solicitante no puede autorizar su propio permiso.'),
    ).toBeVisible();

    await page.getByRole('link', { name: 'Inicio', exact: true }).click();
    const permitAttention = page.locator('article').filter({ hasText: permitTitle });
    await expect(permitAttention).toBeVisible();
    await expect(permitAttention.getByText('Permisos de trabajo')).toBeVisible();
    await permitAttention.getByRole('link', { name: 'Abrir' }).click();
    await expect(page.getByRole('heading', { name: permitTitle })).toBeVisible();

    await page.getByRole('button', { name: 'Salir' }).click();
    await login(page, managerEmail, password);
    const managerPermitAttention = page.locator('article').filter({ hasText: permitTitle });
    await expect(managerPermitAttention).toBeVisible();
    await managerPermitAttention.getByRole('link', { name: 'Abrir' }).click();
    await page.getByRole('button', { name: 'Autorizar' }).click();
    await expect(page.getByText('Autorizado', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Iniciar actividad' }).click();
    await expect(page.getByText('Activo', { exact: true })).toBeVisible();
    await page.getByLabel('Nota de cierre').fill('Actividad finalizada y área liberada.');
    await page.getByRole('button', { name: 'Cerrar permiso' }).click();
    await expect(page.getByText('Cerrado', { exact: true })).toBeVisible();

    await page.setViewportSize({ width: 320, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  } finally {
    await prisma.$disconnect();
  }
});
