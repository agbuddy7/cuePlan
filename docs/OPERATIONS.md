# Deployment and operations

## Runtime

Use Node.js 22 or later, npm, and a current browser. Install with `npm ci` from the committed lockfile. Development: `npm run dev`. Production build: `npm run build`. Local production preview: `npm run preview`.

The Vite development middleware delegates `/api/plan`, `/api/coordinate` and `/api/health` to the same HTTP application used by production handlers. The production preview serves static assets; AI requests there may use the built-in fallback unless an API runtime is provided.

## Environment

Export `GEMINI_API_KEY` in the development process or define it as a Vercel runtime environment variable. Optionally define `GEMINI_MODEL` to a model enabled for your Google project. The repository preserves the existing default model name; availability is specific to the account. Missing credentials select deterministic mode. Restart the dev process or redeploy after changing variables.

## Vercel release

1. Import `agbuddy7/cuePlan` with framework preset Other and root `./`.
2. Keep the tracked build command `npm run build` and output `dist`.
3. Confirm native `api/*.ts` functions are included.
4. Configure server-side Google variables for the relevant deployment environments.
5. Run `npm run verify` and `npm run test:e2e` before promoting.
6. Verify the deployed health endpoint and primary product journey.

The v2 migration changes output from `public` to `dist` and API extensions from JavaScript to TypeScript. Remove stale dashboard overrides that conflict with `vercel.json`. No blanket rewrite should route static assets through an API function.

## Smoke checklist

- `/api/health` reports `ok: true` and version 2.
- The default community plan renders without a console error.
- Record and accept a per-guest food quote; committed spend updates.
- Change attendance in Decisions; preview cost impact before applying.
- Complete brief approval; venue and guest tasks become ready.
- Delay venue; downstream date warnings appear.
- Reload; accepted quote and progress restore.
- Undo; previous values return.
- Export/import into a fresh browser context.
- Print preview includes all operating sections, regardless of active tab.
- Request a coordinator review and inspect the displayed mode.

## Rollback

Promote a previous successful Vercel deployment and recheck health and the planning workflow. Export the current local workspace before reverting to an earlier storage-contract version. The current release has no database migration. Previous code may not understand v2 exports.

## Diagnostics

| Symptom              | Check                                                               |
| -------------------- | ------------------------------------------------------------------- |
| Missing page/assets  | Output `dist`, repository root and Vite build log                   |
| Missing API          | Native `api/*.ts` inclusion and conflicting platform overrides      |
| Built-in coordinator | Credential, model entitlement, quota, provider response and timeout |
| Rejected scenario    | Protected allocation total versus new working budget                |
| Blocked completion   | Complete prerequisite tasks first                                   |
| Failed autosave      | Browser storage permission/capacity; export a backup                |
| Rejected import      | Version 2 workspace envelope, size, quote and graph invariants      |
| 429 response         | Per-instance one-minute admission window; inspect Retry-After       |

Each API response carries an `X-Request-ID`. Error responses repeat this identifier for correlation. No current analytics or server event database stores organizer activity.
