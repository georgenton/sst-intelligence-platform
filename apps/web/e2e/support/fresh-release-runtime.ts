import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { PrismaClient } from '@prisma/client';

export async function freshReleaseRuntime() {
  const repository = process.env.SST_E2E_REPOSITORY_ROOT ?? resolve(__dirname, '../../../..');
  const apiRoot = resolve(repository, 'apps/api');
  const webRoot = resolve(repository, 'apps/web');
  const admin = new PrismaClient();
  const schema = `signup_claim_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.set('schema', schema);
  const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  const children: ChildProcess[] = [];
  const close = async () => {
    for (const child of children.reverse()) {
      if (child.exitCode === null) {
        child.kill('SIGTERM');
        await once(child, 'exit');
      }
    }
    await prisma.$disconnect();
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.$disconnect();
  };
  try {
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    const released = spawnSync('pnpm', ['production:release'], {
      cwd: apiRoot,
      env: { ...process.env, DATABASE_URL: url.toString() },
      encoding: 'utf8',
    });
    if (released.status !== 0) throw new Error('Fresh signup/claim production release failed');
    if ((await prisma.user.count()) || (await prisma.organization.count()))
      throw new Error('Fresh release created customer rows');
    const apiPort = await freePort();
    const webPort = await freePort();
    const apiOrigin = `http://127.0.0.1:${apiPort}`;
    const webOrigin = `http://127.0.0.1:${webPort}`;
    const api = spawn(process.execPath, ['dist/main.js'], {
      cwd: apiRoot,
      env: {
        ...process.env,
        DATABASE_URL: url.toString(),
        NODE_ENV: 'test',
        PORT: String(apiPort),
        COOKIE_SECURE: 'false',
        WEB_ORIGIN: webOrigin,
        JWT_ACCESS_SECRET: randomUUID() + randomUUID(),
      },
      stdio: 'ignore',
    });
    children.push(api);
    await ready(`${apiOrigin}/api/v1/health`, api);
    const web = spawn(process.execPath, ['scripts/start-e2e-server.mjs'], {
      cwd: webRoot,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        API_ORIGIN: apiOrigin,
        PORT: String(webPort),
        HOSTNAME: '127.0.0.1',
      },
      stdio: 'ignore',
    });
    children.push(web);
    await ready(webOrigin, web);
    return { origin: webOrigin, prisma, close };
  } catch (error) {
    await close();
    throw error;
  }
}

async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Fresh runtime port unavailable');
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  return address.port;
}

async function ready(url: string, child: ChildProcess) {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (child.exitCode !== null)
      throw new Error('Fresh signup/claim runtime exited before readiness');
    try {
      if ((await fetch(url)).status === 200) return;
    } catch {
      /* Startup in progress. */
    }
    await delay(125);
  }
  throw new Error('Fresh signup/claim runtime readiness timed out');
}
