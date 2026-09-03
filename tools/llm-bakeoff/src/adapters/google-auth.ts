import { createSign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { FetchLike } from './common';

type ServiceAccountCredential = {
  type: 'service_account';
  client_email: string;
  private_key: string;
  token_uri?: string;
};

type AuthorizedUserCredential = {
  type: 'authorized_user';
  client_id: string;
  client_secret: string;
  refresh_token: string;
  token_uri?: string;
};

type AdcCredential = ServiceAccountCredential | AuthorizedUserCredential;

const DEFAULT_TOKEN_URI = 'https://oauth2.googleapis.com/token';

function tokenUri(value: string | undefined): string {
  if (value !== undefined && value !== DEFAULT_TOKEN_URI) {
    throw new Error('GOOGLE_ADC_UNSUPPORTED_TOKEN_URI');
  }
  return DEFAULT_TOKEN_URI;
}

function encodeBase64Url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

function isCredential(value: unknown): value is AdcCredential {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.type === 'service_account') {
    return typeof candidate.client_email === 'string' && typeof candidate.private_key === 'string';
  }
  return (
    candidate.type === 'authorized_user' &&
    typeof candidate.client_id === 'string' &&
    typeof candidate.client_secret === 'string' &&
    typeof candidate.refresh_token === 'string'
  );
}

async function parseTokenResponse(response: Response): Promise<string> {
  if (!response.ok) throw new Error(`GOOGLE_ADC_HTTP_${response.status}`);
  const value: unknown = await response.json();
  if (
    !value ||
    typeof value !== 'object' ||
    typeof (value as { access_token?: unknown }).access_token !== 'string'
  ) {
    throw new Error('GOOGLE_ADC_INVALID_RESPONSE');
  }
  return (value as { access_token: string }).access_token;
}

async function serviceAccountToken(
  credential: ServiceAccountCredential,
  fetchImplementation: FetchLike,
): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1_000);
  const resolvedTokenUri = tokenUri(credential.token_uri);
  const unsigned = `${encodeBase64Url(
    JSON.stringify({ alg: 'RS256', typ: 'JWT' }),
  )}.${encodeBase64Url(
    JSON.stringify({
      iss: credential.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: resolvedTokenUri,
      iat: issuedAt,
      exp: issuedAt + 3_600,
    }),
  )}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${encodeBase64Url(signer.sign(credential.private_key))}`;
  const response = await fetchImplementation(resolvedTokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  return parseTokenResponse(response);
}

async function authorizedUserToken(
  credential: AuthorizedUserCredential,
  fetchImplementation: FetchLike,
): Promise<string> {
  const response = await fetchImplementation(tokenUri(credential.token_uri), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: credential.client_id,
      client_secret: credential.client_secret,
      refresh_token: credential.refresh_token,
    }),
  });
  return parseTokenResponse(response);
}

export async function resolveGoogleAdcAccessToken(
  credentialPath: string,
  fetchImplementation: FetchLike,
): Promise<string> {
  let credential: unknown;
  try {
    credential = JSON.parse(await readFile(credentialPath, 'utf8')) as unknown;
  } catch {
    throw new Error('GOOGLE_ADC_UNREADABLE');
  }
  if (!isCredential(credential)) throw new Error('GOOGLE_ADC_UNSUPPORTED_TYPE');
  return credential.type === 'service_account'
    ? serviceAccountToken(credential, fetchImplementation)
    : authorizedUserToken(credential, fetchImplementation);
}
