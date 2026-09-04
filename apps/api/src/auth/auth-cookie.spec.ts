import { refreshCookieOptions, resolveRefreshCookieName } from './auth-cookie';

describe('auth cookie isolation', () => {
  it('uses distinct production and staging namespaces by default', () => {
    expect(
      resolveRefreshCookieName({
        SST_DEPLOYMENT_ENVIRONMENT: 'production',
        RAILWAY_ENVIRONMENT_NAME: 'production',
      }),
    ).toBe('sst_refresh');
    expect(
      resolveRefreshCookieName({
        SST_DEPLOYMENT_ENVIRONMENT: 'staging',
        RAILWAY_ENVIRONMENT_NAME: 'staging',
      }),
    ).toBe('sst_staging_refresh');
  });

  it('rejects unsafe configured cookie names and keeps auth-only cookie options', () => {
    expect(() => resolveRefreshCookieName({ AUTH_REFRESH_COOKIE_NAME: 'bad cookie' })).toThrow(
      'AUTH_REFRESH_COOKIE_NAME_INVALID',
    );
    expect(refreshCookieOptions({ COOKIE_SECURE: 'true' })).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/api/v1/auth',
    });
  });
});
