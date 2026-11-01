# CuePlan — AI Event Coordinator

> A decision tool for tight-budget community events. CuePlan turns five constraints into an executable budget, dependency-aware run-of-show, vendor checklist, risk register, and live trade-off simulation.

Built for Challenge 5: Celebration and Event Planner.

## The rule that shapes the product

The language model never invents or owns a price. A deterministic planning engine calculates every allocation, buffer, deadline, dependency, and budget delta. AI is limited to coordinating and explaining the computed plan. Every monetary value is visibly labelled **Estimate** until a user records a vendor quote as **Confirmed**.

The app remains fully usable if AI credits expire: `/api/coordinate` returns a deterministic coordinator briefing with `mode: "fallback"` when no `OPENAI_API_KEY` is configured or an upstream request fails.

## Focused persona

Volunteer and student organizers planning community celebrations for 30–300 guests with hard budgets and limited planning experience.

## Features

- Five-field constraint intake: event, budget, guests, date, and priority.
- Deterministic category allocation with a 10% contingency reserve.
- Dependency-aware task timeline with blockers and ownership.
- Live budget and guest-count scenario simulator.
- Risk register linked to concrete mitigation tasks.
- Vendor cost ledger with explicit Estimate/Confirmed provenance.
- AI coordinator endpoint with schema-constrained context and graceful fallback.
- Printable plan and JSON export for handoff.

## Architecture

```text
Browser UI
  ├─ deterministic plan engine (instant, offline-safe)
  ├─ scenario simulator (pure calculations)
  └─ POST /api/coordinate
         ├─ validation + size limits + rate limit
         ├─ OpenAI Responses API when configured
         └─ deterministic briefing fallback
```

## How this addresses the rubric

- **Code quality:** dependency-free ES modules, pure exported engine functions, immutable inputs, centralized configuration, small HTTP boundary.
- **Security:** server-only API key, strict CSP and security headers, JSON/body limits, input validation, output escaping, same-origin API, per-IP rate limiting.
- **Efficiency:** one edge worker, zero runtime dependencies, no client framework, no external fonts or images, instant local calculations.
- **Testing:** Node built-in unit tests cover allocations, impossible budgets, validation, and fallback behavior. `npm test` and `npm run validate` are CI-friendly.
- **Accessibility:** semantic landmarks, skip link, keyboard operation, visible focus, `aria-live`, reduced-motion support, 44px targets, and non-color status labels.
- **Alignment:** manages execution, constraints, trade-offs, dependencies, vendors, and transparent estimates—not theme ideation.

## Local verification

```bash
npm test
npm run build
npm run validate
```

## Deploy to Vercel

The repository includes a thin Vercel Node Function adapter and `vercel.json`.
All planning logic remains in the platform-neutral Fetch API worker.

```bash
npx vercel          # preview deployment
npx vercel --prod   # production deployment
```

In Vercel project settings, add `OPENAI_API_KEY` as a server-side environment
variable to enable live AI briefings. Without it, the tested deterministic
fallback keeps the entire application usable. Optionally set `OPENAI_MODEL`.

## Optional AI configuration

Set `OPENAI_API_KEY` as a server-side hosting secret. Optionally set `OPENAI_MODEL`; it defaults to `gpt-5-mini`. Never expose either value in browser code or commit it.

## Submission checklist

- [ ] Public GitHub repository link
- [ ] Public deployed project link
- [ ] Video walkthrough (show create plan → scenario → task dependency → AI briefing → estimate labels)
- [ ] LinkedIn post documenting prompt evolution and transparent-AI design

Event costs are planning estimates, not vendor quotes.
