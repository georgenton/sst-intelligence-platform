import { request as httpRequest } from 'node:http';
import type { BrowserContext, Page } from '@playwright/test';

type E2eRegistration = {
  body: string;
  setCookie: string | undefined;
  statusCode: number | undefined;
};

const registrationApiPorts = [3102, 3103, 3104] as const;
let nextRegistrationApi = 0;

export function registerE2eUser(data: { displayName: string; email: string; password: string }) {
  const body = JSON.stringify(data);
  const port = registrationApiPorts[nextRegistrationApi % registrationApiPorts.length];
  nextRegistrationApi += 1;

  return new Promise<E2eRegistration>((resolve, reject) => {
    const registration = httpRequest(
      {
        hostname: '127.0.0.1',
        port,
        path: '/api/v1/auth/register',
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () =>
          resolve({
            body: Buffer.concat(chunks).toString('utf8'),
            setCookie: response.headers['set-cookie']?.[0],
            statusCode: response.statusCode,
          }),
        );
      },
    );
    registration.on('error', reject);
    registration.end(body);
  });
}

function refreshCookie(setCookie: string | undefined) {
  const pair = setCookie?.split(';', 1)[0];
  const separator = pair?.indexOf('=') ?? -1;
  if (!pair || separator < 1) throw new Error('E2E_REFRESH_COOKIE_MISSING');
  return { name: pair.slice(0, separator), value: pair.slice(separator + 1) };
}

export async function activateE2eUserSession(
  page: Page,
  registration: E2eRegistration,
  destination = '/app',
) {
  const cookie = refreshCookie(registration.setCookie);
  await addApiCookie(page.context(), cookie);
  const refreshed = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith('/api/v1/auth/refresh') &&
      response.status() === 201,
  );
  await page.goto(destination);
  await refreshed;
}

async function addApiCookie(context: BrowserContext, cookie: { name: string; value: string }) {
  await context.addCookies([
    {
      ...cookie,
      domain: '127.0.0.1',
      httpOnly: true,
      path: '/api/v1/auth',
      sameSite: 'Lax',
      secure: false,
    },
  ]);
}
