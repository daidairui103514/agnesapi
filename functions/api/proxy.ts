export async function onRequest({ request, env }: any) {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" }});
  }

  const targetUrl = request.headers.get('x-target-url');
  if (!targetUrl) {
    return new Response(JSON.stringify({ error: "Missing x-target-url header" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  try {
    const authHeader = request.headers.get('authorization') || "";
    const sitePassword = env.SITE_PASSWORD || "";
    
    let actualApiKey = "";

    if (sitePassword) {
      const providedPassword = (authHeader || "").replace(/^Bearer\s+/i, "");
      if (providedPassword.trim() !== sitePassword.trim()) {
        return new Response(JSON.stringify({ error: "Invalid Site Password" }), { status: 401, headers: { "Content-Type": "application/json" } });
      }
    }

    if (targetUrl.includes('ranmeng')) {
      actualApiKey = env.RANMENG_API_KEY || authHeader.replace(/^Bearer\s+/i, "");
    } else {
      actualApiKey = env.AGNES_API_KEY || authHeader.replace(/^Bearer\s+/i, "");
    }
    
    const upstreamAuthHeader = actualApiKey ? `Bearer ${actualApiKey}` : authHeader;

    const fetchOptions: RequestInit = {
      method: request.method,
      headers: {
        "Content-Type": "application/json",
        "Authorization": upstreamAuthHeader,
      }
    };

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      const clonedReq = request.clone();
      fetchOptions.body = clonedReq.body;
    }

    const fetchResponse = await fetch(targetUrl, fetchOptions);

    const newHeaders = new Headers(fetchResponse.headers);
    newHeaders.delete('content-encoding');
    newHeaders.delete('content-length');
    newHeaders.delete('transfer-encoding');

    return new Response(fetchResponse.body, {
      status: fetchResponse.status,
      statusText: fetchResponse.statusText,
      headers: newHeaders
    });
  } catch (err: any) {
    console.error("Proxy error", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
