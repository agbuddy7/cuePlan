# Security policy

Report vulnerabilities privately to the repository owner. Do not open a public issue for secrets, authentication bypasses, injection, or denial-of-service findings.

## Design controls

- The Gemini key is read only in the server runtime.
- Zod schemas and domain invariants validate API and import data.
- The coordinator derives budget and schedule facts from a validated plan; summary totals are never trusted.
- Request bodies are limited to 64 KB and coordinator calls are rate-limited per instance.
- Responses set CSP, frame, MIME, referrer, and browser permissions controls.
- AI failures degrade to a deterministic briefing without exposing upstream errors.

## Storage and trust boundaries

Vendor names, task owners, notes and activity history are stored locally in the organizer's browser and included in explicitly exported JSON. No cloud event database or account system is provided. A requested Gemini review transmits compact derived financial and scheduling facts; full vendor notes and owner names are omitted from that prompt. Browser storage and export files are user-controlled and are not encrypted by the application.

Production pages have a CSP that excludes inline scripts and styles. React escapes rendered text. The server handles same-origin checks for supplied Origin values, method/media/body limits, schema validation, request IDs, bounded admission control and provider cancellation. Origin checks are not authentication; a globally enforced quota requires a shared limiter adapter.

The local history is reviewable and undoable, not a tamper-proof audit trail. Accepted vendor quotes are organizer-recorded commercial inputs rather than independently verified claims. Report security findings privately to the repository owner.
