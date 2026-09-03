import {
  expect,
  type ConsoleMessage,
  type Page,
  type Request,
  type Response,
} from '@playwright/test';

// Observe real browser traffic; never fulfill requests, supply auth, or log bodies/cookies.
export async function navigateToReadyPortfolio(
  page: Page,
  navigate: () => Promise<Response | null>,
  expected: { userId: string; activeId: string; organizationIds: string[]; phase: string },
) {
  const responses: Array<Record<string, string | number | undefined>> = [];
  const failedRequests: Array<{ path: string; error: string | undefined }> = [];
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const documentRequests = new Set<Request>();
  let documentStatus: number | undefined;
  const pathOf = (url: string) => new URL(url).pathname;
  const safeMessage = (message: string) =>
    message
      .replace(/https?:\/\/[^\s)]+/g, (url) => pathOf(url))
      .replace(/Bearer\s+\S+|eyJ[\w.-]+/g, '[redacted]');
  const onResponse = (response: Response) => {
    const path = pathOf(response.url());
    if (response.request().resourceType() === 'document' && path === '/app/portfolio') {
      documentStatus = response.status();
    }
    if (
      path.startsWith('/api/v1/') ||
      response.request().resourceType() === 'document' ||
      response.status() >= 400
    ) {
      const headers = response.headers();
      responses.push({
        path,
        method: response.request().method(),
        status: response.status(),
        limit: headers['x-ratelimit-limit'],
        remaining: headers['x-ratelimit-remaining'],
        reset: headers['x-ratelimit-reset'],
        retryAfter: headers['retry-after'],
      });
    }
  };
  const onRequest = (request: Request) => {
    if (documentStatus !== undefined) documentRequests.add(request);
  };
  const onFailure = (request: Request) =>
    failedRequests.push({ path: pathOf(request.url()), error: request.failure()?.errorText });
  const onConsole = (message: ConsoleMessage) => {
    if (message.type() === 'error') consoleErrors.push(safeMessage(message.text()));
  };
  const onError = (error: Error) => pageErrors.push(safeMessage(error.message));
  page.on('response', onResponse);
  page.on('request', onRequest);
  page.on('requestfailed', onFailure);
  page.on('console', onConsole);
  page.on('pageerror', onError);
  try {
    const waitFor = (path: string, method: string, status: number) =>
      page
        .waitForResponse(
          (response) =>
            documentRequests.has(response.request()) &&
            pathOf(response.url()) === `/api/v1${path}` &&
            response.request().method() === method,
        )
        .then((response) => {
          expect(response.status(), `New document ${method} ${path}`).toBe(status);
          return response;
        });
    // Register every observer before initiating the document navigation.
    const bootstrap = waitFor('/auth/refresh', 'POST', 201);
    const memberships = waitFor('/organizations', 'GET', 200);
    const portfolio = waitFor('/portfolio', 'GET', 200);
    const entitlements = waitFor('/entitlements', 'GET', 200);
    const [document, authResponse, organizationsResponse, portfolioResponse, entitlementsResponse] =
      await Promise.all([navigate(), bootstrap, memberships, portfolio, entitlements]);
    documentStatus = document?.status();
    expect(documentStatus, 'Portfolio document').toBe(200);
    expect(authResponse.status(), 'Real refresh bootstrap').toBe(201);
    expect(organizationsResponse.status(), 'Current active memberships').toBe(200);
    expect(portfolioResponse.status(), 'Authorized Portfolio query').toBe(200);
    expect(entitlementsResponse.status(), 'Safe organization entitlements').toBe(200);
    const auth = (await authResponse.json()) as { user: { id: string } };
    const organizations = (await organizationsResponse.json()) as Array<{ id: string }>;
    const result = (await portfolioResponse.json()) as {
      organizations: Array<{ organization: { id: string } }>;
    };
    expect(auth.user.id).toBe(expected.userId);
    expect(organizations.map(({ id }) => id).sort()).toEqual([...expected.organizationIds].sort());
    expect(result.organizations.map(({ organization }) => organization.id).sort()).toEqual(
      [...expected.organizationIds].sort(),
    );
    expect(entitlementsResponse.request().headers()['x-organization-id']).toBe(expected.activeId);
    await expect(page).toHaveURL('/app/portfolio');
    await expect(page.getByLabel('Organización activa')).toHaveValue(expected.activeId);
    await expect(page.locator('#main-content')).toHaveAttribute('aria-busy', 'false');
    await expect(
      page.getByRole('heading', { name: 'Portafolio operativo', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Organizaciones', exact: true })).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(responses.filter(({ status }) => status === 429)).toEqual([]);
  } finally {
    console.log(
      JSON.stringify({
        event: 'portfolio_readiness',
        phase: expected.phase,
        documentStatus,
        finalUrl: new URL(page.url()).origin + pathOf(page.url()),
        responses,
        consoleErrors,
        pageErrors,
        failedRequests,
      }),
    );
    page.off('response', onResponse);
    page.off('request', onRequest);
    page.off('requestfailed', onFailure);
    page.off('console', onConsole);
    page.off('pageerror', onError);
  }
}
