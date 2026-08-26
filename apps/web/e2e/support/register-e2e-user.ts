import { request as httpRequest } from 'node:http';
import { networkInterfaces } from 'node:os';

export function registerE2eUser(data: { displayName: string; email: string; password: string }) {
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
            statusCode: response.statusCode,
          }),
        );
      },
    );
    registration.on('error', reject);
    registration.end(body);
  });
}
