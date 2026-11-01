import test from "node:test";
import assert from "node:assert/strict";
import worker, { buildPlan, validatePlanInput, fallbackBriefing } from "../worker/index.js";

test("allocations reconcile exactly to the usable budget", () => {
  const plan = buildPlan({ eventType: "community-fest", budget: 120000, guests: 120, days: 42, priority: "experience" });
  const allocated = plan.allocations.reduce((sum, item) => sum + item.amount, 0);
  assert.equal(allocated + plan.reserve, 120000);
  assert.equal(plan.reserve, 12000);
});

test("guest pressure is surfaced for an infeasible per-person budget", () => {
  const plan = buildPlan({ eventType: "wedding", budget: 30000, guests: 300, days: 15, priority: "food" });
  assert.equal(plan.health, "at-risk");
  assert.ok(plan.risks.some((risk) => risk.id === "budget-pressure"));
});

test("validation rejects unsafe or nonsensical input", () => {
  assert.equal(validatePlanInput({ eventType: "x", budget: -1, guests: 0, days: 0, priority: "x" }).ok, false);
  assert.equal(validatePlanInput({ eventType: "birthday", budget: 50000, guests: 50, days: 21, priority: "balanced" }).ok, true);
});

test("fallback briefing is explicit about deterministic mode", () => {
  const plan = buildPlan({ eventType: "birthday", budget: 50000, guests: 50, days: 21, priority: "balanced" });
  const result = fallbackBriefing(plan);
  assert.equal(result.mode, "fallback");
  assert.match(result.message, /estimate/i);
});

test("priority shifts preserve the reserve and total", () => {
  for (const priority of ["balanced", "food", "experience", "reach", "comfort"]) {
    const plan = buildPlan({ eventType: "fundraiser", budget: 97500, guests: 75, days: 60, priority });
    assert.equal(plan.allocations.reduce((sum, item) => sum + item.amount, 0) + plan.reserve, 97500);
  }
});

test("the planning API rejects invalid input with a safe error shape", async () => {
  const request = new Request("https://example.test/api/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventType: "unknown" }) });
  const response = await worker.fetch(request, {}, {});
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.ok(Array.isArray(body.errors));
});

test("the coordinator never trusts client-supplied calculations", async () => {
  const real = buildPlan({ eventType: "workshop", budget: 80000, guests: 80, days: 30, priority: "balanced" });
  const tampered = { ...real, reserve: 0, allocations: [] };
  const request = new Request("https://example.test/api/coordinate", { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": "test-authoritative" }, body: JSON.stringify({ plan: tampered }) });
  const response = await worker.fetch(request, {}, {});
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.match(body.message, /8,000/);
});

test("HTML responses include key browser security headers", async () => {
  const response = await worker.fetch(new Request("https://example.test/"), {}, {});
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("permissions-policy"), "camera=(), microphone=(), geolocation=(), payment=()");
});
