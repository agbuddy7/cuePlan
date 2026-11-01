import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/index.js";

function responseRecorder() {
  const headers = new Map();
  return {
    statusCode: 200,
    body: null,
    setHeader(key, value) { headers.set(key.toLowerCase(), value); },
    getHeader(key) { return headers.get(key.toLowerCase()); },
    end(value) { this.body = Buffer.from(value || ""); },
  };
}

test("Vercel adapter serves the full application", async () => {
  const res = responseRecorder();
  await handler({ method: "GET", url: "/", headers: { host: "cueplan.test" } }, res);
  assert.equal(res.statusCode, 200);
  assert.match(res.getHeader("content-type"), /text\/html/);
  assert.match(res.body.toString(), /CuePlan/);
});

test("Vercel adapter preserves API validation", async () => {
  const res = responseRecorder();
  await handler({ method: "POST", url: "/api/plan", headers: { host: "cueplan.test", "content-type": "application/json" }, body: { eventType: "invalid" } }, res);
  assert.equal(res.statusCode, 400);
  assert.ok(Array.isArray(JSON.parse(res.body.toString()).errors));
});
