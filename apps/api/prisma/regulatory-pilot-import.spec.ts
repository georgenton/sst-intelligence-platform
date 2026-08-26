import { assertRegulatoryEditorialImportAllowed } from './regulatory-pilot-import';

describe('regulatory pilot editorial import guard', () => {
  const allowed = {
    NODE_ENV: 'test',
    REGULATORY_EDITORIAL_MODE: 'true',
    REGULATORY_EDITORIAL_DATABASE: 'ephemeral',
  } as NodeJS.ProcessEnv;

  it('allows only an explicit editorial ephemeral environment with no arguments', () => {
    expect(() => assertRegulatoryEditorialImportAllowed(allowed, [])).not.toThrow();
  });

  it.each([
    [{ ...allowed, NODE_ENV: 'production' }, []],
    [{ ...allowed, RAILWAY_ENVIRONMENT_NAME: 'production' }, []],
    [{ ...allowed, VERCEL_ENV: 'production' }, []],
    [{ NODE_ENV: 'test' }, []],
    [allowed, ['--force']],
  ])('refuses production, absent guards and bypass arguments', (environment, argumentsList) => {
    expect(() => assertRegulatoryEditorialImportAllowed(environment, argumentsList)).toThrow();
  });
});
