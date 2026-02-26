export const config = {
  runtime: 'edge',
};

const BACKEND_URL = 'https://api.reservasrealsabor.com.uy';

// CORS headers that will be applied to ALL responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
};

export default async function handler(request) {
  // Manejar Preflight (OPTIONS) requests directamente
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  const url = new URL(request.url);
  const backendUrl = `${BACKEND_URL}${url.pathname}${url.search}`;

  // Forward essential headers
  const forwardedHeaders = {};
  const allowed = new Set(['content-type', 'authorization', 'accept', 'accept-language']);

  for (const [key, value] of request.headers.entries()) {
    if (allowed.has(key.toLowerCase())) {
      forwardedHeaders[key] = value;
    }
  }

  let body = undefined;
  if (!['GET', 'HEAD'].includes(request.method)) {
    try {
      body = await request.arrayBuffer();
    } catch (e) {
      // ignore empty body parsing errors
    }
  }

  try {
    const backendResponse = await fetch(backendUrl, {
      method: request.method,
      headers: forwardedHeaders,
      body: body,
    });

    const contentType = backendResponse.headers.get('content-type') || 'application/json';
    
    // Copy all CORS headers + the backend content type
    const responseHeaders = new Headers({
      ...corsHeaders,
      'content-type': contentType,
    });

    return new Response(backendResponse.body, {
      status: backendResponse.status,
      statusText: backendResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Edge Proxy failed" }), {
      status: 502,
      headers: { ...corsHeaders, 'content-type': 'application/json' }
    });
  }
}
