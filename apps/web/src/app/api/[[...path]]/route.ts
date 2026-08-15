import { NextRequest } from 'next/server';

const apiUrl = process.env.API_URL ?? 'http://localhost:4000';

const HOP_BY_HOP_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
  'content-encoding',
  'transfer-encoding',
  'upgrade',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'trailers',
  'accept-encoding',
]);

const RESPONSE_HEADERS = [
  'content-type',
  'content-disposition',
  'etag',
  'last-modified',
  'cache-control',
];

async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname.replace(/^\/api/, '');
  const url = new URL(`${path}${request.nextUrl.search}`, apiUrl);

  const headers = new Headers();
  request.headers.forEach((value, name) => {
    if (!HOP_BY_HOP_HEADERS.has(name.toLowerCase())) {
      headers.set(name, value);
    }
  });
  headers.set('x-forwarded-proto', request.nextUrl.protocol.replace(':', ''));
  headers.set(
    'x-forwarded-host',
    request.headers.get('x-forwarded-host') ??
      request.headers.get('host') ??
      '',
  );
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    headers.set('x-forwarded-for', forwardedFor);
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: 'manual',
    signal: AbortSignal.timeout(10 * 60 * 1000),
  };

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  if (hasBody && request.body) {
    init.body = request.body;
    (init as RequestInit & { duplex: 'half' }).duplex = 'half';
  }

  let backend: Response;
  try {
    backend = await fetch(url, init);
  } catch {
    return new Response(
      JSON.stringify({ message: 'Не удалось связаться с API' }),
      {
        status: 502,
        headers: { 'content-type': 'application/json' },
      },
    );
  }

  const responseHeaders = new Headers();
  for (const name of RESPONSE_HEADERS) {
    const value = backend.headers.get(name);
    if (value) {
      responseHeaders.set(name, value);
    }
  }

  return new Response(backend.body, {
    status: backend.status,
    headers: responseHeaders,
  });
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
export const OPTIONS = proxy;
