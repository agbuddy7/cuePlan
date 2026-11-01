# Verification strategy

## Commands and scope

| Command                 | Purpose                                                 |
| ----------------------- | ------------------------------------------------------- |
| `npm run format:check`  | Reviewable, consistent formatting                       |
| `npm run lint`          | Type-aware ESLint, Hooks and JSX accessibility rules    |
| `npm run typecheck`     | Strict compiler checks across UI, API, domain and tests |
| `npm test`              | Deterministic Vitest regression suite                   |
| `npm run test:coverage` | Measured domain/application/server/workspace coverage   |
| `npm run build`         | Typechecked Vite production artifact                    |
| `npm run verify`        | Complete non-browser quality gate                       |
| `npm run test:e2e`      | Chromium desktop and Pixel 7 browser journeys           |

## Invariant matrix

Budget tests exercise five budget magnitudes across every occasion and priority. Assertions cover integer reconciliation, nonnegative allocations, deterministic remainder ties, invalid money, protected categories, accepted quote costs, minimum billing, extra tax and guest-count impact.

Workspace tests exercise immutable command state, revision history, undo, history bounds, storage round-trip, malformed/oversized import, quote uniqueness, comparison limits, single acceptance and preservation of quotes/progress across edits.

Workflow tests check prerequisite unlocking, invalid completion, unique IDs, missing dependencies, cycles, owner edits and delay propagation. Calendar tests cover boundaries and invalid dates. Scenario tests check preview immutability, protected allocations, feasible gap relief and unavailable alternatives.

Server tests exercise method/media/origin/size guards, input contracts, request IDs, rate-limit identity isolation and expiry, provider success, provider quota/error/empty/invalid responses and fallback behavior after task completion.

## Browser matrix

The same browser journeys run for desktop Chrome and Pixel 7:

1. Record and accept a quote; preview and apply attendance changes; complete a task; delay venue; reload; undo.
2. Navigate tabs by keyboard; scan every panel using axe; check horizontal overflow and production CSP.
3. Export and import into a fresh page; reject malformed imports.
4. Simulate provider failure and inspect the printable full operating summary.

Provider calls are mocked in browser tests. The domain and server tests inject a transport instead of spending AI quota. Tests therefore do not require credentials.

## Coverage policy

Coverage includes domain, deterministic application briefing, server logic and workspace serialization/history. React rendering is verified by browser journeys, not included in the unit coverage percentage. Reports are emitted to `coverage/` and CI uploads the summary. Branch thresholds allow explicit defensive paths while requiring meaningful execution of business logic.

The repository does not claim a Lighthouse score, complete manual WCAG certification, global availability percentage, or test counts for a suite that has not been run. CI is the reproducible evidence for the submitted commit.
