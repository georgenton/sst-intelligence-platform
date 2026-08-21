import { request as httpRequest } from 'node:http';
import { networkInterfaces } from 'node:os';
import { expect, test } from '@playwright/test';

function registerAdaptiveUser(data: { displayName: string; email: string; password: string }) {
  const body = JSON.stringify(data);
  const localAddress = Object.values(networkInterfaces())
    .flatMap((addresses) => addresses ?? [])
    .find((address) => address.family === 'IPv4' && !address.internal)?.address;
  if (!localAddress) throw new Error('E2E_NON_LOOPBACK_IPV4_UNAVAILABLE');
  return new Promise<{ body: string; statusCode: number | undefined }>((resolve, reject) => {
    const registration = httpRequest(
      {
        hostname: localAddress,
        port: 3101,
        path: '/api/v1/auth/register',
        method: 'POST',
        localAddress,
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () =>
          resolve({
            body: Buffer.concat(chunks).toString('utf8'),
            statusCode: response.statusCode,
          }),
        );
      },
    );
    registration.on('error', reject);
    registration.end(body);
  });
}

async function expectNoDocumentOverflow(page: import('@playwright/test').Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
}

test('preguntas adaptativas, propuesta por centro y estado actual declarado', async ({ page }) => {
  test.setTimeout(90_000);
  const suffix = Date.now();
  const email = `adaptive-e2e-${suffix}@example.test`;
  const password = 'adaptive-e2e-password-123';
  const registration = await registerAdaptiveUser({
    displayName: 'Responsable Adaptativo E2E',
    email,
    password,
  });
  expect(registration.statusCode, registration.body).toBe(201);

  await page.goto('/auth/login');
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.getByRole('link', { name: 'Crear organización' }).click();
  await page.getByLabel('Nombre de empresa').fill(`Adaptativa Demo ${suffix}`);
  await page.getByLabel('Sector').fill('Servicios administrativos');
  await page.getByRole('button', { name: 'Crear organización' }).click();
  await expect(page.getByText('Organización creada correctamente.')).toBeVisible();

  await page.getByRole('link', { name: 'Configuración SST', exact: true }).click();
  await page.getByRole('link', { name: 'Nueva evaluación de aplicabilidad' }).click();
  await page.getByLabel('Personas trabajadoras · opcional').fill('6');
  await page
    .getByRole('group', { name: '¿Existen procesos químicos?' })
    .getByLabel('No', { exact: true })
    .check();
  await page
    .getByRole('group', { name: '¿Existen operaciones de alta energía?' })
    .getByLabel('No', { exact: true })
    .check();
  await page.getByRole('button', { name: 'Crear versión del perfil' }).click();
  await expect(page.getByRole('heading', { name: 'Versión creada' })).toBeVisible();
  await page.goto('/app/applicability');

  await page.getByRole('link', { name: 'Configuración dinámica' }).click();
  await expect(page.getByRole('heading', { name: 'Configuración dinámica' })).toBeVisible();
  await page.getByRole('link', { name: 'Nueva sesión dinámica' }).click();
  await page.getByLabel('Versión del perfil').selectOption({ index: 1 });
  await page
    .getByLabel('Pack publicado')
    .selectOption({ label: 'Configuración SST adaptativa DEMO · v1.0.0' });
  await page.getByLabel('Personas y salud').check();
  await expect(page.getByText(/reglas sintéticas de demostración/i).first()).toBeVisible();
  await page.getByRole('button', { name: 'Iniciar sesión dinámica' }).click();

  await page.setViewportSize({ width: 320, height: 844 });
  await expect(page.getByRole('heading', { name: 'Preguntas relevantes' })).toBeVisible();
  await expect(page.getByText(/No existe un cuestionario fijo/)).toBeVisible();
  await expectNoDocumentOverflow(page);
  await page.getByLabel('¿Cómo trabaja principalmente este centro?').selectOption('PHYSICAL');
  await page
    .getByLabel('¿Cuál describe mejor la actividad principal de este centro?')
    .selectOption('ADMINISTRATIVE_SERVICES');
  await page.getByLabel('¿En este centro se realizan trabajos en altura?').selectOption('false');
  await page.getByLabel('¿Se ingresa a espacios confinados?').selectOption('false');
  await page
    .getByLabel('¿Trabajan contratistas o personal de otras empresas?')
    .selectOption('false');
  await page.getByRole('button', { name: 'Guardar y reevaluar' }).click();

  await expect(page.getByLabel(/oficina, planta, bodega/)).toBeVisible();
  await page.getByLabel(/oficina, planta, bodega/).selectOption('OFFICE');
  await page
    .getByLabel('¿El centro tiene zonas operativas claramente distintas?')
    .selectOption('false');
  await page.getByRole('button', { name: 'Guardar y reevaluar' }).click();
  await expect(
    page.getByText('Ya tenemos suficiente información para generar una propuesta'),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Propuesta de configuración' })).toBeVisible();
  await expect(page.getByText(/no activa una configuración/i)).toBeVisible();
  await expectNoDocumentOverflow(page);

  const firstItem = page.locator('article.adaptive-proposal-item').first();
  await expect(firstItem).toBeVisible();
  await firstItem.locator('.adaptive-current-state select').first().selectOption('IMPLEMENTED');
  await firstItem.getByRole('button', { name: 'Guardar estado' }).click();
  await expect(firstItem.getByText('Evidencia declarada y no verificada')).toBeVisible();
  await firstItem.getByLabel('Tipo').selectOption('EXTERNAL_LINK');
  await firstItem.getByLabel('URL HTTPS').fill('https://example.com/evidencia-demo-e2e');
  await firstItem.getByRole('button', { name: 'Añadir referencia' }).click();
  await expect(
    firstItem.getByRole('link', { name: 'Abrir enlace externo declarado' }),
  ).toHaveAttribute('href', 'https://example.com/evidencia-demo-e2e');
  await firstItem.getByText('Ver traza técnica').click();
  await expect(firstItem.getByText(/Reglas versionadas:/)).toBeVisible();
  await expectNoDocumentOverflow(page);

  await page.setViewportSize({ width: 640, height: 900 });
  await expectNoDocumentOverflow(page);
  await page.getByRole('link', { name: 'Volver al historial' }).click();
  await expect(page.getByRole('heading', { name: 'Sesiones anteriores' })).toBeVisible();
  await page.getByRole('link', { name: 'Abrir sesión' }).click();
  await expect(page.getByText(/Evaluación #/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Propuesta de configuración' })).toBeVisible();
});
