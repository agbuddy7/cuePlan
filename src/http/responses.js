export function securityHeaders(contentType) {
  return {
    "content-type": contentType,
    "cache-control": contentType.startsWith("text/html") ? "no-store" : "public, max-age=3600",
    "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
  };
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...securityHeaders("application/json; charset=utf-8"), "cache-control": "no-store" } });
}

export async function readJson(request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 24000) throw new Error("Request is too large.");
  const text = await request.text();
  if (text.length > 24000) throw new Error("Request is too large.");
  return JSON.parse(text || "{}");
}

