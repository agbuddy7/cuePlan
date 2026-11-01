import test from "node:test";
import assert from "node:assert/strict";
import { buildPlan, validatePlanInput, fallbackBriefing } from "../worker/index.js";

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
