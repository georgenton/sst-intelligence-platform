import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { isIP } from 'node:net';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import type { RegulatoryPilotManifestBundle } from '@sst/contracts';

const ALLOWED_HOSTS = new Set(['www.trabajo.gob.ec', 'www.registroficial.gob.ec']);

function isPrivateAddress(address: string) {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b! >= 16 && b! <= 31) ||
      (a === 192 && b === 168) ||
      a! >= 224
    );
  }
  const normalized = address.toLowerCase();
  return (
    normalized === '::1' ||
    normalized === '::' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  );
}

export async function assertAllowedOfficialUrl(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    !ALLOWED_HOSTS.has(url.hostname) ||
    isIP(url.hostname) !== 0
  )
    throw new Error('OFFICIAL_SOURCE_URL_REJECTED');
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address)))
    throw new Error('OFFICIAL_SOURCE_PRIVATE_ADDRESS_REJECTED');
  return url;
}

async function fetchBounded(urlValue: string, expectedMime: string, maxBytes: number) {
  let current = await assertAllowedOfficialUrl(urlValue);
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    const response = await fetch(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000),
      headers: { 'user-agent': 'sst-regulatory-source-verifier/1.0' },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location || redirect === 3) throw new Error('OFFICIAL_SOURCE_REDIRECT_REJECTED');
      current = await assertAllowedOfficialUrl(new URL(location, current).toString());
      continue;
    }
    if (!response.ok || !response.body) throw new Error(`OFFICIAL_SOURCE_HTTP_${response.status}`);
    const mediaType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
    if (mediaType !== expectedMime) throw new Error('OFFICIAL_SOURCE_MIME_MISMATCH');
    const declared = Number(response.headers.get('content-length') ?? 0);
    if (declared > maxBytes) throw new Error('OFFICIAL_SOURCE_TOO_LARGE');
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    const reader = response.body.getReader();
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new Error('OFFICIAL_SOURCE_TOO_LARGE');
      }
      chunks.push(chunk.value);
    }
    return {
      status: response.status,
      mediaType,
      body: Buffer.concat(chunks),
      finalUrl: current.toString(),
    };
  }
  throw new Error('OFFICIAL_SOURCE_REDIRECT_REJECTED');
}

export async function verifyOfficialRegulatorySource(manifest: RegulatoryPilotManifestBundle) {
  const [document, catalog, publication] = await Promise.all([
    fetchBounded(manifest.source.officialUrl, 'application/pdf', 25_000_000),
    fetchBounded(manifest.source.officialCatalogUrl, 'text/html', 2_000_000),
    fetchBounded(manifest.source.officialPublicationUrl, 'text/html', 2_000_000),
  ]);
  const sha256 = `sha256:${createHash('sha256').update(document.body).digest('hex')}`;
  if (sha256 !== manifest.source.officialDocumentSha256)
    throw new Error('SOURCE_ARTIFACT_DRIFT_DETECTED');
  if (document.body.byteLength !== manifest.source.officialDocumentBytes)
    throw new Error('OFFICIAL_SOURCE_BYTE_COUNT_MISMATCH');
  const directory = mkdtempSync(resolve(tmpdir(), 'mdt-2024-196-'));
  try {
    const pdf = resolve(directory, 'official.pdf');
    const text = resolve(directory, 'official.txt');
    writeFileSync(pdf, document.body);
    execFileSync('pdftotext', [pdf, text], { timeout: 15_000, stdio: 'ignore' });
    const extracted = readFileSync(text, 'utf8');
    const catalogText = catalog.body.toString('utf8');
    const publicationText = publication.body.toString('utf8');
    if (
      !/MDT[-– ]2024[-– ]196/i.test(extracted) ||
      !/Artículo\s+18/i.test(extracted) ||
      !/Artículo\s+19/i.test(extracted)
    )
      throw new Error('OFFICIAL_SOURCE_TITLE_OR_LOCATOR_MISMATCH');
    if (!/MDT[-– ]2024[-– ]196/i.test(catalogText))
      throw new Error('OFFICIAL_CATALOG_METADATA_MISMATCH');
    if (!/691/.test(publicationText) || !/26\s+(?:Nov|noviembre)\s+2024/i.test(publicationText))
      throw new Error('REGISTRO_OFICIAL_METADATA_MISMATCH');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
  return {
    officialUrl: document.finalUrl,
    httpStatus: document.status,
    mime: document.mediaType,
    bytes: document.body.byteLength,
    sha256,
    documentTitleMatch: true,
    retrievalTime: new Date().toISOString(),
    registroOficialMetadataMatch: true,
  };
}
