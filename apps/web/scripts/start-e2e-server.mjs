import { access, cp, stat } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';
import { URL, fileURLToPath, pathToFileURL } from 'node:url';

const webRoot = fileURLToPath(new URL('..', import.meta.url));
const nextOutput = join(webRoot, '.next');
const standaloneRoot = join(nextOutput, 'standalone', 'apps', 'web');
const serverEntry = join(standaloneRoot, 'server.js');

await Promise.all([access(join(nextOutput, 'BUILD_ID')), access(serverEntry)]).catch((error) => {
  throw new Error('E2E_PRODUCTION_BUILD_REQUIRED: run pnpm build before pnpm test:e2e', {
    cause: error,
  });
});

await cp(join(nextOutput, 'static'), join(standaloneRoot, '.next', 'static'), {
  recursive: true,
});
const publicDirectory = join(webRoot, 'public');
const publicExists = await stat(publicDirectory).catch((error) => {
  if (error.code === 'ENOENT') return null;
  throw error;
});
if (publicExists) await cp(publicDirectory, join(standaloneRoot, 'public'), { recursive: true });

process.env.HOSTNAME ??= '127.0.0.1';
process.env.NODE_ENV = 'production';
process.env.PORT ??= '3100';

await import(pathToFileURL(serverEntry).href);
