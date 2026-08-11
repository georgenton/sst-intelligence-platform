const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:3001';

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function proxy(request: Request, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  const target = new URL(`/api/v1/${path.map(encodeURIComponent).join('/')}`, apiOrigin);
  target.search = new URL(request.url).search;

  try {
    const proxyRequest = new Request(target, request);
    const upstream = await fetch(proxyRequest, { cache: 'no-store', redirect: 'manual' });
    const body = await upstream.arrayBuffer();
    const headers = new Headers(upstream.headers);

    headers.delete('content-encoding');
    headers.delete('content-length');
    headers.delete('transfer-encoding');

    return new Response(body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  } catch {
    return Response.json(
      {
        code: 'UPSTREAM_UNAVAILABLE',
        message: 'El servicio no está disponible temporalmente.',
        details: null,
        traceId: crypto.randomUUID(),
      },
      { status: 502 },
    );
  }
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export {
  proxy as DELETE,
  proxy as GET,
  proxy as HEAD,
  proxy as OPTIONS,
  proxy as PATCH,
  proxy as POST,
  proxy as PUT,
};
