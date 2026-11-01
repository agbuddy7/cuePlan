import worker from "../worker/index.js";

function requestBody(req) {
  if (req.method === "GET" || req.method === "HEAD") return undefined;
  if (req.body == null) return undefined;
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return req.body;
  return JSON.stringify(req.body);
}

/** Translate one Vercel Node Function request into the shared Fetch API app. */
export async function invokeWorker(req, res, pathname) {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host || "localhost";
  const request = new Request(`${protocol}://${host}${pathname}`, {
    method: req.method,
    headers: req.headers,
    body: requestBody(req),
  });

  try {
    const response = await worker.fetch(request, process.env, {});
    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Unexpected server error." }));
  }
}
