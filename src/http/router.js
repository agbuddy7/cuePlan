import { buildPlan, validatePlanInput } from "../domain/planning.js";
import { securityHeaders, json, readJson } from "./responses.js";
import { allowRequest } from "../infrastructure/rate-limit.js";
import { coordinateWithGemini } from "../infrastructure/gemini.js";
import { PAGE } from "../web/page.js";
import { APP } from "../web/client.js";
import { resolveWorkflow } from "../domain/workflow.js";
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/") return new Response(PAGE, { headers: securityHeaders("text/html; charset=utf-8") });
    if (request.method === "GET" && url.pathname === "/app.js") return new Response(APP, { headers: securityHeaders("application/javascript; charset=utf-8") });
    if (request.method === "GET" && url.pathname === "/health") return json({ ok: true, service: "cueplan" });
    if (request.method === "POST" && url.pathname === "/api/tasks") {
      try {
        const body = await readJson(request);
        const valid = validatePlanInput(body?.input);
        if (!valid.ok) return json({ errors: valid.errors }, 400);
        if (!Array.isArray(body.completedIds) || body.completedIds.length > 6 || !body.completedIds.every(id => typeof id === "string")) {
          return json({ errors: ["Provide up to six completed task IDs."] }, 400);
        }
        const plan = buildPlan(body.input);
        return json({ tasks: resolveWorkflow(plan.tasks, body.completedIds) });
      } catch { return json({ errors: ["Complete valid prerequisite tasks first."] }, 400); }
    }
    if (request.method === "POST" && url.pathname === "/api/plan") {
      try {
        const input = await readJson(request);
        const valid = validatePlanInput(input);
        if (!valid.ok) return json({ errors: valid.errors }, 400);
        return json({ plan: buildPlan(input) });
      } catch (error) { return json({ errors: [error.message || "Invalid request."] }, 400); }
    }
    if (request.method === "POST" && url.pathname === "/api/coordinate") {
      if (!allowRequest(request)) return json({ error: "Too many coordinator requests. Try again in one minute." }, 429);
      try {
        const body = await readJson(request);
        const input = body && body.plan && body.plan.input;
        const valid = validatePlanInput(input);
        if (!valid.ok) return json({ error: "Plan input is invalid." }, 400);
        const authoritativePlan = buildPlan(input);
        return json(await coordinateWithGemini(authoritativePlan, env));
      } catch (error) { return json({ error: error.message || "Invalid request." }, 400); }
    }
    return new Response("Not found", { status: 404, headers: securityHeaders("text/plain; charset=utf-8") });
  },
};
