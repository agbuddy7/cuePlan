# Contributing

Use Node.js 22+, install with `npm ci`, and run `npm run dev`. Before a change is ready for review, run `npm run verify` and `npm run test:e2e`.

Keep business rules in `src/domain`; components dispatch commands and render derived facts. Define new untrusted data contracts in the shared schema module. Add semantic validation when a shape alone cannot establish correctness. Keep provider credentials and transport code under the server boundary.

When changing money rules, test reconciliation across budgets and priorities. When changing task rules, test cycles, missing dependencies and transitions. When changing persistence, bump or migrate the version deliberately and test an exported workspace. Add browser coverage for user-visible behavior and update the architecture/API docs when contracts change.

Prefer focused commits with the problem, resulting behavior and verification described. Do not commit generated `dist`, coverage, browser traces, local environment values or credentials.
