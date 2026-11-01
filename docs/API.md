# HTTP API contracts

All functions use JSON, standard response shapes and server-only provider secrets. Types and runtime validators live in `src/domain/schema.ts`. Vercel entry points are thin delegates to `handle()`.

## GET /api/health

```json
{ "ok": true, "service": "cueplan", "version": 2 }
```

## POST /api/plan

Build an initial event plan from constraints:

```json
{
  "eventType": "community-fest",
  "budget": 120000,
  "guests": 120,
  "eventDate": "2030-03-01",
  "priority": "balanced"
}
```

Dates must be valid calendar dates within 730 days of the server's current planning date. Budget range: ₹10,000–₹1,00,00,000. Attendance: 10–5,000. Priority values: balanced, food, experience, reach, comfort. Occasion values: community-fest, birthday, wedding, fundraiser, workshop.

The response is `{ "plan": EventPlan }`. The browser can also invoke the same domain function locally for offline-safe planning.

## POST /api/coordinate

Request body: `{ "plan": EventPlan }`. The server parses the complete version 2 plan, checks graph and budget invariants and recomputes the coordinator facts. It does not trust client-supplied summary totals. Recorded commercial terms remain organizer inputs, not server-verified vendor claims.

```json
{
  "mode": "fallback",
  "message": "Next: Approve event brief and priorities...",
  "assumptions": ["Unquoted category costs are estimates"]
}
```

`mode` is `ai` or `fallback`. Provider output is parsed and bounded before delivery. The UI validates the returned briefing contract again.

## Errors

```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "The request does not match the event plan contract.",
    "requestId": "correlation-id"
  }
}
```

| Status | Meaning                                                     |
| ------ | ----------------------------------------------------------- |
| 400    | Invalid JSON, schema failure or violated domain invariant   |
| 403    | Supplied Origin is invalid or differs from Host             |
| 405    | Unsupported method; Allow header describes supported method |
| 413    | Serialized body exceeds 64 KB                               |
| 415    | Content-Type is not application/json                        |
| 429    | Coordinator per-instance quota exceeded; Retry-After: 60    |

Origin-less non-browser clients can call the API; origin checks are not authentication. This release exposes computation rather than private database records. Quota enforcement is bounded in memory per function instance, so a shared quota service is an extension point.

The earlier demo `/api/tasks` route is retired. Task commands now run locally through the shared typed domain and are validated again when an imported or submitted plan crosses a boundary.
