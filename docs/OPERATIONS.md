# Deployment and operations

## Release gates

Run `npm test`, `npm run build`, and `npm run validate`. Unit and API tests run without provider credentials. Tests cover allocation invariants, priority shifts, task ordering, graph validation, task transitions, provider success/failure, rate-limit identity separation, HTTP validation and hosting adapters.

## Vercel import

Import `agbuddy7/cuePlan`, select Other, and use the repository root. The tracked `vercel.json` defines `npm run build`, output directory `public`, static security headers and the function execution budget. API entry points are `api/plan.js`, `api/coordinate.js`, `api/tasks.js` and `api/health.js`. No catch-all rewrite is required.

## Secrets

Set `GEMINI_API_KEY` in the Vercel environment. Set `GEMINI_MODEL` to a Gemini model enabled for that Google project. Redeploy after changing runtime variables. Keep provider values out of repository files and browser JavaScript. The coordinator works in deterministic mode when credentials are absent.

## Smoke test

1. Load `/` and confirm the default plan renders.
2. GET `/api/health` and verify `{ "ok": true, "service": "cueplan" }`.
3. Change priority and verify allocations plus reserve still equal total budget.
4. Apply a budget/attendance scenario and verify the metrics update.
5. Complete the brief task and verify venue and guest-list tasks unlock.
6. Request a coordinator briefing and verify its displayed mode.
7. Export a plan and verify the task states and allocations appear in JSON.

## Rollback

Use Vercel's previous successful deployment promotion, then verify health and the primary planning flow. Keep the domain tests passing before promoting a replacement commit. Current stateless API operations require no database migration or data rollback.

## Troubleshooting

| Symptom | Check |
|---|---|
| Static page missing | Build log, output directory `public`, repository root |
| API route missing | `api/` function inclusion and absence of conflicting dashboard rewrites |
| Coordinator displays fallback | Provider credentials, enabled model, quota and upstream response |
| Task completion rejected | All prerequisite IDs must be included in the completed set |
| Coordinator returns 429 | Wait for the one-minute per-process admission window |

## Scale boundaries

Planning and workflow calculation are small in-memory operations. API instances can scale independently because constraints are supplied per request. Shared quotas, durable event workspaces, team authorization and notifications require external storage and application services as described in the architecture proposal. The current code does not claim distributed rate-limit enforcement or durable session state.
