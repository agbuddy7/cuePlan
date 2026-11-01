# CuePlan v2 release evidence

## What changed

This release replaces the template-string JavaScript interface with focused React components and a strict TypeScript domain. Shared Zod contracts, deterministic money allocation, explicit commands and a versioned workspace connect budget, real quote records, accepted commitments, task execution, scenario decisions and undo.

New operational features include quote cost comparison, minimum billing and tax calculation, protected allocations, attendance-dependent forecasting, review-before-apply decisions, bounded flexible trims, task ownership and delay propagation, local autosave, validated import/export, full print summaries and a persistent local activity list.

The existing Gemini configuration is retained server-side. Provider reviews use current computed facts, a timeout, validated output and a current-state fallback. API requests have correlation IDs, consistent error shapes and bounded admission control. Vercel now serves the Vite `dist` directory and native TypeScript functions.

## Verification record

- Strict type checking passed.
- Type-aware lint passed without warnings.
- Prettier formatting gate passed.
- 49 unit/integration tests passed.
- Core coverage: 98.73% lines, 98.34% statements, 98.11% functions, 88.61% branches.
- Coverage scope: domain, deterministic application, server and workspace serialization/history; React UI is covered separately by browser tests.
- 8 browser journeys passed across desktop Chromium and Pixel 7.
- Axe checks passed on Budget, Vendors, Timeline, Decisions, Risks and Activity in both tested viewports.
- Production CSP and horizontal-overflow checks passed.
- Production dependency audit reported zero vulnerabilities.
- Vite production build passed.

Run `npm run verify` and `npm run test:e2e` to regenerate the evidence for your checkout. No private provider credential was needed for these tests. Live Gemini model availability and the final Vercel deployment remain environment-specific smoke checks.

## Deployment transition

Use the repository root and framework preset Other. The output directory is now `dist`; remove any old Vercel override pointing to `public`. Add Google runtime variables and redeploy the latest main branch. JSON storage uses version 2; export/import accepts the new workspace envelope rather than the old demo plan shape.
