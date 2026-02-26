export const config = {
  runtime: 'edge',
};

const BACKEND_URL = 'https://api.reservasrealsabor.com.uy';

export default async function handler(request) {
  const url = new URL(request.url);
  const backendUrl = `${BACKEND_URL}${url.pathname}${url.search}`;

  // Only forward essential headers — strip cookies, Vercel headers, Sec-* headers
  const forwardedHeaders = {};
  const allowed = new Set(['content-type', 'authorization', 'accept', 'accept-language', 'accept-encoding']);

  for (const [key, value] of request.headers.entries()) {
    if (allowed.has(key.toLowerCase())) {
      forwardedHeaders[key] = value;
    }
  }

  let body = undefined;
  if (!['GET', 'HEAD'].includes(request.method)) {
    body = await request.arrayBuffer();
  }

  const backendResponse = await fetch(backendUrl, {
    method: request.method,
    headers: forwardedHeaders,
    body: body,
  });

  const responseHeaders = {
    'content-type': backendResponse.headers.get('content-type') || 'application/json',
    'cache-control': 'no-cache, no-store, must-revalidate',
  };

  return new Response(backendResponse.body, {
    status: backendResponse.status,
    statusText: backendResponse.statusText,
    headers: responseHeaders,
  });
}
